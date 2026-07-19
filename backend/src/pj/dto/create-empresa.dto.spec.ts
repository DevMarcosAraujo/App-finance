import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEmpresaDto } from './create-empresa.dto';
import { randomValidCnpj } from '../../../test/fixtures/cnpj';

describe('CreateEmpresaDto', () => {
  it('aceita uma empresa MEI sem anexoSimples', async () => {
    const dto = plainToInstance(CreateEmpresaDto, {
      cnpj: randomValidCnpj(),
      nome: 'Marcos Serviços',
      regime: 'MEI',
      atividadeTipo: 'SERVICO',
      dataAbertura: '2026-08-01',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('aceita uma empresa SIMPLES_ME com anexoSimples', async () => {
    const dto = plainToInstance(CreateEmpresaDto, {
      cnpj: randomValidCnpj(),
      nome: 'Esposa ME',
      regime: 'SIMPLES_ME',
      atividadeTipo: 'SERVICO',
      anexoSimples: 'III',
      dataAbertura: '2020-01-01',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita SIMPLES_ME sem anexoSimples', async () => {
    const dto = plainToInstance(CreateEmpresaDto, {
      cnpj: randomValidCnpj(),
      nome: 'Esposa ME',
      regime: 'SIMPLES_ME',
      atividadeTipo: 'SERVICO',
      dataAbertura: '2020-01-01',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'anexoSimples')).toBe(true);
  });

  it('rejeita CNPJ inválido', async () => {
    const dto = plainToInstance(CreateEmpresaDto, {
      cnpj: '11.111.111/1111-11',
      nome: 'Empresa',
      regime: 'MEI',
      atividadeTipo: 'SERVICO',
      dataAbertura: '2026-08-01',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'cnpj')).toBe(true);
  });
});
