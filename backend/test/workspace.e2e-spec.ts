import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomValidCpf } from './fixtures/cpf';

describe('Workspace (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

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
    if (createdWorkspaceIds.length > 0) {
      await prisma.workspace.deleteMany({
        where: { id: { in: createdWorkspaceIds } },
      });
    }
    await app.close();
  });

  async function registerAndLogin(): Promise<string> {
    const unique = `${Date.now()}-${Math.random()}`;
    const payload = {
      nome: 'Marcos Teste',
      email: `workspace-e2e-${unique}@example.com`,
      cpf: randomValidCpf(),
      senha: 'password123',
    };

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    createdUserIds.push(response.body.usuario.id);
    return response.body.accessToken as string;
  }

  it('has no workspace right after registering', async () => {
    const accessToken = await registerAndLogin();

    await request(app.getHttpServer())
      .get('/workspaces/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('creates a workspace and returns it from /workspaces/me', async () => {
    const accessToken = await registerAndLogin();

    const createResponse = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'FAMILIA' })
      .expect(201);

    createdWorkspaceIds.push(createResponse.body.id);
    expect(createResponse.body.plano.tipo).toBe('FAMILIA');
    expect(createResponse.body.nome).toEqual(expect.any(String));

    const meResponse = await request(app.getHttpServer())
      .get('/workspaces/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body.id).toBe(createResponse.body.id);
  });

  it('rejects creating a second workspace for the same user', async () => {
    const accessToken = await registerAndLogin();

    const firstResponse = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'INDIVIDUAL' })
      .expect(201);
    createdWorkspaceIds.push(firstResponse.body.id);

    await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'INDIVIDUAL' })
      .expect(409);
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/workspaces/me').expect(401);
  });
});
