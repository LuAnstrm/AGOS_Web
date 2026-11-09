import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITIES } from './database/entities';
import { IngestionModule } from './ingestion/ingestion.module';
import { NodesModule } from './nodes/nodes.module';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>(
          'DATABASE_URL',
          'postgres://agos:agos@localhost:5433/agos',
        ),
        entities: ENTITIES,
        // Schema is generated from the entities while the platform is in
        // simulation phase. Switch to migrations before the pilot deploy.
        synchronize: config.get<string>('DB_SYNC', 'true') === 'true',
      }),
    }),
    IngestionModule,
    NodesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
