import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomValidCpf } from './fixtures/cpf';
import { randomValidCnpj } from './fixtures/cnpj';

describe('Pj (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdEmpresaIds: string[] = [];
  const ANO_TESTE = 2032;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    // Valores de teste ilustrativos — não são os valores oficiais de 2026.
    await prisma.parametroFiscalPJ.create({
      data: {
        anoCalendario: ANO_TESTE,
        meiLimiteAnual: 81000,
        meiDasComercioIndustria: 82.05,
        meiDasServicos: 86.05,
        meiDasComercioServicos: 87.05,
        limiteDividendoIsentoMensal: 50000,
        aliquotaDividendoExcedente: 0.1,
      },
    });
    await prisma.anexoSimplesTabela.create({
      data: {
        anoCalendario: ANO_TESTE,
        anexo: 'III',
        faixas: [
          { rbt12Ate: 180000, aliquota: 0.06, parcelaDeduzir: 0 },
          { rbt12Ate: 360000, aliquota: 0.112, parcelaDeduzir: 9360 },
        ],
      },
    });
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
    if (createdEmpresaIds.length > 0) {
      // onDelete: Cascade no schema já remove faturamentos, RBT12, DAS,
      // pró-labores e distribuições junto com a empresa.
      await prisma.empresa.deleteMany({ where: { id: { in: createdEmpresaIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.usuario.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.anexoSimplesTabela.deleteMany({ where: { anoCalendario: ANO_TESTE } });
    await prisma.parametroFiscalPJ.delete({ where: { anoCalendario: ANO_TESTE } });
    await prisma.parametroFiscalPF.delete({ where: { anoCalendario: ANO_TESTE } });
    await app.close();
  });

  async function registrarUsuario(): Promise<string> {
    const unique = `${Date.now()}-${Math.random()}`;
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nome: 'PJ Teste',
        email: `pj-e2e-${unique}@example.com`,
        cpf: randomValidCpf(),
        senha: 'password123',
      })
      .expect(201);

    createdUserIds.push(response.body.usuario.id);
    return response.body.accessToken as string;
  }

  it('fluxo MEI: cadastra empresa, lança faturamento, apura DAS fixo e acompanha o limite anual', async () => {
    const accessToken = await registrarUsuario();

    const empresaResponse = await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        cnpj: randomValidCnpj(),
        nome: 'Marcos MEI',
        regime: 'MEI',
        atividadeTipo: 'SERVICO',
        dataAbertura: `${ANO_TESTE}-01-01`,
      })
      .expect(201);
    const empresaId = empresaResponse.body.id as string;
    createdEmpresaIds.push(empresaId);

    await request(app.getHttpServer())
      .post('/faturamentos-pj')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ empresaId, receitaBrutaTotal: 5000, competencia: `${ANO_TESTE}-01-10` })
      .expect(201);

    const das = await request(app.getHttpServer())
      .get(`/das-apuracoes?empresaId=${empresaId}&ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(das.body.valorDevido).toBe(86.05); // MEI serviço, valor fixo
    expect(das.body.detalheCalculo.tipo).toBe('fixo');

    const limiteMei = await request(app.getHttpServer())
      .get(`/acompanhamento-limite-mei?empresaId=${empresaId}&ano=${ANO_TESTE}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    // 12 meses de atividade (aberta em janeiro) -> limiteProporcional = 81000
    // receita 5000 -> percentual = 5000/81000 ≈ 0.0617 -> ok
    expect(limiteMei.body.limiteProporcional).toBe(81000);
    expect(limiteMei.body.alerta).toBe('ok');
  });

  it('fluxo SIMPLES_ME: calcula RBT12 proporcional e o DAS pela faixa do Anexo, lança pró-labore e distribuição de lucros', async () => {
    const accessToken = await registrarUsuario();

    const empresaResponse = await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        cnpj: randomValidCnpj(),
        nome: 'Esposa ME',
        regime: 'SIMPLES_ME',
        atividadeTipo: 'SERVICO',
        anexoSimples: 'III',
        dataAbertura: `${ANO_TESTE}-01-01`,
      })
      .expect(201);
    const empresaId = empresaResponse.body.id as string;
    createdEmpresaIds.push(empresaId);

    await request(app.getHttpServer())
      .post('/faturamentos-pj')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ empresaId, receitaBrutaTotal: 15000, competencia: `${ANO_TESTE}-01-10` })
      .expect(201);

    const das = await request(app.getHttpServer())
      .get(`/das-apuracoes?empresaId=${empresaId}&ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    // 1 mês de atividade -> RBT12 proporcional = (15000/1)*12 = 180000
    // faixa até 180000, aliquota 6%, parcela 0 -> aliquotaEfetiva = 0.06
    // valorDevido = 15000 * 0.06 = 900
    expect(das.body.detalheCalculo.rbt12).toBe(180000);
    expect(das.body.valorDevido).toBe(900);

    const proLaboreResponse = await request(app.getHttpServer())
      .post('/pro-labores')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ empresaId, valor: 3500, inssRetido: 385, competencia: `${ANO_TESTE}-01-10` })
      .expect(201);
    // valor 3500 > faixaReducaoAte(3000) -> faixa 20%: 3500*0.2-400 = 300
    expect(proLaboreResponse.body.irrfRetido).toBe(300);
    expect(proLaboreResponse.body.inssRetido).toBe(385);

    const distribuicaoResponse = await request(app.getHttpServer())
      .post('/distribuicoes-lucros')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ empresaId, valor: 60000, competencia: `${ANO_TESTE}-01-10` })
      .expect(201);
    // valor 60000 > limiteDividendoIsentoMensal(50000) -> não isento,
    // retenção de 10% sobre o valor total (60000 * 0.1 = 6000)
    expect(distribuicaoResponse.body.isento).toBe(false);
    expect(distribuicaoResponse.body.impostoRetido).toBe(6000);
  });

  it('rejeita editar ou excluir a empresa de outro usuário', async () => {
    const tokenA = await registrarUsuario();
    const tokenB = await registrarUsuario();

    const empresaResponse = await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        cnpj: randomValidCnpj(),
        nome: 'Empresa A',
        regime: 'MEI',
        atividadeTipo: 'COMERCIO',
        dataAbertura: `${ANO_TESTE}-01-01`,
      })
      .expect(201);
    const empresaId = empresaResponse.body.id as string;
    createdEmpresaIds.push(empresaId);

    await request(app.getHttpServer())
      .patch(`/empresas/${empresaId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ nome: 'Tentativa de invasão' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/empresas/${empresaId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('rejeita uma requisição sem autenticação', async () => {
    await request(app.getHttpServer()).get('/empresas').expect(401);
  });
});
