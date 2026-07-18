import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateRendimentoAutonomoDto } from './dto/create-rendimento-autonomo.dto';
import { UpdateRendimentoAutonomoDto } from './dto/update-rendimento-autonomo.dto';
import type { RendimentoAutonomoResult } from './rendimento-autonomo.service';
import { RendimentoAutonomoService } from './rendimento-autonomo.service';

@Controller('rendimentos-autonomos')
@UseGuards(JwtAuthGuard)
export class RendimentoAutonomoController {
  constructor(private readonly service: RendimentoAutonomoService) {}

  @Post()
  create(
    @Body() dto: CreateRendimentoAutonomoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RendimentoAutonomoResult> {
    return this.service.create(user.id, dto);
  }

  @Get()
  findByMonth(
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RendimentoAutonomoResult[]> {
    return this.service.findByMonth(user.id, ano, mes);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRendimentoAutonomoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RendimentoAutonomoResult> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
