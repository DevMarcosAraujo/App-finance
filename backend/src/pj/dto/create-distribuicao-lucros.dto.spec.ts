import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDistribuicaoLucrosDto } from './create-distribuicao-lucros.dto';

describe('CreateDistribuicaoLucrosDto', () => {
  const base = {
    empresaId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    valor: 10000,
    competencia: '2026-07-01',
  };

  it('aceita o payload válido', async () => {
    const dto = plainToInstance(CreateDistribuicaoLucrosDto, base);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita valor zero ou negativo', async () => {
    const dto = plainToInstance(CreateDistribuicaoLucrosDto, { ...base, valor: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });

  it('rejeita competencia que não é data', async () => {
    const dto = plainToInstance(CreateDistribuicaoLucrosDto, { ...base, competencia: 'abc' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'competencia')).toBe(true);
  });
});
