// Standalone script run via ts-node in a child process by relatorio.pdf.spec.ts.
// Renders a fixed fixture and writes the raw PDF bytes to the file path given as argv[2].
import * as fs from 'node:fs';
import { TipoRelatorio } from '@prisma/client';
import { renderRelatorioPdf } from './relatorio.pdf';

async function main() {
  const outputPath = process.argv[2];
  const cenario = process.argv[3]; // 'com-dados' | 'vazio'

  const dados =
    cenario === 'vazio'
      ? {
          tipo: TipoRelatorio.ANUAL,
          periodoInicio: new Date('2026-01-01T00:00:00.000Z'),
          periodoFim: new Date('2027-01-01T00:00:00.000Z'),
          agregado: {
            totalReceitas: 0,
            totalDespesas: 0,
            saldo: 0,
            porCategoria: [],
          },
        }
      : {
          tipo: TipoRelatorio.MENSAL,
          periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
          periodoFim: new Date('2026-08-01T00:00:00.000Z'),
          agregado: {
            totalReceitas: 1000,
            totalDespesas: 350,
            saldo: 650,
            porCategoria: [
              {
                categoriaId: 'cat-1',
                categoriaNome: 'Salário',
                totalReceitas: 1000,
                totalDespesas: 0,
              },
            ],
          },
        };

  const buffer = await renderRelatorioPdf(dados);
  fs.writeFileSync(outputPath, buffer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
