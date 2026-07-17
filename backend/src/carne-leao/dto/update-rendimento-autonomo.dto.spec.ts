import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateRendimentoAutonomoDto } from './update-rendimento-autonomo.dto';

describe('UpdateRendimentoAutonomoDto', () => {
  it('aceita um objeto vazio (todos os campos opcionais)', async () => {
    const dto = plainToInstance(UpdateRendimentoAutonomoDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('aceita atualizar só o valorBruto', async () => {
    const dto = plainToInstance(UpdateRendimentoAutonomoDto, { valorBruto: 2000 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita um fontePagadoraCpf inválido quando informado', async () => {
    const dto = plainToInstance(UpdateRendimentoAutonomoDto, {
      fontePagadoraCpf: '000.000.000-00',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'fontePagadoraCpf')).toBe(true);
  });
});
