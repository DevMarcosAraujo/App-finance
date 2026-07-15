import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

describe('JwtStrategy', () => {
  const usuario = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    senhaHash: 'hash',
    criadoEm: new Date('2026-01-01'),
  };

  const buildStrategy = (findUnique: jest.Mock) => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const prisma = { usuario: { findUnique } } as unknown as PrismaService;
    return new JwtStrategy(prisma);
  };

  it('returns the authenticated user when the token subject exists', async () => {
    const findUnique = jest.fn().mockResolvedValue(usuario);
    const strategy = buildStrategy(findUnique);

    const result = await strategy.validate({
      sub: 'user-1',
      email: usuario.email,
    });

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(result).toEqual({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      cpf: usuario.cpf,
      criadoEm: usuario.criadoEm,
    });
  });

  it('throws when the token subject no longer exists', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const strategy = buildStrategy(findUnique);

    await expect(
      strategy.validate({ sub: 'ghost', email: 'ghost@example.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
