import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Group } from "./Group";

export type MemberRole = "admin" | "member";
export type MemberStatus = "active" | "pending";

@Entity("group_members")
export class GroupMember {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Group, (group) => group.members, { onDelete: "CASCADE" })
    @JoinColumn({ name: "group_id" })
    group!: Group;

    @Column({ name: "group_id" })
    groupId!: string;

    @ManyToOne(() => User, (user) => user.memberships, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Column({ name: "user_id" })
    userId!: string;

    @Column({ type: "varchar", default: "member" })
    role!: MemberRole;

    @Column({ type: "varchar", default: "active" })
    status!: MemberStatus;

    @CreateDateColumn()
    joinedAt!: Date;
}
