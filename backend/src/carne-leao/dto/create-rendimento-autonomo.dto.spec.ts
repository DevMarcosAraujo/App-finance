import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateRendimentoAutonomoDto } from './create-rendimento-autonomo.dto';

describe('CreateRendimentoAutonomoDto', () => {
  const valid = {
    tipo: 'HONORARIO',
    fontePagadoraCpf: '11144477735',
    valorBruto: 1500,
    competencia: '2026-07-01',
  };

  it('aceita um honorário válido', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, valid);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('aceita rendimento do exterior sem fontePagadoraCpf', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, {
      tipo: 'EXTERIOR',
      valorBruto: 2000,
      competencia: '2026-07-01',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita honorário sem fontePagadoraCpf', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, {
      tipo: 'HONORARIO',
      valorBruto: 1500,
      competencia: '2026-07-01',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'fontePagadoraCpf')).toBe(true);
  });

  it('rejeita um fontePagadoraCpf inválido', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, {
      ...valid,
      fontePagadoraCpf: '000.000.000-00',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'fontePagadoraCpf')).toBe(true);
  });

  it('rejeita um tipo inválido', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, {
      ...valid,
      tipo: 'INVALIDO',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('rejeita um valorBruto não positivo', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, {
      ...valid,
      valorBruto: -10,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valorBruto')).toBe(true);
  });
});
