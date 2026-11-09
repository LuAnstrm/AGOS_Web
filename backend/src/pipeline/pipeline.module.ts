import { Module } from '@nestjs/common';
import { FilteringService } from '../filtering/filtering.service';
import { MlService } from '../ml/ml.service';
import { PipelineService } from './pipeline.service';

@Module({
  providers: [FilteringService, MlService, PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
