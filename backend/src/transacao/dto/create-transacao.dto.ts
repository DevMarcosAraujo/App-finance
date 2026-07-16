import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransacaoTipo } from '@prisma/client';

export class CreateTransacaoDto {
  @IsEnum(TransacaoTipo)
  tipo: TransacaoTipo;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsDateString()
  data: string;
}
