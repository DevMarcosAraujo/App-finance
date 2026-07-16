import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateTransacaoDto } from './update-transacao.dto';

describe('UpdateTransacaoDto', () => {
  it('accepts an empty object (no fields required)', async () => {
    const dto = plainToInstance(UpdateTransacaoDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a partial update of just valor', async () => {
    const dto = plainToInstance(UpdateTransacaoDto, { valor: 99.9 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid tipo when provided', async () => {
    const dto = plainToInstance(UpdateTransacaoDto, { tipo: 'INVALIDO' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('rejects a non-positive valor when provided', async () => {
    const dto = plainToInstance(UpdateTransacaoDto, { valor: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });
});
