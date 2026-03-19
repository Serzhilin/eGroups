import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEnameToGroups1760000000003 implements MigrationInterface {
    name = "AddEnameToGroups1760000000003";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "groups"
            ADD COLUMN "ename" character varying,
            ADD CONSTRAINT "UQ_groups_ename" UNIQUE ("ename")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "groups"
            DROP CONSTRAINT "UQ_groups_ename",
            DROP COLUMN "ename"
        `);
    }
}
