import { IsDateString, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class UpdateProLaboreDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  inssRetido?: number;

  @IsOptional()
  @IsDateString()
  competencia?: string;
}
