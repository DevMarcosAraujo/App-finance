import { TipoRelatorio } from '@prisma/client';
import { renderRelatorioPdf } from './relatorio.pdf';

describe('renderRelatorioPdf', () => {
  it('gera um buffer de PDF válido para uma agregação com dados', async () => {
    const buffer = await renderRelatorioPdf({
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
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('gera um buffer de PDF válido para agregação vazia', async () => {
    const buffer = await renderRelatorioPdf({
      tipo: TipoRelatorio.ANUAL,
      periodoInicio: new Date('2026-01-01T00:00:00.000Z'),
      periodoFim: new Date('2027-01-01T00:00:00.000Z'),
      agregado: {
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0,
        porCategoria: [],
      },
    });

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
