import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomValidCpf } from './fixtures/cpf';

describe('Transacao (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];
  const createdTransacaoIds: string[] = [];

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
    if (createdTransacaoIds.length > 0) {
      await prisma.transacao.deleteMany({
        where: { id: { in: createdTransacaoIds } },
      });
    }
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

  async function registerComWorkspace(): Promise<string> {
    const unique = `${Date.now()}-${Math.random()}`;
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nome: 'Transacao Teste',
        email: `transacao-e2e-${unique}@example.com`,
        cpf: randomValidCpf(),
        senha: 'password123',
      })
      .expect(201);

    createdUserIds.push(registerResponse.body.usuario.id);
    const accessToken = registerResponse.body.accessToken as string;

    const workspaceResponse = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'INDIVIDUAL' })
      .expect(201);

    createdWorkspaceIds.push(workspaceResponse.body.id);
    return accessToken;
  }

  it('lists the seeded system categorias', async () => {
    const accessToken = await registerComWorkspace();

    const response = await request(app.getHttpServer())
      .get('/categorias')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.length).toBeGreaterThanOrEqual(10);
    expect(
      response.body.some((c: { nome: string }) => c.nome === 'Outros'),
    ).toBe(true);
  });

  it('creates, lists by month, updates and deletes a transacao', async () => {
    const accessToken = await registerComWorkspace();

    const createResponse = await request(app.getHttpServer())
      .post('/transacoes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tipo: 'DESPESA',
        valor: 50.25,
        data: '2026-07-10',
        descricao: 'mercado',
      })
      .expect(201);

    createdTransacaoIds.push(createResponse.body.id);
    expect(createResponse.body.valor).toBe(50.25);

    const listResponse = await request(app.getHttpServer())
      .get('/transacoes?ano=2026&mes=7')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(createResponse.body.id);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/transacoes/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ descricao: 'mercado do mês' })
      .expect(200);

    expect(updateResponse.body.descricao).toBe('mercado do mês');

    await request(app.getHttpServer())
      .delete(`/transacoes/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get('/transacoes?ano=2026&mes=7')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listAfterDelete.body).toHaveLength(0);
    createdTransacaoIds.pop();
  });

  it('rejects editing or deleting a transacao from another workspace', async () => {
    const tokenA = await registerComWorkspace();
    const tokenB = await registerComWorkspace();

    const createResponse = await request(app.getHttpServer())
      .post('/transacoes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tipo: 'RECEITA', valor: 1000, data: '2026-07-01' })
      .expect(201);

    createdTransacaoIds.push(createResponse.body.id);

    await request(app.getHttpServer())
      .patch(`/transacoes/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ descricao: 'tentativa indevida' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/transacoes/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer())
      .get('/transacoes?ano=2026&mes=7')
      .expect(401);
  });
});
