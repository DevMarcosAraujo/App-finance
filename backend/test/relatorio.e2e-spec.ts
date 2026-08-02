import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomValidCpf } from './fixtures/cpf';

describe('Relatorio (e2e)', () => {
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
    await prisma.relatorioGerado.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
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

  async function registrarUsuario(): Promise<{
    accessToken: string;
    usuarioId: string;
  }> {
    const unique = `${Date.now()}-${Math.random()}`;
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nome: 'Relatorio Teste',
        email: `relatorio-e2e-${unique}@example.com`,
        cpf: randomValidCpf(),
        senha: 'password123',
      })
      .expect(201);

    createdUserIds.push(response.body.usuario.id);
    return {
      accessToken: response.body.accessToken as string,
      usuarioId: response.body.usuario.id as string,
    };
  }

  async function registrarComWorkspace(): Promise<string> {
    const { accessToken } = await registrarUsuario();

    const workspaceResponse = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'INDIVIDUAL' })
      .expect(201);

    createdWorkspaceIds.push(workspaceResponse.body.id);
    return accessToken;
  }

  it('rejeita uma requisição sem autenticação (JwtAuthGuard)', async () => {
    await request(app.getHttpServer())
      .post('/relatorios')
      .send({
        tipo: 'MENSAL',
        periodoInicio: '2026-07-01',
        periodoFim: '2026-08-01',
      })
      .expect(401);
  });

  it('rejeita um usuário autenticado sem workspace (WorkspaceGuard)', async () => {
    const { accessToken } = await registrarUsuario();

    await request(app.getHttpServer())
      .post('/relatorios')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tipo: 'MENSAL',
        periodoInicio: '2026-07-01',
        periodoFim: '2026-08-01',
      })
      .expect(403);
  });

  it('gera um relatório para um usuário autenticado com workspace', async () => {
    const accessToken = await registrarComWorkspace();

    const response = await request(app.getHttpServer())
      .post('/relatorios')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tipo: 'MENSAL',
        periodoInicio: '2026-07-01',
        periodoFim: '2026-08-01',
      })
      .expect(201);

    expect(response.body.id).toEqual(expect.any(String));
  });

  it('isola o arquivo do relatório por workspace (404 para outro usuário)', async () => {
    const accessTokenA = await registrarComWorkspace();
    const accessTokenB = await registrarComWorkspace();

    const gerarResponse = await request(app.getHttpServer())
      .post('/relatorios')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send({
        tipo: 'MENSAL',
        periodoInicio: '2026-07-01',
        periodoFim: '2026-08-01',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/relatorios/${gerarResponse.body.id}/arquivo`)
      .set('Authorization', `Bearer ${accessTokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/relatorios/${gerarResponse.body.id}/arquivo`)
      .set('Authorization', `Bearer ${accessTokenA}`)
      .expect(200);
  });
});
