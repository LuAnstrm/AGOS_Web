/**
 * Loads evacuation centres from a JSON file ({ "centers": [ { id, name,
 * barangay, lat, lng, kind, capacity } ] }). Existing ids are updated.
 *
 *   npm run seed-centers -- path/to/malolos-centres.json
 *
 * Centres loaded this way are marked real (placeholder = false). To also
 * remove the demo placeholders, pass --drop-placeholders.
 */
import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { AppModule } from '../app.module';
import { EvacCenter } from '../database/entities';
import { EvacService } from '../evac/evac.service';
import { DataSource } from 'typeorm';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'drop-placeholders': { type: 'boolean', default: false } },
  });
  if (!positionals[0]) {
    console.error('usage: seed-centers <file.json> [--drop-placeholders]');
    process.exit(2);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    if (values['drop-placeholders']) {
      const r = await app
        .get(DataSource)
        .getRepository(EvacCenter)
        .delete({ placeholder: true });
      console.log(`removed ${r.affected ?? 0} placeholder centres`);
    }
    const n = await app.get(EvacService).load(resolve(positionals[0]), false);
    console.log(`loaded ${n} evacuation centres`);
  } finally {
    await app.close();
  }
}

void main();
