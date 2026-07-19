import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateEmpresaDto } from './update-empresa.dto';

describe('UpdateEmpresaDto', () => {
  it('aceita objeto vazio (todos os campos opcionais)', async () => {
    const dto = plainToInstance(UpdateEmpresaDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('aceita atualizar só o nome', async () => {
    const dto = plainToInstance(UpdateEmpresaDto, { nome: 'Novo Nome' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita ativa não-booleano', async () => {
    const dto = plainToInstance(UpdateEmpresaDto, { ativa: 'sim' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ativa')).toBe(true);
  });
});
