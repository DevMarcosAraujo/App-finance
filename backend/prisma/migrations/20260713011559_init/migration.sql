-- CreateEnum
CREATE TYPE "PlanoTipo" AS ENUM ('INDIVIDUAL', 'FAMILIA');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('DONO', 'MEMBRO');

-- CreateEnum
CREATE TYPE "TransacaoTipo" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "EmissorTipo" AS ENUM ('CPF', 'CNPJ');

-- CreateEnum
CREATE TYPE "TipoDocumentoFiscal" AS ENUM ('NOTA_FISCAL', 'RECIBO');

-- CreateEnum
CREATE TYPE "CategoriaDedutivel" AS ENUM ('SAUDE', 'EDUCACAO', 'PREVIDENCIA_PRIVADA', 'OUTROS_NAO_DEDUTIVEL');

-- CreateEnum
CREATE TYPE "TipoBem" AS ENUM ('IMOVEL', 'VEICULO', 'CONTA_INVESTIMENTO', 'SALDO_CONTA', 'OUTROS');

-- CreateEnum
CREATE TYPE "TipoRendimentoAutonomo" AS ENUM ('HONORARIO', 'ALUGUEL_PF', 'PENSAO_RECEBIDA', 'EXTERIOR');

-- CreateEnum
CREATE TYPE "TipoDeducaoCarneLeao" AS ENUM ('INSS_AUTONOMO', 'PENSAO_JUDICIAL', 'PGBL', 'LIVRO_CAIXA');

-- CreateEnum
CREATE TYPE "StatusApuracao" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO');

-- CreateEnum
CREATE TYPE "RegimeEmpresa" AS ENUM ('MEI', 'SIMPLES_ME');

-- CreateEnum
CREATE TYPE "AtividadeEmpresa" AS ENUM ('COMERCIO', 'INDUSTRIA', 'SERVICO', 'COMERCIO_SERVICO');

-- CreateEnum
CREATE TYPE "AnexoSimples" AS ENUM ('I', 'II', 'III', 'IV', 'V');

-- CreateEnum
CREATE TYPE "TipoRelatorio" AS ENUM ('MENSAL', 'BIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos" (
    "id" TEXT NOT NULL,
    "tipo" "PlanoTipo" NOT NULL,
    "nome" TEXT NOT NULL,
    "precoBase" DECIMAL(10,2) NOT NULL,
    "precoPorMembro" DECIMAL(10,2),
    "limiteMembros" INTEGER,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_membros" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBRO',
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT,
    "icone" TEXT,
    "sistema" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacoes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "categoriaId" TEXT,
    "tipo" "TransacaoTipo" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "descricao" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios_gerados" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tipo" "TipoRelatorio" NOT NULL,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFim" TIMESTAMP(3) NOT NULL,
    "arquivoPdfUrl" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorios_gerados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_fiscais_pf" (
    "id" TEXT NOT NULL,
    "anoCalendario" INTEGER NOT NULL,
    "faixaIsencaoMensal" DECIMAL(10,2) NOT NULL,
    "faixaReducaoAte" DECIMAL(10,2) NOT NULL,
    "tetoEducacaoAnual" DECIMAL(10,2) NOT NULL,
    "valorDependenteMensal" DECIMAL(10,2) NOT NULL,
    "descontoSimplificadoMensal" DECIMAL(10,2) NOT NULL,
    "limiteObrigatoriedadeDeclaracao" DECIMAL(10,2) NOT NULL,
    "tabelaProgressivaMensal" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametros_fiscais_pf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_fiscais" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "emissorTipo" "EmissorTipo" NOT NULL,
    "emissorDocumento" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumentoFiscal" NOT NULL,
    "categoria" "CategoriaDedutivel" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "anexoUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bens_direitos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoBem" NOT NULL,
    "descricao" TEXT NOT NULL,
    "codigoReceita" TEXT,
    "valorAquisicao" DECIMAL(14,2) NOT NULL,
    "valorAnoAnterior" DECIMAL(14,2),
    "valorAnoAtual" DECIMAL(14,2),
    "anoReferencia" INTEGER NOT NULL,

    CONSTRAINT "bens_direitos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rendimentos_autonomos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoRendimentoAutonomo" NOT NULL,
    "fontePagadoraCpf" TEXT,
    "valorBruto" DECIMAL(12,2) NOT NULL,
    "documentoFiscalId" TEXT,

    CONSTRAINT "rendimentos_autonomos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deducoes_carne_leao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoDeducaoCarneLeao" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "anexoUrl" TEXT,

    CONSTRAINT "deducoes_carne_leao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "livro_caixa_lancamentos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "livro_caixa_lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apuracoes_mensais_carne_leao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "rendimentoBrutoTotal" DECIMAL(12,2) NOT NULL,
    "deducoesTotal" DECIMAL(12,2) NOT NULL,
    "baseCalculo" DECIMAL(12,2) NOT NULL,
    "aliquotaEfetiva" DECIMAL(6,4),
    "impostoDevido" DECIMAL(12,2) NOT NULL,
    "codigoReceita" TEXT NOT NULL DEFAULT '0190',
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusApuracao" NOT NULL DEFAULT 'PENDENTE',
    "calculoIncerto" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apuracoes_mensais_carne_leao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_fiscais_pj" (
    "id" TEXT NOT NULL,
    "anoCalendario" INTEGER NOT NULL,
    "meiLimiteAnual" DECIMAL(12,2) NOT NULL,
    "meiDasComercioIndustria" DECIMAL(8,2) NOT NULL,
    "meiDasServicos" DECIMAL(8,2) NOT NULL,
    "meiDasComercioServicos" DECIMAL(8,2) NOT NULL,
    "limiteDividendoIsentoMensal" DECIMAL(12,2) NOT NULL,
    "aliquotaDividendoExcedente" DECIMAL(6,4) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametros_fiscais_pj_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexos_simples_tabelas" (
    "id" TEXT NOT NULL,
    "anoCalendario" INTEGER NOT NULL,
    "anexo" "AnexoSimples" NOT NULL,
    "faixas" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_simples_tabelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "regime" "RegimeEmpresa" NOT NULL,
    "atividadeTipo" "AtividadeEmpresa" NOT NULL,
    "anexoSimples" "AnexoSimples",
    "dataAbertura" TIMESTAMP(3) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturamentos_mensais_pj" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "receitaBrutaTotal" DECIMAL(12,2) NOT NULL,
    "receitaComNota" DECIMAL(12,2),
    "receitaSemNota" DECIMAL(12,2),
    "clienteTipoPredominante" "EmissorTipo",

    CONSTRAINT "faturamentos_mensais_pj_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rbt12_cache" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "rbt12Calculado" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "rbt12_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "das_apuracoes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "regimeNoMomento" "RegimeEmpresa" NOT NULL,
    "valorDevido" DECIMAL(12,2) NOT NULL,
    "detalheCalculo" JSONB NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusApuracao" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "das_apuracoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labores" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "inssRetido" DECIMAL(12,2) NOT NULL,
    "irrfRetido" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "pro_labores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribuicoes_lucros" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "isento" BOOLEAN NOT NULL,
    "impostoRetido" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "distribuicoes_lucros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acompanhamentos_limite_mei" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "anoCalendario" INTEGER NOT NULL,
    "limiteProporcional" DECIMAL(12,2) NOT NULL,
    "receitaAcumuladaAno" DECIMAL(12,2) NOT NULL,
    "percentualAtingido" DECIMAL(6,4) NOT NULL,
    "alerta" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acompanhamentos_limite_mei_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_membros_workspaceId_usuarioId_key" ON "workspace_membros"("workspaceId", "usuarioId");

-- CreateIndex
CREATE INDEX "transacoes_workspaceId_data_idx" ON "transacoes"("workspaceId", "data");

-- CreateIndex
CREATE INDEX "transacoes_usuarioId_data_idx" ON "transacoes"("usuarioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_fiscais_pf_anoCalendario_key" ON "parametros_fiscais_pf"("anoCalendario");

-- CreateIndex
CREATE INDEX "documentos_fiscais_usuarioId_competencia_idx" ON "documentos_fiscais"("usuarioId", "competencia");

-- CreateIndex
CREATE INDEX "bens_direitos_usuarioId_anoReferencia_idx" ON "bens_direitos"("usuarioId", "anoReferencia");

-- CreateIndex
CREATE INDEX "rendimentos_autonomos_usuarioId_competencia_idx" ON "rendimentos_autonomos"("usuarioId", "competencia");

-- CreateIndex
CREATE INDEX "deducoes_carne_leao_usuarioId_competencia_idx" ON "deducoes_carne_leao"("usuarioId", "competencia");

-- CreateIndex
CREATE INDEX "livro_caixa_lancamentos_usuarioId_competencia_idx" ON "livro_caixa_lancamentos"("usuarioId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "apuracoes_mensais_carne_leao_usuarioId_competencia_key" ON "apuracoes_mensais_carne_leao"("usuarioId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_fiscais_pj_anoCalendario_key" ON "parametros_fiscais_pj"("anoCalendario");

-- CreateIndex
CREATE UNIQUE INDEX "anexos_simples_tabelas_anoCalendario_anexo_key" ON "anexos_simples_tabelas"("anoCalendario", "anexo");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE INDEX "empresas_usuarioId_idx" ON "empresas"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "faturamentos_mensais_pj_empresaId_competencia_key" ON "faturamentos_mensais_pj"("empresaId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "rbt12_cache_empresaId_competencia_key" ON "rbt12_cache"("empresaId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "das_apuracoes_empresaId_competencia_key" ON "das_apuracoes"("empresaId", "competencia");

-- CreateIndex
CREATE INDEX "pro_labores_empresaId_competencia_idx" ON "pro_labores"("empresaId", "competencia");

-- CreateIndex
CREATE INDEX "distribuicoes_lucros_empresaId_competencia_idx" ON "distribuicoes_lucros"("empresaId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "acompanhamentos_limite_mei_empresaId_anoCalendario_key" ON "acompanhamentos_limite_mei"("empresaId", "anoCalendario");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "planos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_membros" ADD CONSTRAINT "workspace_membros_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_membros" ADD CONSTRAINT "workspace_membros_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_gerados" ADD CONSTRAINT "relatorios_gerados_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscais" ADD CONSTRAINT "documentos_fiscais_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bens_direitos" ADD CONSTRAINT "bens_direitos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendimentos_autonomos" ADD CONSTRAINT "rendimentos_autonomos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deducoes_carne_leao" ADD CONSTRAINT "deducoes_carne_leao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "livro_caixa_lancamentos" ADD CONSTRAINT "livro_caixa_lancamentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apuracoes_mensais_carne_leao" ADD CONSTRAINT "apuracoes_mensais_carne_leao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturamentos_mensais_pj" ADD CONSTRAINT "faturamentos_mensais_pj_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rbt12_cache" ADD CONSTRAINT "rbt12_cache_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "das_apuracoes" ADD CONSTRAINT "das_apuracoes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labores" ADD CONSTRAINT "pro_labores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribuicoes_lucros" ADD CONSTRAINT "distribuicoes_lucros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acompanhamentos_limite_mei" ADD CONSTRAINT "acompanhamentos_limite_mei_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
