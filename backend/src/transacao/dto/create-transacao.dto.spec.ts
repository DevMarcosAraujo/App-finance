import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTransacaoDto } from './create-transacao.dto';

describe('CreateTransacaoDto', () => {
  const valid = {
    tipo: 'DESPESA',
    valor: 42.5,
    data: '2026-07-15',
  };

  it('accepts a valid despesa without categoria/descricao', async () => {
    const dto = plainToInstance(CreateTransacaoDto, valid);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a valid receita with categoria and descricao', async () => {
    const dto = plainToInstance(CreateTransacaoDto, {
      ...valid,
      tipo: 'RECEITA',
      categoriaId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      descricao: 'salário de julho',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid tipo', async () => {
    const dto = plainToInstance(CreateTransacaoDto, {
      ...valid,
      tipo: 'INVALIDO',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('rejects a non-positive valor', async () => {
    const dto = plainToInstance(CreateTransacaoDto, { ...valid, valor: -10 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });

  it('rejects an invalid categoriaId', async () => {
    const dto = plainToInstance(CreateTransacaoDto, {
      ...valid,
      categoriaId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categoriaId')).toBe(true);
  });

  it('rejects a missing data', async () => {
    const { data: _data, ...withoutData } = valid;
    const dto = plainToInstance(CreateTransacaoDto, withoutData);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'data')).toBe(true);
  });
});
