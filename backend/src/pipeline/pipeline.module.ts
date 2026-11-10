import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { FilteringService } from '../filtering/filtering.service';
import { MlService } from '../ml/ml.service';
import { PushModule } from '../push/push.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [AlertsModule, RealtimeModule, PushModule],
  providers: [FilteringService, MlService, PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
