import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExternalId1760000000001 implements MigrationInterface {
    name = "AddExternalId1760000000001";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "groups"
            ADD COLUMN "externalId" character varying,
            ADD CONSTRAINT "UQ_egroups_groups_externalId" UNIQUE ("externalId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "groups"
            DROP CONSTRAINT "UQ_egroups_groups_externalId",
            DROP COLUMN "externalId"
        `);
    }
}
