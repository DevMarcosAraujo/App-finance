import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { EmissorTipo } from '@prisma/client';

export class CreateFaturamentoMensalPjDto {
  @IsUUID()
  empresaId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  receitaBrutaTotal: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  receitaComNota?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  receitaSemNota?: number;

  @IsOptional()
  @IsEnum(EmissorTipo)
  clienteTipoPredominante?: EmissorTipo;

  @IsDateString()
  competencia: string;
}
