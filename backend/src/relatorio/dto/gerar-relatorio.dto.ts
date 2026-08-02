import { IsDateString, IsEnum } from 'class-validator';
import { TipoRelatorio } from '@prisma/client';

export class GerarRelatorioDto {
  @IsEnum(TipoRelatorio)
  tipo: TipoRelatorio;

  @IsDateString()
  periodoInicio: string;

  @IsDateString()
  periodoFim: string;
}
