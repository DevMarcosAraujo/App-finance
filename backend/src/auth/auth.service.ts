import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { parseDurationToMs } from './duration.util';

const ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES ?? '15m';
const REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES ?? '30d';
const REFRESH_TOKEN_TTL_MS = parseDurationToMs(REFRESH_TOKEN_EXPIRES);

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  usuario: {
    id: string;
    nome: string;
    email: string;
    cpf: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.usuario.findFirst({
      where: { OR: [{ email: dto.email }, { cpf: dto.cpf }] },
    });

    if (existing) {
      throw new ConflictException('email ou CPF já cadastrado');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);

    const usuario = await this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        cpf: dto.cpf,
        senhaHash,
      },
    });

    const tokens = await this.issueTokens(usuario.id, usuario.email);

    return { usuario: this.toPublicUsuario(usuario), ...tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    if (!usuario) {
      throw new UnauthorizedException('email ou senha inválidos');
    }

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senhaHash);

    if (!senhaValida) {
      throw new UnauthorizedException('email ou senha inválidos');
    }

    const tokens = await this.issueTokens(usuario.id, usuario.email);

    return { usuario: this.toPublicUsuario(usuario), ...tokens };
  }

  private toPublicUsuario(usuario: {
    id: string;
    nome: string;
    email: string;
    cpf: string;
  }): AuthResult['usuario'] {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      cpf: usuario.cpf,
    };
  }

  private async issueTokens(
    usuarioId: string,
    email: string,
  ): Promise<AuthTokens> {
    const accessToken = this.jwtService.sign(
      { sub: usuarioId, email },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: ACCESS_TOKEN_EXPIRES,
      },
    );

    const jti = randomUUID();
    const refreshToken = this.jwtService.sign(
      { sub: usuarioId, jti },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: REFRESH_TOKEN_EXPIRES,
      },
    );

    const tokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        usuarioId,
        tokenHash,
        expiraEm: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }
}
