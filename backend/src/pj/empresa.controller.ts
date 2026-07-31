import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import type { EmpresaResult } from './empresa.service';
import { EmpresaService } from './empresa.service';

@Controller('empresas')
@UseGuards(JwtAuthGuard)
export class EmpresaController {
  constructor(private readonly service: EmpresaService) {}

  @Post()
  create(
    @Body() dto: CreateEmpresaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmpresaResult> {
    return this.service.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<EmpresaResult[]> {
    return this.service.findAll(user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmpresaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmpresaResult> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
