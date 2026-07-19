import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateFaturamentoMensalPjDto } from './update-faturamento-mensal-pj.dto';

describe('UpdateFaturamentoMensalPjDto', () => {
  it('aceita objeto vazio', async () => {
    const dto = plainToInstance(UpdateFaturamentoMensalPjDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita receitaBrutaTotal negativa', async () => {
    const dto = plainToInstance(UpdateFaturamentoMensalPjDto, { receitaBrutaTotal: -5 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'receitaBrutaTotal')).toBe(true);
  });
});
