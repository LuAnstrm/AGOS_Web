import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1794289282449 implements MigrationInterface {
  name = 'InitialSchema1794289282449';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."alerts_tier_enum" AS ENUM('safe', 'advisory', 'watch', 'warning', 'critical')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alerts_previoustier_enum" AS ENUM('safe', 'advisory', 'watch', 'warning', 'critical')`,
    );
    await queryRunner.query(
      `CREATE TABLE "alerts" ("id" BIGSERIAL NOT NULL, "nodeId" text NOT NULL, "tier" "public"."alerts_tier_enum" NOT NULL, "previousTier" "public"."alerts_previoustier_enum", "filteredId" bigint, "messageEn" text NOT NULL, "messageFil" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_032d0a0047320b13f93db582aa" ON "alerts"  ("nodeId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."classifications_riskclass_enum" AS ENUM('low', 'moderate', 'high')`,
    );
    await queryRunner.query(
      `CREATE TABLE "classifications" ("id" BIGSERIAL NOT NULL, "filteredId" bigint NOT NULL, "nodeId" text NOT NULL, "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "riskClass" "public"."classifications_riskclass_enum" NOT NULL, "confidence" double precision, "modelVersion" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_58d976e264f75fc0ea006718856" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_935a89c0d2b984db1a82ac54d2" ON "classifications"  ("nodeId", "recordedAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evac_centers_kind_enum" AS ENUM('school', 'court', 'hall', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evac_centers_status_enum" AS ENUM('open', 'full', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "evac_centers" ("id" text NOT NULL, "name" text NOT NULL, "barangay" text, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "kind" "public"."evac_centers_kind_enum" NOT NULL DEFAULT 'other', "capacity" integer, "status" "public"."evac_centers_status_enum" NOT NULL DEFAULT 'open', "placeholder" boolean NOT NULL DEFAULT false, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_67f95153fb454d9b29e318efaf6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "forecasts" ("id" BIGSERIAL NOT NULL, "filteredId" bigint NOT NULL, "nodeId" text NOT NULL, "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "h1Cm" double precision NOT NULL, "h6Cm" double precision NOT NULL, "h24Cm" double precision NOT NULL, "modelVersion" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_caa4d5aec48032eb9d2ce8535f8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aa246d0003525dc5f97f17ec11" ON "forecasts"  ("nodeId", "recordedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "push_tokens" ("token" text NOT NULL, "userId" uuid, "locale" text NOT NULL DEFAULT 'fil', "lat" double precision, "lng" double precision, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_869b4a9ba2c9e030aafc4b7dc7a" PRIMARY KEY ("token"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sensor_nodes_source_enum" AS ENUM('simulated', 'hardware')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sensor_nodes_currenttier_enum" AS ENUM('safe', 'advisory', 'watch', 'warning', 'critical')`,
    );
    await queryRunner.query(
      `CREATE TABLE "sensor_nodes" ("id" text NOT NULL, "name" text, "barangay" text, "lat" double precision, "lng" double precision, "mountHeightCm" double precision NOT NULL DEFAULT '400', "source" "public"."sensor_nodes_source_enum" NOT NULL DEFAULT 'simulated', "currentTier" "public"."sensor_nodes_currenttier_enum" NOT NULL DEFAULT 'safe', "lastSeenAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4fae1dee76dce2b4c899e58fe0c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."readings_raw_channel_enum" AS ENUM('lorawan', 'lte', 'ble_mesh')`,
    );
    await queryRunner.query(
      `CREATE TABLE "readings_raw" ("id" BIGSERIAL NOT NULL, "nodeId" text NOT NULL, "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "waterDepthCm" double precision NOT NULL, "tiltDeg" double precision, "vibrationG" double precision, "temperatureC" double precision, "lat" double precision, "lng" double precision, "batteryPct" double precision, "solarChargePct" double precision, "channel" "public"."readings_raw_channel_enum" NOT NULL, CONSTRAINT "PK_cdcb588c58a369282d5c6d72971" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2cfd6b76981964134abb60f734" ON "readings_raw"  ("nodeId", "recordedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "readings_filtered" ("id" BIGSERIAL NOT NULL, "rawId" bigint NOT NULL, "nodeId" text NOT NULL, "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "waterDepthCm" double precision NOT NULL, "rateCmPerMin" double precision, "variance" double precision, "covariance" double precision array, "rejected" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_844056fb292652959f2d008450a" UNIQUE ("rawId"), CONSTRAINT "REL_844056fb292652959f2d008450" UNIQUE ("rawId"), CONSTRAINT "PK_5d4e6c580b0462134953ce89fd1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ec6fddc104e1478b61b016aca0" ON "readings_filtered"  ("nodeId", "recordedAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sos_events_status_enum" AS ENUM('new', 'acknowledged', 'dispatched', 'resolved', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "sos_events" ("id" BIGSERIAL NOT NULL, "sosId" uuid NOT NULL, "status" "public"."sos_events_status_enum" NOT NULL, "note" text, "actor" text, "actorUserId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a056474ff3a26241eaeff3575c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ecad19e7565547e0281e8d9bf" ON "sos_events"  ("sosId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sos_requests_channel_enum" AS ENUM('ble_mesh', 'app')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sos_requests_needs_enum" AS ENUM('medical', 'elderly', 'children', 'pwd', 'pregnant', 'trapped')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sos_requests_status_enum" AS ENUM('new', 'acknowledged', 'dispatched', 'resolved', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "sos_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientId" text NOT NULL, "channel" "public"."sos_requests_channel_enum" NOT NULL, "relayNodeId" text, "relayHops" integer, "reporterUserId" uuid, "reporterName" text, "reporterPhone" text, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "peopleCount" integer NOT NULL DEFAULT '1', "needs" "public"."sos_requests_needs_enum" array NOT NULL DEFAULT '{}', "message" text, "status" "public"."sos_requests_status_enum" NOT NULL DEFAULT 'new', "assignedTeam" text, "nearestNodeId" text, "nearestNodeDistanceM" double precision, "reportedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "acknowledgedAt" TIMESTAMP WITH TIME ZONE, "dispatchedAt" TIMESTAMP WITH TIME ZONE, "closedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_c2788990f9a4b03c48939745e08" UNIQUE ("clientId"), CONSTRAINT "PK_b5c8cd9c2d6b1a9936f2d2f86d8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_efe4d2ccb58059806c73e5dde1" ON "sos_requests"  ("status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('citizen', 'officer')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" text NOT NULL, "passwordHash" text NOT NULL, "displayName" text NOT NULL, "role" "public"."users_role_enum" NOT NULL, "locale" text NOT NULL DEFAULT 'fil', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "readings_raw" ADD CONSTRAINT "FK_031dadef821acc00d823e90750a" FOREIGN KEY ("nodeId") REFERENCES "sensor_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "readings_filtered" ADD CONSTRAINT "FK_844056fb292652959f2d008450a" FOREIGN KEY ("rawId") REFERENCES "readings_raw"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "readings_filtered" DROP CONSTRAINT "FK_844056fb292652959f2d008450a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "readings_raw" DROP CONSTRAINT "FK_031dadef821acc00d823e90750a"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_efe4d2ccb58059806c73e5dde1"`,
    );
    await queryRunner.query(`DROP TABLE "sos_requests"`);
    await queryRunner.query(`DROP TYPE "public"."sos_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."sos_requests_needs_enum"`);
    await queryRunner.query(`DROP TYPE "public"."sos_requests_channel_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ecad19e7565547e0281e8d9bf"`,
    );
    await queryRunner.query(`DROP TABLE "sos_events"`);
    await queryRunner.query(`DROP TYPE "public"."sos_events_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ec6fddc104e1478b61b016aca0"`,
    );
    await queryRunner.query(`DROP TABLE "readings_filtered"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2cfd6b76981964134abb60f734"`,
    );
    await queryRunner.query(`DROP TABLE "readings_raw"`);
    await queryRunner.query(`DROP TYPE "public"."readings_raw_channel_enum"`);
    await queryRunner.query(`DROP TABLE "sensor_nodes"`);
    await queryRunner.query(
      `DROP TYPE "public"."sensor_nodes_currenttier_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."sensor_nodes_source_enum"`);
    await queryRunner.query(`DROP TABLE "push_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aa246d0003525dc5f97f17ec11"`,
    );
    await queryRunner.query(`DROP TABLE "forecasts"`);
    await queryRunner.query(`DROP TABLE "evac_centers"`);
    await queryRunner.query(`DROP TYPE "public"."evac_centers_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."evac_centers_kind_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_935a89c0d2b984db1a82ac54d2"`,
    );
    await queryRunner.query(`DROP TABLE "classifications"`);
    await queryRunner.query(
      `DROP TYPE "public"."classifications_riskclass_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_032d0a0047320b13f93db582aa"`,
    );
    await queryRunner.query(`DROP TABLE "alerts"`);
    await queryRunner.query(`DROP TYPE "public"."alerts_previoustier_enum"`);
    await queryRunner.query(`DROP TYPE "public"."alerts_tier_enum"`);
  }
}
