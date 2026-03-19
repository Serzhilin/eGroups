import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExternalMetaEnvelopeId1760000000002 implements MigrationInterface {
    name = "AddExternalMetaEnvelopeId1760000000002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN "externalMetaEnvelopeId" character varying,
            ADD CONSTRAINT "UQ_users_externalMetaEnvelopeId" UNIQUE ("externalMetaEnvelopeId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
            DROP CONSTRAINT "UQ_users_externalMetaEnvelopeId",
            DROP COLUMN "externalMetaEnvelopeId"
        `);
    }
}
