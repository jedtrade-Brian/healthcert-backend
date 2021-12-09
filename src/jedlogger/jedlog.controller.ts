import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CreateJedLogDto } from './dto/create-jedlog.dto';
import { JedLog } from './interfaces/jedlog.interface';
import { JedLogService } from './jedlog.service';

@Controller('products')
export class JedLogController {
  constructor(private readonly logService: JedLogService) {}

  @Get()
  findAll(): Promise<JedLog[]> {
    return this.logService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<JedLog> {
    return this.logService.findOne(id);
  }

  @Post()
  create(@Body() createProductDto: CreateJedLogDto): Promise<JedLog> {
    return this.logService.create(createProductDto);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<JedLog> {
    return this.logService.delete(id);
  }

  // @Put(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateProductDto: CreateJedLogDto,
  // ): Promise<JedLog> {
  //   return this.logService.update(id, updateProductDto);
  // }
}
