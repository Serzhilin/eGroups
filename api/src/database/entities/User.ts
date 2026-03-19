import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from "typeorm";
import { GroupMember } from "./GroupMember";

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true })
    name!: string;

    @Column({ nullable: true })
    ename!: string;

    @Column({ nullable: true })
    avatarUrl!: string;

    @Column({ default: false })
    isVerified!: boolean;

    @Column({ default: false })
    isPrivate!: boolean;

    @Column({ default: false })
    isArchived!: boolean;

    @Column({ nullable: true, unique: true })
    externalMetaEnvelopeId!: string; // blabsy MetaEnvelope ID for cross-platform participant resolution

    @OneToMany(() => GroupMember, (gm) => gm.user)
    memberships!: GroupMember[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
