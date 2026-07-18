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
import { CreateLivroCaixaDto } from './dto/create-livro-caixa.dto';
import { UpdateLivroCaixaDto } from './dto/update-livro-caixa.dto';
import type { LivroCaixaResult } from './livro-caixa.service';
import { LivroCaixaService } from './livro-caixa.service';

@Controller('livro-caixa')
@UseGuards(JwtAuthGuard)
export class LivroCaixaController {
  constructor(private readonly service: LivroCaixaService) {}

  @Post()
  create(
    @Body() dto: CreateLivroCaixaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LivroCaixaResult> {
    return this.service.create(user.id, dto);
  }

  @Get()
  findByMonth(
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LivroCaixaResult[]> {
    return this.service.findByMonth(user.id, ano, mes);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLivroCaixaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LivroCaixaResult> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
