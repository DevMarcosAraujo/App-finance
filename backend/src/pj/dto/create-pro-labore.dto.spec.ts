import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProLaboreDto } from './create-pro-labore.dto';

describe('CreateProLaboreDto', () => {
  const base = {
    empresaId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    valor: 3000,
    inssRetido: 330,
    competencia: '2026-07-01',
  };

  it('aceita o payload válido', async () => {
    const dto = plainToInstance(CreateProLaboreDto, base);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('aceita inssRetido igual a zero', async () => {
    const dto = plainToInstance(CreateProLaboreDto, { ...base, inssRetido: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita valor zero ou negativo', async () => {
    const dto = plainToInstance(CreateProLaboreDto, { ...base, valor: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });

  it('rejeita inssRetido negativo', async () => {
    const dto = plainToInstance(CreateProLaboreDto, { ...base, inssRetido: -1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'inssRetido')).toBe(true);
  });
});
