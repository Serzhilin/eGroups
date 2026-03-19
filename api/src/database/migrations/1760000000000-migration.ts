import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1760000000000 implements MigrationInterface {
    name = "Migration1760000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying,
                "ename" character varying,
                "avatarUrl" character varying,
                "isVerified" boolean NOT NULL DEFAULT false,
                "isPrivate" boolean NOT NULL DEFAULT false,
                "isArchived" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_egroups_users" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TYPE "public"."egroups_join_mode_enum" AS ENUM('open', 'approval_required')
        `);

        await queryRunner.query(`
            CREATE TABLE "groups" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "description" text,
                "logo" character varying,
                "joinMode" character varying NOT NULL DEFAULT 'open',
                "inviteCode" character varying NOT NULL,
                "createdBy" character varying,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_egroups_groups_inviteCode" UNIQUE ("inviteCode"),
                CONSTRAINT "PK_egroups_groups" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "group_members" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "group_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "role" character varying NOT NULL DEFAULT 'member',
                "status" character varying NOT NULL DEFAULT 'active',
                "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_egroups_group_members" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_egroups_group_members" UNIQUE ("group_id", "user_id"),
                CONSTRAINT "FK_egroups_group_members_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_egroups_group_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "group_members"`);
        await queryRunner.query(`DROP TABLE "groups"`);
        await queryRunner.query(`DROP TYPE "public"."egroups_join_mode_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }
}
