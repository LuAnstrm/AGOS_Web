import { Module } from '@nestjs/common';
import { EvacModule } from '../evac/evac.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SosController } from './sos.controller';
import { SosService } from './sos.service';

@Module({
  imports: [RealtimeModule, EvacModule],
  controllers: [SosController],
  providers: [SosService],
})
export class SosModule {}
