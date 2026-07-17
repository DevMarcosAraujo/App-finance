import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';
import { TipoRendimentoAutonomo } from '@prisma/client';
import { IsCpf } from '../../auth/validators/is-cpf.validator';

export class UpdateRendimentoAutonomoDto {
  @IsOptional()
  @IsEnum(TipoRendimentoAutonomo)
  tipo?: TipoRendimentoAutonomo;

  @IsOptional()
  @IsCpf()
  fontePagadoraCpf?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorBruto?: number;

  @IsOptional()
  @IsUUID()
  documentoFiscalId?: string;

  @IsOptional()
  @IsDateString()
  competencia?: string;
}
