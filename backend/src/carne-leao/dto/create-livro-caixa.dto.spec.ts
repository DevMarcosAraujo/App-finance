import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateLivroCaixaDto } from './create-livro-caixa.dto';

describe('CreateLivroCaixaDto', () => {
  const valid = {
    descricao: 'aluguel do escritório',
    categoria: 'aluguel_escritorio',
    valor: 300,
    competencia: '2026-07-01',
  };

  it('aceita um lançamento válido', async () => {
    const dto = plainToInstance(CreateLivroCaixaDto, valid);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita descricao vazia', async () => {
    const dto = plainToInstance(CreateLivroCaixaDto, { ...valid, descricao: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'descricao')).toBe(true);
  });

  it('rejeita categoria vazia', async () => {
    const dto = plainToInstance(CreateLivroCaixaDto, { ...valid, categoria: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categoria')).toBe(true);
  });

  it('rejeita um valor não positivo', async () => {
    const dto = plainToInstance(CreateLivroCaixaDto, { ...valid, valor: -1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });
});
