import { v4 as uuidv4 } from "uuid";
import { AppDataSource } from "../database/data-source";
import { Group, JoinMode } from "../database/entities/Group";
import { GroupMember, MemberRole, MemberStatus } from "../database/entities/GroupMember";
import { User } from "../database/entities/User";

export class GroupService {
    public groupRepo = AppDataSource.getRepository(Group);
    public memberRepo = AppDataSource.getRepository(GroupMember);

    private generateInviteCode(): string {
        return uuidv4().replace(/-/g, "").slice(0, 12);
    }

    private async touchGroup(groupId: string): Promise<void> {
        await this.groupRepo.update(groupId, { updatedAt: new Date() });
    }

    async createGroup(data: {
        name: string;
        description?: string;
        logo?: string;
        joinMode: JoinMode;
        creatorUser: User;
        ename?: string;
    }): Promise<Group> {
        const group = this.groupRepo.create({
            name: data.name,
            description: data.description,
            logo: data.logo,
            joinMode: data.joinMode,
            inviteCode: this.generateInviteCode(),
            createdBy: data.creatorUser.ename,
            ename: data.ename,
        });
        const saved = await this.groupRepo.save(group);

        // Add creator as admin
        const member = this.memberRepo.create({
            groupId: saved.id,
            userId: data.creatorUser.id,
            role: "admin",
            status: "active",
        });
        await this.memberRepo.save(member);

        return saved;
    }

    async setEname(id: string, ename: string): Promise<void> {
        await this.groupRepo.update(id, { ename });
    }

    async getGroupById(id: string): Promise<Group | null> {
        return this.groupRepo.findOne({
            where: { id },
            relations: ["members", "members.user"],
        });
    }

    async getGroupByInviteCode(inviteCode: string): Promise<Group | null> {
        return this.groupRepo.findOne({
            where: { inviteCode },
            relations: ["members", "members.user"],
        });
    }

    async getUserGroups(userId: string): Promise<Group[]> {
        const memberships = await this.memberRepo.find({
            where: { userId, status: "active" },
            relations: ["group", "group.members"],
        });
        return memberships.map((m) => m.group);
    }

    async getMembership(groupId: string, userId: string): Promise<GroupMember | null> {
        return this.memberRepo.findOne({ where: { groupId, userId } });
    }

    async updateGroup(
        id: string,
        data: Partial<Pick<Group, "name" | "description" | "logo" | "joinMode" | "ename">>,
    ): Promise<Group | null> {
        await this.groupRepo.update(id, data);
        return this.getGroupById(id);
    }

    async regenerateInviteCode(id: string): Promise<string> {
        const inviteCode = this.generateInviteCode();
        await this.groupRepo.update(id, { inviteCode });
        return inviteCode;
    }

    async deleteGroup(id: string): Promise<void> {
        await this.groupRepo.delete(id);
    }

    async joinGroup(groupId: string, userId: string, status: MemberStatus): Promise<GroupMember> {
        const existing = await this.getMembership(groupId, userId);
        if (existing) return existing;
        const member = this.memberRepo.create({ groupId, userId, role: "member", status });
        const saved = await this.memberRepo.save(member);
        if (status === "active") await this.touchGroup(groupId);
        return saved;
    }

    async approveMember(groupId: string, userId: string): Promise<GroupMember | null> {
        await this.memberRepo.update({ groupId, userId }, { status: "active" });
        await this.touchGroup(groupId);
        return this.getMembership(groupId, userId);
    }

    async rejectMember(groupId: string, userId: string): Promise<void> {
        await this.memberRepo.delete({ groupId, userId });
        await this.touchGroup(groupId);
    }

    async removeMember(groupId: string, userId: string): Promise<void> {
        await this.memberRepo.delete({ groupId, userId });
        await this.touchGroup(groupId);
    }

    async promoteToAdmin(groupId: string, userId: string): Promise<GroupMember | null> {
        await this.memberRepo.update({ groupId, userId }, { role: "admin" });
        await this.touchGroup(groupId);
        return this.getMembership(groupId, userId);
    }

    async getPendingMembers(groupId: string): Promise<GroupMember[]> {
        return this.memberRepo.find({
            where: { groupId, status: "pending" },
            relations: ["user"],
        });
    }

    async isAdmin(groupId: string, userId: string): Promise<boolean> {
        const m = await this.getMembership(groupId, userId);
        return m?.role === "admin" && m?.status === "active";
    }

    async isMember(groupId: string, userId: string): Promise<boolean> {
        const m = await this.getMembership(groupId, userId);
        return m?.status === "active";
    }

    async findByExternalId(externalId: string): Promise<Group | null> {
        return this.groupRepo.findOne({ where: { externalId } });
    }

    async findByEname(ename: string): Promise<Group | null> {
        return this.groupRepo.findOne({ where: { ename } });
    }

    async createGroupDirect(data: {
        name: string;
        externalId: string;
        createdBy: string;
        ename?: string;
        description?: string;
        logo?: string;
    }): Promise<Group> {
        const group = this.groupRepo.create({
            name: data.name,
            externalId: data.externalId,
            createdBy: data.createdBy,
            ename: data.ename,
            description: data.description,
            logo: data.logo,
            inviteCode: this.generateInviteCode(),
            joinMode: "approval_required",
        });
        return this.groupRepo.save(group);
    }

    async addMemberDirect(groupId: string, userId: string, role: MemberRole): Promise<void> {
        const existing = await this.getMembership(groupId, userId);
        if (existing) return;
        const member = this.memberRepo.create({ groupId, userId, role, status: "active" });
        await this.memberRepo.save(member);
        await this.touchGroup(groupId);
    }
}
