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

      const capturedHash = (prisma.usuario.create as jest.Mock).mock
        .calls[0][0].data.senhaHash;
      expect(capturedHash).not.toBe('password123');
      expect(typeof capturedHash).toBe('string');
      // bcrypt hashes are salted per-call, so we must verify via compare,
      // never via string equality against a separately-computed hash.
      await expect(
        bcrypt.compare('password123', capturedHash),
      ).resolves.toBe(true);
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

  describe('token issuance security properties (via register/login)', () => {
    // issueTokens() is private and must stay tested indirectly through the
    // public register()/login() entry points.
    const assertTokenIssuance = async (
      prisma: PrismaService,
      jwtService: JwtService,
      result: { accessToken: string; refreshToken: string },
    ) => {
      const signCalls = (jwtService.sign as jest.Mock).mock.calls;
      expect(signCalls).toHaveLength(2);

      const [accessArgs, refreshArgs] = signCalls;
      const [, accessOptions] = accessArgs;
      const [, refreshOptions] = refreshArgs;

      // Access and refresh tokens must use different secrets and expirations.
      expect(accessOptions).toEqual({
        secret: 'access-secret',
        expiresIn: '15m',
      });
      expect(refreshOptions).toEqual({
        secret: 'refresh-secret',
        expiresIn: '30d',
      });
      expect(accessOptions.secret).not.toBe(refreshOptions.secret);

      // The refresh token must be persisted as a bcrypt hash, never in the
      // clear, and never equal (by string comparison) to the raw token.
      const createCall = (prisma.refreshToken.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.data.tokenHash).not.toBe(result.refreshToken);
      await expect(
        bcrypt.compare(result.refreshToken, createCall.data.tokenHash),
      ).resolves.toBe(true);

      // expiraEm should be ~30 days from now (REFRESH_TOKEN_TTL_MS), not an
      // exact match, since real time elapses while the test runs.
      const expectedExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const toleranceMs = 5000;
      expect(createCall.data.expiraEm).toBeInstanceOf(Date);
      expect(
        Math.abs(createCall.data.expiraEm.getTime() - expectedExpiry),
      ).toBeLessThan(toleranceMs);
    };

    it('issues distinct access/refresh tokens and a hashed refresh token on register', async () => {
      const { service, prisma, jwtService } = buildService();
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

      await assertTokenIssuance(prisma, jwtService, result);
    });

    it('issues distinct access/refresh tokens and a hashed refresh token on login', async () => {
      const { service, prisma, jwtService } = buildService();
      const senhaHash = await bcrypt.hash('password123', 10);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
        ...usuario,
        senhaHash,
      });

      const result = await service.login({
        email: usuario.email,
        senha: 'password123',
      });

      await assertTokenIssuance(prisma, jwtService, result);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and returns new tokens', async () => {
      const { service, prisma, jwtService } = buildService();
      const oldTokenHash = await bcrypt.hash('old-refresh-token', 10);

      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: usuario.id,
        jti: 'token-1',
      });
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-1',
        usuarioId: usuario.id,
        tokenHash: oldTokenHash,
        expiraEm: new Date(Date.now() + 1000 * 60 * 60),
        revogadoEm: null,
      });
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(usuario);

      const result = await service.refresh('old-refresh-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { revogadoEm: expect.any(Date) },
      });
      expect(result.accessToken).toBe('signed-token');
    });

    it('revokes all sessions when a revoked refresh token is reused', async () => {
      const { service, prisma, jwtService } = buildService();
      const tokenHash = await bcrypt.hash('stolen-refresh-token', 10);

      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: usuario.id,
        jti: 'token-1',
      });
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-1',
        usuarioId: usuario.id,
        tokenHash,
        expiraEm: new Date(Date.now() + 1000 * 60 * 60),
        revogadoEm: new Date(),
      });

      await expect(service.refresh('stolen-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { usuarioId: usuario.id, revogadoEm: null },
        data: { revogadoEm: expect.any(Date) },
      });
    });

    it('throws when the refresh token JWT is invalid', async () => {
      const { service, jwtService } = buildService();
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('garbage')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the refresh token record', async () => {
      const { service, prisma, jwtService } = buildService();
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: usuario.id,
        jti: 'token-1',
      });

      await service.logout('some-refresh-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-1', revogadoEm: null },
        data: { revogadoEm: expect.any(Date) },
      });
    });
  });
});
