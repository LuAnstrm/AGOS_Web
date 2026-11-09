import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /** Alert history, newest first — initial load for the dashboard alert feed. */
  @Get()
  list(
    @Query('nodeId') nodeId?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.alerts.recent(nodeId, Math.min(Math.max(limit, 1), 500));
  }
}
