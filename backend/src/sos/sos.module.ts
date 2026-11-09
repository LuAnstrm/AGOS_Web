import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { SosController } from './sos.controller';
import { SosService } from './sos.service';

@Module({
  imports: [RealtimeModule],
  controllers: [SosController],
  providers: [SosService],
})
export class SosModule {}
