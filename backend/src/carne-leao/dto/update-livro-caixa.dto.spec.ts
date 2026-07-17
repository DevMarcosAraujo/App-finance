import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateLivroCaixaDto } from './update-livro-caixa.dto';

describe('UpdateLivroCaixaDto', () => {
  it('aceita um objeto vazio', async () => {
    const dto = plainToInstance(UpdateLivroCaixaDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('aceita atualizar só o valor', async () => {
    const dto = plainToInstance(UpdateLivroCaixaDto, { valor: 400 });
    expect(await validate(dto)).toHaveLength(0);
  });
});
