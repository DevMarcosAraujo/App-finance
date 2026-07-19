import { IsDateString, IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { AnexoSimples, AtividadeEmpresa, RegimeEmpresa } from '@prisma/client';
import { IsCnpj } from '../../auth/validators/is-cnpj.validator';

export class CreateEmpresaDto {
  @IsCnpj()
  cnpj: string;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(RegimeEmpresa)
  regime: RegimeEmpresa;

  @IsEnum(AtividadeEmpresa)
  atividadeTipo: AtividadeEmpresa;

  @ValidateIf((o: CreateEmpresaDto) => o.regime === RegimeEmpresa.SIMPLES_ME)
  @IsEnum(AnexoSimples)
  anexoSimples?: AnexoSimples;

  @IsDateString()
  dataAbertura: string;
}
