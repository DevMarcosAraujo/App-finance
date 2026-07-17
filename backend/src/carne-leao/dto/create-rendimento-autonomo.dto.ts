import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { TipoRendimentoAutonomo } from '@prisma/client';
import { IsCpf } from '../../auth/validators/is-cpf.validator';

export class CreateRendimentoAutonomoDto {
  @IsEnum(TipoRendimentoAutonomo)
  tipo: TipoRendimentoAutonomo;

  @ValidateIf((o: CreateRendimentoAutonomoDto) => o.tipo !== 'EXTERIOR')
  @IsCpf()
  fontePagadoraCpf?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorBruto: number;

  @IsOptional()
  @IsUUID()
  documentoFiscalId?: string;

  @IsDateString()
  competencia: string;
}
