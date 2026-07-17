import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateDeducaoCarneLeaoDto } from './update-deducao-carne-leao.dto';

describe('UpdateDeducaoCarneLeaoDto', () => {
  it('aceita um objeto vazio', async () => {
    const dto = plainToInstance(UpdateDeducaoCarneLeaoDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita o tipo LIVRO_CAIXA quando informado', async () => {
    const dto = plainToInstance(UpdateDeducaoCarneLeaoDto, { tipo: 'LIVRO_CAIXA' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });
});
