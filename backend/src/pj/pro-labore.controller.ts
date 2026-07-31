import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateProLaboreDto } from './dto/create-pro-labore.dto';
import { UpdateProLaboreDto } from './dto/update-pro-labore.dto';
import type { ProLaboreResult } from './pro-labore.service';
import { ProLaboreService } from './pro-labore.service';

@Controller('pro-labores')
@UseGuards(JwtAuthGuard)
export class ProLaboreController {
  constructor(private readonly service: ProLaboreService) {}

  @Post()
  create(
    @Body() dto: CreateProLaboreDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProLaboreResult> {
    return this.service.create(user.id, dto);
  }

  @Get()
  findByMonth(
    @Query('empresaId') empresaId: string,
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProLaboreResult[]> {
    return this.service.findByMonth(user.id, empresaId, ano, mes);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProLaboreDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProLaboreResult> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
