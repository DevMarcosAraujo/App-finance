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
import { CreateDeducaoCarneLeaoDto } from './dto/create-deducao-carne-leao.dto';
import { UpdateDeducaoCarneLeaoDto } from './dto/update-deducao-carne-leao.dto';
import type { DeducaoCarneLeaoResult } from './deducao-carne-leao.service';
import { DeducaoCarneLeaoService } from './deducao-carne-leao.service';

@Controller('deducoes-carne-leao')
@UseGuards(JwtAuthGuard)
export class DeducaoCarneLeaoController {
  constructor(private readonly service: DeducaoCarneLeaoService) {}

  @Post()
  create(
    @Body() dto: CreateDeducaoCarneLeaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeducaoCarneLeaoResult> {
    return this.service.create(user.id, dto);
  }

  @Get()
  findByMonth(
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeducaoCarneLeaoResult[]> {
    return this.service.findByMonth(user.id, ano, mes);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDeducaoCarneLeaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeducaoCarneLeaoResult> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
