import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { GroupService } from "../services/GroupService";
import { adapter } from "../web3adapter/watchers/subscriber";

// Accept user profile MetaEnvelopes from any registered platform (blabsy uses 000, egroups uses 001)
const USER_SCHEMA_IDS = [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001",
];

export class WebhookController {
    private userService: UserService;
    private groupService: GroupService;
    private adapter: typeof adapter;

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.adapter = adapter;
    }

    private async handleGroupWebhook(externalId: string, data: Record<string, any>, ownerEname: string): Promise<void> {
        const groupName: string = data.name;
        const participantIds: string[] = data.participantIds || [];
        const admins: string[] = data.admins || [];
        // ename is the group's own eVault w3id (may equal ownerEname for group eVaults)
        const ename: string = data.ename || ownerEname;

        if (!groupName || !participantIds.length) {
            console.log(`[Webhook] skipping group ${externalId}: missing name or participants`);
            return;
        }

        let group = await this.groupService.findByExternalId(externalId);
        if (!group && ename) {
            group = await this.groupService.findByEname(ename);
        }
        let groupId: string;

        if (!group) {
            console.log(`[Webhook] creating group "${groupName}" (${externalId})`);
            const created = await this.groupService.createGroupDirect({
                name: groupName,
                externalId,
                createdBy: ownerEname,
                ename,
                description: data.description,
                logo: data.avatarUrl,
            });
            groupId = created.id;
            // Lock to prevent echo-sync of the newly received webhook data
            this.adapter.addToLockedIds(created.id);
        } else {
            groupId = group.id;
            // Update description/logo if they have changed
            if (
                (data.description && data.description !== group.description) ||
                (data.avatarUrl && data.avatarUrl !== group.logo)
            ) {
                await this.groupService.updateGroup(groupId, {
                    description: data.description ?? group.description,
                    logo: data.avatarUrl ?? group.logo,
                    ename: ename || group.ename,
                });
            }
        }

        // Add any participants we already know about (by their MetaEnvelope UUID)
        const adminSet = new Set(admins);
        for (const participantMetaEnvelopeId of participantIds) {
            const knownUser = await this.userService.findByExternalMetaEnvelopeId(participantMetaEnvelopeId);
            if (knownUser) {
                const isMember = await this.groupService.isMember(groupId, knownUser.id);
                if (!isMember) {
                    const role = adminSet.has(participantMetaEnvelopeId) ? "admin" : "member";
                    await this.groupService.addMemberDirect(groupId, knownUser.id, role);
                    console.log(`[Webhook] added ${knownUser.ename} as ${role} to group ${groupName}`);
                }
            }
        }
    }

    handleWebhook = async (req: Request, res: Response) => {
        try {
            const schemaId = req.body.schemaId;
            const globalId = req.body.id;

            console.log("Webhook received:", { schemaId, globalId, w3id: req.body.w3id });

            // For user schemas from any platform, use the local user mapping
            const isUserSchema = USER_SCHEMA_IDS.includes(schemaId);
            const mapping = isUserSchema
                ? (Object.values(this.adapter.mapping).find((m: any) => m.tableName === "users") as any)
                : (Object.values(this.adapter.mapping).find((m: any) => m.schemaId === schemaId) as any);

            if (!mapping) {
                console.log("No mapping found for schemaId:", schemaId);
                return res.status(200).send();
            }

            if (this.adapter.lockedIds.includes(globalId)) {
                return res.status(200).send();
            }

            this.adapter.addToLockedIds(globalId);

            const local = await this.adapter.fromGlobal({
                data: req.body.data,
                mapping,
            });

            const localId = await this.adapter.mappingDb.getLocalId(globalId);

            if (mapping.tableName === "users") {
                // For cross-platform user webhooks, ename is in data.ename; for egroups native, w3id IS the ename
                const ename: string = req.body.data?.ename || req.body.w3id;

                if (localId) {
                    await this.userService.updateUser(localId, {
                        name: req.body.data.displayName,
                        avatarUrl: local.data.avatarUrl as string | undefined,
                        isVerified: local.data.isVerified as boolean | undefined,
                        externalMetaEnvelopeId: globalId,
                    } as any);
                    await this.adapter.mappingDb.storeMapping({ localId, globalId });
                    this.adapter.addToLockedIds(localId);
                } else {
                    // Check if a user with this ename already exists (e.g. logged in before)
                    const existingUser = ename ? await this.userService.findByEname(ename) : null;

                    if (existingUser) {
                        console.log(`[Webhook] linking existing user ${ename} to MetaEnvelope ${globalId}`);
                        if (!existingUser.externalMetaEnvelopeId) {
                            await this.userService.updateUser(existingUser.id, {
                                name: req.body.data.displayName || existingUser.name,
                                avatarUrl: (req.body.data.avatarUrl || existingUser.avatarUrl) as any,
                                externalMetaEnvelopeId: globalId,
                            } as any);
                        }
                        await this.adapter.mappingDb.storeMapping({ localId: existingUser.id, globalId });
                        this.adapter.addToLockedIds(existingUser.id);
                    } else {
                        console.log(`[Webhook] creating user ${ename} from MetaEnvelope ${globalId}`);
                        const user = await this.userService.createBlankUser(ename);
                        await this.userService.updateUser(user.id, {
                            name: req.body.data.displayName,
                            avatarUrl: req.body.data.avatarUrl,
                            isVerified: req.body.data.isVerified,
                            externalMetaEnvelopeId: globalId,
                        } as any);
                        await this.adapter.mappingDb.storeMapping({ localId: user.id, globalId });
                        this.adapter.addToLockedIds(user.id);
                    }
                }
            } else if (mapping.tableName === "groups") {
                await this.handleGroupWebhook(globalId, req.body.data, req.body.w3id);
            }

            res.status(200).send();
        } catch (error) {
            console.error("Webhook error:", error);
            res.status(500).send();
        }
    };
}
