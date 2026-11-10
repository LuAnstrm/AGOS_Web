import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Principal } from '../auth/access';
import { CurrentPrincipal, DeviceOr, Roles } from '../auth/decorators';
import { UserRole } from '../database/enums';
import { CreateSosDto, UpdateSosDto } from './sos.dto';
import { SosActor, SosService } from './sos.service';

const asActor = (who: Principal): SosActor | null =>
  who.kind === 'user' ? { id: who.id, displayName: who.displayName } : null;

/**
 * SOS / rescue coordination.
 *   POST         — signed-in citizens (mobile app) and the mesh gateway (device key)
 *   GET /mine    — a citizen's own requests, minimal fields
 *   everything else — DRRMO officers only (personal data)
 */
@Controller('sos')
export class SosController {
  constructor(private readonly sos: SosService) {}

  /** 201 for a new request, 200 for a re-delivered duplicate. */
  @DeviceOr(UserRole.CITIZEN, UserRole.OFFICER)
  @Post()
  async create(
    @Body() dto: CreateSosDto,
    @CurrentPrincipal() who: Principal,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { request, duplicate } = await this.sos.create(dto, asActor(who));
    res.status(duplicate ? 200 : 201);
    return { id: request.id, status: request.status, duplicate };
  }

  @Roles(UserRole.CITIZEN)
  @Get('mine')
  mine(@CurrentPrincipal() who: Principal) {
    return this.sos.mine(who.kind === 'user' ? who.id : '');
  }

  @Roles(UserRole.OFFICER)
  @Get()
  async list(
    @Query('scope') scope: string | undefined,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    const rows = await this.sos.list(
      scope === 'all' ? 'all' : 'open',
      Math.min(Math.max(limit, 1), 500),
    );
    // Each request carries its nearest safe open centre, for dispatch.
    return this.sos.withShelter(rows);
  }

  @Roles(UserRole.OFFICER)
  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sos.get(id);
  }

  @Roles(UserRole.OFFICER)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSosDto,
    @CurrentPrincipal() who: Principal,
  ) {
    // Roles guard guarantees an officer here.
    return this.sos.update(id, dto, asActor(who)!);
  }
}
