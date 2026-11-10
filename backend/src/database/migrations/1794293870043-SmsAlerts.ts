import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmsAlerts1794293870043 implements MigrationInterface {
  name = 'SmsAlerts1794293870043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sms_subscribers" ("phone" text NOT NULL, "locale" text NOT NULL DEFAULT 'fil', "lat" double precision, "lng" double precision, "barangay" text, "active" boolean NOT NULL DEFAULT false, "source" text NOT NULL, "consentAt" TIMESTAMP WITH TIME ZONE, "addedBy" text, "userId" uuid, "otpHash" text, "otpPurpose" text, "otpExpiresAt" TIMESTAMP WITH TIME ZONE, "otpAttempts" integer NOT NULL DEFAULT '0', "otpSentInWindow" integer NOT NULL DEFAULT '0', "otpWindowStart" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1f1e08b126af8a58a47cfe70316" PRIMARY KEY ("phone"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sms_broadcasts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "audience" jsonb NOT NULL, "messageEn" text NOT NULL, "messageFil" text NOT NULL, "recipients" integer NOT NULL, "segments" integer NOT NULL, "failed" integer NOT NULL DEFAULT '0', "createdBy" text NOT NULL, "createdByUserId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5f41b35d6360954b4d372e267d6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sms_messages" ("id" BIGSERIAL NOT NULL, "kind" text NOT NULL, "phone" text NOT NULL, "body" text NOT NULL, "status" text NOT NULL, "providerId" text, "error" text, "alertId" bigint, "broadcastId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6d4cfef86e93e3fde23954d11bc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7e259751b7add61848015e1127" ON "sms_messages"  ("createdAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7e259751b7add61848015e1127"`,
    );
    await queryRunner.query(`DROP TABLE "sms_messages"`);
    await queryRunner.query(`DROP TABLE "sms_broadcasts"`);
    await queryRunner.query(`DROP TABLE "sms_subscribers"`);
  }
}
