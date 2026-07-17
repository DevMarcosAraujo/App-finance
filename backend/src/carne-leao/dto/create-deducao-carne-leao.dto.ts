import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export type TipoDeducaoCarneLeaoAceito = 'INSS_AUTONOMO' | 'PENSAO_JUDICIAL' | 'PGBL';

export const TIPOS_DEDUCAO_ACEITOS: TipoDeducaoCarneLeaoAceito[] = [
  'INSS_AUTONOMO',
  'PENSAO_JUDICIAL',
  'PGBL',
];

export class CreateDeducaoCarneLeaoDto {
  @IsIn(TIPOS_DEDUCAO_ACEITOS)
  tipo: TipoDeducaoCarneLeaoAceito;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsOptional()
  @IsString()
  anexoUrl?: string;

  @IsDateString()
  competencia: string;
}
