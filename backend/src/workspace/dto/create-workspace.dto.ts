import { IsEnum } from 'class-validator';
import { PlanoTipo } from '@prisma/client';

export class CreateWorkspaceDto {
  @IsEnum(PlanoTipo)
  tipo: PlanoTipo;
}
