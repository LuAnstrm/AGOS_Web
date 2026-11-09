import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { DeviceOnly, Public } from '../auth/decorators';
import { CreateReadingDto } from './dto/create-reading.dto';
import { IngestionService } from './ingestion.service';

@Controller('readings')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  /** Single ingestion endpoint for simulator and (later) hardware gateways. */
  @DeviceOnly()
  @Post()
  @HttpCode(202)
  create(@Body() dto: CreateReadingDto) {
    return this.ingestion.ingest(dto);
  }

  /** Most recent raw readings, newest first — for debugging the pipeline. */
  @Public()
  @Get()
  list(
    @Query('nodeId') nodeId?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.ingestion.latest(nodeId, Math.min(Math.max(limit, 1), 500));
  }
}
