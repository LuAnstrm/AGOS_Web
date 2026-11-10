import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { Public } from './auth/decorators';
import { MIGRATIONS_GLOB } from './database/data-source';
import { ENTITIES } from './database/entities';
import { EvacModule } from './evac/evac.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { NodesModule } from './nodes/nodes.module';
import { PushModule } from './push/push.module';
import { SosModule } from './sos/sos.module';

@Controller('health')
class HealthController {
  @Public()
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
        migrations: [MIGRATIONS_GLOB],
        // Development: schema auto-synced from the entities (DB_SYNC=true,
        // the default). Production: DB_SYNC=false — the schema only changes
        // through the migrations in src/database/migrations, applied at
        // startup, so a code change can never silently drop a column.
        synchronize: config.get<string>('DB_SYNC', 'true') === 'true',
        migrationsRun: config.get<string>('DB_SYNC', 'true') !== 'true',
      }),
    }),
    AuthModule,
    IngestionModule,
    NodesModule,
    SosModule,
    EvacModule,
    PushModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
