import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Public, Roles } from '../auth/decorators';
import { EvacStatus } from '../database/entities';
import { UserRole } from '../database/enums';
import { EvacService } from './evac.service';

class UpdateCentreDto {
  @IsEnum(EvacStatus)
  status!: EvacStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  capacity?: number;
}

/**
 * Evacuation centres. Listing and recommendations are public safety
 * information; changing a centre's status is for officers.
 */
@Controller('evac')
export class EvacController {
  constructor(private readonly evac: EvacService) {}

  @Public()
  @Get('centers')
  list() {
    return this.evac.list();
  }

  /** Nearest safe open centres from a point, straight-line (see evac-rules.ts). */
  @Public()
  @Get('recommend')
  recommend(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ) {
    return this.evac.recommend(lat, lng, Math.min(Math.max(limit, 1), 10));
  }

  @Roles(UserRole.OFFICER)
  @Patch('centers/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCentreDto) {
    return this.evac.setStatus(id, dto.status, dto.capacity);
  }
}
