import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SensorNode } from '../database/entities';
import { UpsertNodeDto } from './upsert-node.dto';

@Controller('nodes')
export class NodesController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Get()
  list() {
    return this.db.getRepository(SensorNode).find({ order: { id: 'ASC' } });
  }

  /** Register or update a node's metadata (install survey, simulator start-up). */
  @Put(':id')
  async upsert(@Param('id') id: string, @Body() dto: UpsertNodeDto) {
    const repo = this.db.getRepository(SensorNode);
    await repo.upsert({ id, ...dto }, ['id']);
    return repo.findOneByOrFail({ id });
  }

  /**
   * Time series for one node, oldest first: raw vs. filtered depth plus the
   * ML results for each reading. Feeds the trend chart and ML panel.
   */
  @Get(':id/series')
  async series(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(120), ParseIntPipe) limit: number,
  ) {
    const exists = await this.db.getRepository(SensorNode).existsBy({ id });
    if (!exists) throw new NotFoundException(`node ${id}`);
    const rows: unknown[] = await this.db.query(
      `SELECT r."recordedAt", r."waterDepthCm" AS "rawCm", r.channel,
              f."waterDepthCm" AS "filteredCm", f."rateCmPerMin", f.rejected,
              c."riskClass", c.confidence,
              fc."h1Cm", fc."h6Cm", fc."h24Cm",
              COALESCE(c."modelVersion", fc."modelVersion") AS "modelVersion"
         FROM readings_raw r
         LEFT JOIN readings_filtered f ON f."rawId" = r.id
         LEFT JOIN classifications c ON c."filteredId" = f.id
         LEFT JOIN forecasts fc ON fc."filteredId" = f.id
        WHERE r."nodeId" = $1
        ORDER BY r."recordedAt" DESC
        LIMIT $2`,
      [id, Math.min(Math.max(limit, 1), 1440)],
    );
    return rows.reverse();
  }
}
