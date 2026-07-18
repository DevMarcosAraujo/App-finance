import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomValidCpf } from './fixtures/cpf';

describe('CarneLeao (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const ANO_TESTE = 2031;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    // Valores de teste ilustrativos — não são os valores oficiais de 2026.
    await prisma.parametroFiscalPF.create({
      data: {
        anoCalendario: ANO_TESTE,
        faixaIsencaoMensal: 2000,
        faixaReducaoAte: 3000,
        tetoEducacaoAnual: 3561.5,
        valorDependenteMensal: 189.59,
        descontoSimplificadoMensal: 500,
        limiteObrigatoriedadeDeclaracao: 35584,
        tabelaProgressivaMensal: [
          { ate: 2000, aliquota: 0, parcelaDeduzir: 0 },
          { ate: 3000, aliquota: 0.1, parcelaDeduzir: 100 },
          { ate: 999999999, aliquota: 0.2, parcelaDeduzir: 400 },
        ],
      },
    });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.rendimentoAutonomo.deleteMany({ where: { usuarioId: { in: createdUserIds } } });
      await prisma.deducaoCarneLeao.deleteMany({ where: { usuarioId: { in: createdUserIds } } });
      await prisma.livroCaixaLancamento.deleteMany({ where: { usuarioId: { in: createdUserIds } } });
      await prisma.apuracaoMensalCarneLeao.deleteMany({ where: { usuarioId: { in: createdUserIds } } });
      await prisma.usuario.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.parametroFiscalPF.delete({ where: { anoCalendario: ANO_TESTE } });
    await app.close();
  });

  async function registrarUsuario(): Promise<string> {
    const unique = `${Date.now()}-${Math.random()}`;
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nome: 'Carne Leao Teste',
        email: `carne-leao-e2e-${unique}@example.com`,
        cpf: randomValidCpf(),
        senha: 'password123',
      })
      .expect(201);

    createdUserIds.push(response.body.usuario.id);
    return response.body.accessToken as string;
  }

  it('lança rendimento, dedução e livro-caixa, e a apuração reflete cada mudança', async () => {
    const accessToken = await registrarUsuario();

    await request(app.getHttpServer())
      .post('/rendimentos-autonomos')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tipo: 'HONORARIO',
        fontePagadoraCpf: randomValidCpf(),
        valorBruto: 6000,
        competencia: `${ANO_TESTE}-01-10`,
      })
      .expect(201);

    let apuracao = await request(app.getHttpServer())
      .get(`/apuracoes-carne-leao?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(apuracao.body.baseCalculo).toBe(5500); // 6000 - max(0, 500)

    const deducaoResponse = await request(app.getHttpServer())
      .post('/deducoes-carne-leao')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'INSS_AUTONOMO', valor: 1000, competencia: `${ANO_TESTE}-01-10` })
      .expect(201);

    apuracao = await request(app.getHttpServer())
      .get(`/apuracoes-carne-leao?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(apuracao.body.baseCalculo).toBe(5000); // 6000 - max(1000, 500)

    await request(app.getHttpServer())
      .post('/livro-caixa')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        descricao: 'aluguel do escritório',
        categoria: 'aluguel_escritorio',
        valor: 300,
        competencia: `${ANO_TESTE}-01-10`,
      })
      .expect(201);

    apuracao = await request(app.getHttpServer())
      .get(`/apuracoes-carne-leao?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(apuracao.body.baseCalculo).toBe(4700); // 6000 - max(1000+300, 500)

    const rendimentosList = await request(app.getHttpServer())
      .get(`/rendimentos-autonomos?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(rendimentosList.body).toHaveLength(1);

    await request(app.getHttpServer())
      .patch(`/deducoes-carne-leao/${deducaoResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ valor: 1200 })
      .expect(200);

    apuracao = await request(app.getHttpServer())
      .get(`/apuracoes-carne-leao?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(apuracao.body.baseCalculo).toBe(4500); // 6000 - max(1200+300, 500)

    await request(app.getHttpServer())
      .delete(`/deducoes-carne-leao/${deducaoResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    apuracao = await request(app.getHttpServer())
      .get(`/apuracoes-carne-leao?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(apuracao.body.baseCalculo).toBe(5500); // 6000 - max(300, 500), dedução excluída
  });

  it('rejeita editar ou excluir um rendimento de outro usuário', async () => {
    const tokenA = await registrarUsuario();
    const tokenB = await registrarUsuario();

    const createResponse = await request(app.getHttpServer())
      .post('/rendimentos-autonomos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        tipo: 'ALUGUEL_PF',
        fontePagadoraCpf: randomValidCpf(),
        valorBruto: 1000,
        competencia: `${ANO_TESTE}-02-01`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/rendimentos-autonomos/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ valorBruto: 2000 })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/rendimentos-autonomos/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('rejeita uma requisição sem autenticação', async () => {
    await request(app.getHttpServer())
      .get(`/rendimentos-autonomos?ano=${ANO_TESTE}&mes=1`)
      .expect(401);
  });
});
