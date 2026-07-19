import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProLaboreDto } from './update-pro-labore.dto';

describe('UpdateProLaboreDto', () => {
  it('aceita objeto vazio', async () => {
    const dto = plainToInstance(UpdateProLaboreDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita valor zero', async () => {
    const dto = plainToInstance(UpdateProLaboreDto, { valor: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });
});
