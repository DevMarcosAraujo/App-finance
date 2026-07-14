import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  const usuario = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    senhaHash: '',
    criadoEm: new Date(),
  };

  const buildService = () => {
    const prisma = {
      usuario: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    } as unknown as PrismaService;

    const jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn(),
    } as unknown as JwtService;

    process.env.JWT_ACCESS_SECRET = 'access-secret';
    process.env.JWT_ACCESS_EXPIRES = '15m';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    process.env.JWT_REFRESH_EXPIRES = '30d';

    return { service: new AuthService(prisma, jwtService), prisma, jwtService };
  };

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      const { service, prisma } = buildService();
      (prisma.usuario.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.usuario.create as jest.Mock).mockResolvedValue({
        ...usuario,
        senhaHash: 'hashed',
      });

      const result = await service.register({
        nome: 'Marcos',
        email: usuario.email,
        cpf: usuario.cpf,
        senha: 'password123',
      });

      expect(prisma.usuario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nome: 'Marcos',
            email: usuario.email,
            cpf: usuario.cpf,
          }),
        }),
      );
      expect(result.usuario.email).toBe(usuario.email);
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
    });

    it('throws ConflictException when email or cpf already exists', async () => {
      const { service, prisma } = buildService();
      (prisma.usuario.findFirst as jest.Mock).mockResolvedValue(usuario);

      await expect(
        service.register({
          nome: 'Marcos',
          email: usuario.email,
          cpf: usuario.cpf,
          senha: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const { service, prisma } = buildService();
      const senhaHash = await bcrypt.hash('password123', 10);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
        ...usuario,
        senhaHash,
      });

      const result = await service.login({
        email: usuario.email,
        senha: 'password123',
      });

      expect(result.usuario.email).toBe(usuario.email);
      expect(result.accessToken).toBe('signed-token');
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      const { service, prisma } = buildService();
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', senha: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      const { service, prisma } = buildService();
      const senhaHash = await bcrypt.hash('password123', 10);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
        ...usuario,
        senhaHash,
      });

      await expect(
        service.login({ email: usuario.email, senha: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
