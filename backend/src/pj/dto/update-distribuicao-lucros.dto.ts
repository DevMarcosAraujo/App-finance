import { IsDateString, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class UpdateDistribuicaoLucrosDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsDateString()
  competencia?: string;
}
