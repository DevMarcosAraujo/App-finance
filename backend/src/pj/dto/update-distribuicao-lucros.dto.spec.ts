import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateDistribuicaoLucrosDto } from './update-distribuicao-lucros.dto';

describe('UpdateDistribuicaoLucrosDto', () => {
  it('aceita objeto vazio', async () => {
    const dto = plainToInstance(UpdateDistribuicaoLucrosDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita valor negativo', async () => {
    const dto = plainToInstance(UpdateDistribuicaoLucrosDto, { valor: -1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });
});
