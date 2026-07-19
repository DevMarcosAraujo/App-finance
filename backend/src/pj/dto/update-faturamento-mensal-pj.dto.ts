import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { EmissorTipo } from '@prisma/client';

export class UpdateFaturamentoMensalPjDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  receitaBrutaTotal?: number;

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
}
