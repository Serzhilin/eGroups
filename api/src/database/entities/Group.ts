import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from "typeorm";
import { GroupMember } from "./GroupMember";

export type JoinMode = "open" | "approval_required";

@Entity("groups")
export class Group {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ type: "text", nullable: true })
    description!: string;

    @Column({ nullable: true })
    logo!: string; // URL or eVault reference

    @Column({ type: "varchar", default: "open" })
    joinMode!: JoinMode;

    @Column({ unique: true })
    inviteCode!: string;

    @Column({ nullable: true })
    createdBy!: string; // ename of creator

    @Column({ nullable: true, unique: true })
    externalId!: string; // global eVault MetaEnvelope ID for deduplication

    @Column({ nullable: true, unique: true })
    ename!: string; // group's own eVault w3id (set after provisioning)

    @OneToMany(() => GroupMember, (gm) => gm.group, { cascade: true })
    members!: GroupMember[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
