import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateFaturamentoMensalPjDto } from './create-faturamento-mensal-pj.dto';

describe('CreateFaturamentoMensalPjDto', () => {
  const base = {
    empresaId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    receitaBrutaTotal: 5000,
    competencia: '2026-07-01',
  };

  it('aceita o mínimo obrigatório', async () => {
    const dto = plainToInstance(CreateFaturamentoMensalPjDto, base);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('aceita receitaBrutaTotal igual a zero', async () => {
    const dto = plainToInstance(CreateFaturamentoMensalPjDto, { ...base, receitaBrutaTotal: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita receitaBrutaTotal negativa', async () => {
    const dto = plainToInstance(CreateFaturamentoMensalPjDto, { ...base, receitaBrutaTotal: -1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'receitaBrutaTotal')).toBe(true);
  });

  it('rejeita empresaId que não é UUID', async () => {
    const dto = plainToInstance(CreateFaturamentoMensalPjDto, { ...base, empresaId: 'abc' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'empresaId')).toBe(true);
  });
});
