import { Request, Response } from "express";
import { GroupService } from "../services/GroupService";
import { JoinMode } from "../database/entities/Group";
import { adapter } from "../web3adapter/watchers/subscriber";

export class GroupController {
    private groupService: GroupService;

    constructor() {
        this.groupService = new GroupService();
    }

    // GET /api/groups/my
    getUserGroups = async (req: Request, res: Response) => {
        try {
            const groups = await this.groupService.getUserGroups(req.user!.id);
            // Attach caller's membership info to each group
            const result = await Promise.all(
                groups.map(async (group) => {
                    const membership = await this.groupService.getMembership(
                        group.id,
                        req.user!.id,
                    );
                    const memberCount = group.members?.filter(
                        (m) => m.status === "active",
                    ).length ?? 0;
                    return {
                        ...group,
                        memberCount,
                        myRole: membership?.role,
                        myStatus: membership?.status,
                    };
                }),
            );
            res.json(result);
        } catch (error) {
            console.error("getUserGroups error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // GET /api/groups/:id
    getGroupById = async (req: Request, res: Response) => {
        try {
            const group = await this.groupService.getGroupById(req.params.id);
            if (!group) return res.status(404).json({ error: "Group not found" });

            const membership = await this.groupService.getMembership(
                group.id,
                req.user!.id,
            );
            const memberCount = group.members?.filter(
                (m) => m.status === "active",
            ).length ?? 0;
            const pendingCount = group.members?.filter(
                (m) => m.status === "pending",
            ).length ?? 0;

            res.json({
                ...group,
                memberCount,
                pendingCount,
                myRole: membership?.role ?? null,
                myStatus: membership?.status ?? null,
            });
        } catch (error) {
            console.error("getGroupById error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // POST /api/groups
    createGroup = async (req: Request, res: Response) => {
        try {
            const { name, description, logo, joinMode } = req.body;
            if (!name) return res.status(400).json({ error: "name is required" });

            const validJoinModes: JoinMode[] = ["open", "approval_required"];
            const resolvedJoinMode: JoinMode = validJoinModes.includes(joinMode)
                ? joinMode
                : "open";

            // Step 1: Save the group locally (no ename yet)
            const group = await this.groupService.createGroup({
                name,
                description,
                logo,
                joinMode: resolvedJoinMode,
                creatorUser: req.user!,
            });

            // Step 2: Lock to block premature subscriber sync
            adapter.addToLockedIds(group.id);

            try {
                // Step 3: Fetch full group with creator as admin member
                const fullGroup = await this.groupService.getGroupById(group.id);
                const activeMembers = fullGroup?.members
                    ?.filter((m) => m.status === "active")
                    .map((m) => m.user?.ename || m.userId) ?? [];
                const adminMembers = fullGroup?.members
                    ?.filter((m) => m.status === "active" && m.role === "admin")
                    .map((m) => m.user?.ename || m.userId) ?? [];

                // Step 4: Provision the group's own eVault
                const evaultResult = await adapter.createGroupEVault({
                    name,
                    avatar: logo,
                    description,
                    members: activeMembers,
                    admins: adminMembers,
                    owner: req.user!.ename,
                });

                // Step 5: Store the w3id as the group's ename
                await this.groupService.setEname(group.id, evaultResult.w3id);
                group.ename = evaultResult.w3id;

                // Store local→global mapping so future syncs use the UPDATE path,
                // not the CREATE path (which would create a duplicate MetaEnvelope)
                await adapter.mappingDb.storeMapping({
                    localId: group.id,
                    globalId: evaultResult.manifestId,
                });

                // Step 6: Explicitly unlock so the subscriber can sync on future changes
                const lockIdx = adapter.lockedIds.indexOf(group.id);
                if (lockIdx !== -1) adapter.lockedIds.splice(lockIdx, 1);

                // Step 7: Trigger a sync with full group data (members included)
                setTimeout(async () => {
                    const syncGroup = await this.groupService.getGroupById(group.id);
                    if (!syncGroup?.ename) return;
                    const enriched: any = { ...syncGroup };
                    enriched.members = syncGroup.members.filter((m: any) => m.status === "active");
                    adapter.handleChange({ data: enriched, tableName: "groups" });
                }, 500);
            } catch (evaultError) {
                console.error("createGroup: eVault provisioning failed (non-fatal):", evaultError);
                // Group was created locally — ename stays null until provisioned later
            }

            const result = await this.groupService.getGroupById(group.id);
            res.status(201).json(result ?? group);
        } catch (error) {
            console.error("createGroup error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // PUT /api/groups/:id
    updateGroup = async (req: Request, res: Response) => {
        try {
            const isAdmin = await this.groupService.isAdmin(
                req.params.id,
                req.user!.id,
            );
            if (!isAdmin)
                return res.status(403).json({ error: "Admin access required" });

            const { name, description, logo, joinMode } = req.body;
            const group = await this.groupService.updateGroup(req.params.id, {
                name,
                description,
                logo,
                joinMode,
            });
            res.json(group);
        } catch (error) {
            console.error("updateGroup error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // DELETE /api/groups/:id
    deleteGroup = async (req: Request, res: Response) => {
        try {
            const isAdmin = await this.groupService.isAdmin(
                req.params.id,
                req.user!.id,
            );
            if (!isAdmin)
                return res.status(403).json({ error: "Admin access required" });

            await this.groupService.deleteGroup(req.params.id);
            res.status(204).send();
        } catch (error) {
            console.error("deleteGroup error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // POST /api/groups/join/:inviteCode
    joinByInviteCode = async (req: Request, res: Response) => {
        try {
            const group = await this.groupService.getGroupByInviteCode(
                req.params.inviteCode,
            );
            if (!group) return res.status(404).json({ error: "Invalid invite code" });

            const existing = await this.groupService.getMembership(
                group.id,
                req.user!.id,
            );
            if (existing) {
                return res.json({
                    group,
                    membership: existing,
                    alreadyMember: true,
                });
            }

            const status =
                group.joinMode === "approval_required" ? "pending" : "active";
            const membership = await this.groupService.joinGroup(
                group.id,
                req.user!.id,
                status,
            );

            res.status(201).json({ group, membership, pending: status === "pending" });
        } catch (error) {
            console.error("joinByInviteCode error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // GET /api/groups/invite/:inviteCode  (public — used before auth to show group info)
    getGroupByInviteCode = async (req: Request, res: Response) => {
        try {
            const group = await this.groupService.getGroupByInviteCode(
                req.params.inviteCode,
            );
            if (!group) return res.status(404).json({ error: "Invalid invite code" });
            const memberCount =
                group.members?.filter((m) => m.status === "active").length ?? 0;
            res.json({ id: group.id, name: group.name, description: group.description, logo: group.logo, joinMode: group.joinMode, memberCount });
        } catch (error) {
            console.error("getGroupByInviteCode error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // GET /api/groups/:id/pending
    getPendingMembers = async (req: Request, res: Response) => {
        try {
            const isAdmin = await this.groupService.isAdmin(
                req.params.id,
                req.user!.id,
            );
            if (!isAdmin)
                return res.status(403).json({ error: "Admin access required" });

            const pending = await this.groupService.getPendingMembers(req.params.id);
            res.json(pending);
        } catch (error) {
            console.error("getPendingMembers error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // POST /api/groups/:id/members/:userId/approve
    approveMember = async (req: Request, res: Response) => {
        try {
            const isAdmin = await this.groupService.isAdmin(
                req.params.id,
                req.user!.id,
            );
            if (!isAdmin)
                return res.status(403).json({ error: "Admin access required" });

            const membership = await this.groupService.approveMember(
                req.params.id,
                req.params.userId,
            );
            res.json(membership);
        } catch (error) {
            console.error("approveMember error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // POST /api/groups/:id/members/:userId/reject
    rejectMember = async (req: Request, res: Response) => {
        try {
            const isAdmin = await this.groupService.isAdmin(
                req.params.id,
                req.user!.id,
            );
            if (!isAdmin)
                return res.status(403).json({ error: "Admin access required" });

            await this.groupService.rejectMember(req.params.id, req.params.userId);
            res.status(204).send();
        } catch (error) {
            console.error("rejectMember error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // DELETE /api/groups/:id/members/:userId
    removeMember = async (req: Request, res: Response) => {
        try {
            const isAdmin = await this.groupService.isAdmin(
                req.params.id,
                req.user!.id,
            );
            // Also allow self-leave
            const isSelf = req.params.userId === req.user!.id;
            if (!isAdmin && !isSelf)
                return res.status(403).json({ error: "Admin access required" });

            await this.groupService.removeMember(req.params.id, req.params.userId);
            res.status(204).send();
        } catch (error) {
            console.error("removeMember error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // POST /api/groups/:id/members/:userId/promote
    promoteToAdmin = async (req: Request, res: Response) => {
        try {
            const isAdmin = await this.groupService.isAdmin(
                req.params.id,
                req.user!.id,
            );
            if (!isAdmin)
                return res.status(403).json({ error: "Admin access required" });

            const membership = await this.groupService.promoteToAdmin(
                req.params.id,
                req.params.userId,
            );
            res.json(membership);
        } catch (error) {
            console.error("promoteToAdmin error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // POST /api/groups/:id/invite/regenerate
    regenerateInviteCode = async (req: Request, res: Response) => {
        try {
            const isAdmin = await this.groupService.isAdmin(
                req.params.id,
                req.user!.id,
            );
            if (!isAdmin)
                return res.status(403).json({ error: "Admin access required" });

            const inviteCode = await this.groupService.regenerateInviteCode(
                req.params.id,
            );
            res.json({ inviteCode });
        } catch (error) {
            console.error("regenerateInviteCode error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
