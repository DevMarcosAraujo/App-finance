import { IsDateString, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreateDistribuicaoLucrosDto {
  @IsUUID()
  empresaId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsDateString()
  competencia: string;
}
