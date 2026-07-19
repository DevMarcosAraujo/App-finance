import { IsDateString, IsNumber, IsPositive, IsUUID, Min } from 'class-validator';

export class CreateProLaboreDto {
  @IsUUID()
  empresaId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  inssRetido: number;

  @IsDateString()
  competencia: string;
}
