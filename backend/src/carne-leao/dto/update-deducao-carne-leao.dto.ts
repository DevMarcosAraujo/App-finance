import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { TIPOS_DEDUCAO_ACEITOS } from './create-deducao-carne-leao.dto';
import type { TipoDeducaoCarneLeaoAceito } from './create-deducao-carne-leao.dto';

export class UpdateDeducaoCarneLeaoDto {
  @IsOptional()
  @IsIn(TIPOS_DEDUCAO_ACEITOS)
  tipo?: TipoDeducaoCarneLeaoAceito;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsString()
  anexoUrl?: string;

  @IsOptional()
  @IsDateString()
  competencia?: string;
}
