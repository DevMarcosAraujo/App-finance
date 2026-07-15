import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomValidCpf } from './fixtures/cpf';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.usuario.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await app.close();
  });

  function buildRegisterPayload() {
    const unique = `${Date.now()}-${Math.random()}`;
    return {
      nome: 'Marcos Teste',
      email: `auth-e2e-${unique}@example.com`,
      cpf: randomValidCpf(),
      senha: 'password123',
    };
  }

  it('registers, logs in, refreshes, reads /me and logs out', async () => {
    const payload = buildRegisterPayload();

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    expect(registerResponse.body.usuario.email).toBe(payload.email);
    expect(registerResponse.body.accessToken).toEqual(expect.any(String));
    expect(registerResponse.body.refreshToken).toEqual(expect.any(String));
    createdUserIds.push(registerResponse.body.usuario.id);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: payload.email, senha: payload.senha })
      .expect(200);

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200);

    expect(meResponse.body.email).toBe(payload.email);

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(200);

    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refreshResponse.body.accessToken}`)
      .send({ refreshToken: refreshResponse.body.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refreshResponse.body.refreshToken })
      .expect(401);
  });

  it('rejects registering a duplicate email/cpf', async () => {
    const payload = buildRegisterPayload();

    const first = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);
    createdUserIds.push(first.body.usuario.id);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...payload, cpf: randomValidCpf() })
      .expect(409);
  });

  it('rejects login with wrong password', async () => {
    const payload = buildRegisterPayload();

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);
    createdUserIds.push(registerResponse.body.usuario.id);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: payload.email, senha: 'wrong-password' })
      .expect(401);
  });
});
