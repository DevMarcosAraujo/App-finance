import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AnexoSimples, AtividadeEmpresa } from '@prisma/client';

export class UpdateEmpresaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nome?: string;

  @IsOptional()
  @IsEnum(AtividadeEmpresa)
  atividadeTipo?: AtividadeEmpresa;

  @IsOptional()
  @IsEnum(AnexoSimples)
  anexoSimples?: AnexoSimples;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
