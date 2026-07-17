import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDeducaoCarneLeaoDto } from './create-deducao-carne-leao.dto';

describe('CreateDeducaoCarneLeaoDto', () => {
  const valid = {
    tipo: 'INSS_AUTONOMO',
    valor: 500,
    competencia: '2026-07-01',
  };

  it('aceita uma dedução INSS válida', async () => {
    const dto = plainToInstance(CreateDeducaoCarneLeaoDto, valid);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('aceita PGBL com anexoUrl', async () => {
    const dto = plainToInstance(CreateDeducaoCarneLeaoDto, {
      ...valid,
      tipo: 'PGBL',
      anexoUrl: 'https://exemplo.com/comprovante.pdf',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita o tipo LIVRO_CAIXA (a dedução de livro-caixa é sempre automática)', async () => {
    const dto = plainToInstance(CreateDeducaoCarneLeaoDto, {
      ...valid,
      tipo: 'LIVRO_CAIXA',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('rejeita um tipo desconhecido', async () => {
    const dto = plainToInstance(CreateDeducaoCarneLeaoDto, {
      ...valid,
      tipo: 'INVALIDO',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('rejeita um valor não positivo', async () => {
    const dto = plainToInstance(CreateDeducaoCarneLeaoDto, { ...valid, valor: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });
});
