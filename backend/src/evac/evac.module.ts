import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { EvacController } from './evac.controller';
import { EvacService } from './evac.service';

@Module({
  imports: [RealtimeModule],
  controllers: [EvacController],
  providers: [EvacService],
  exports: [EvacService],
})
export class EvacModule {}
