import axios from "axios";
import { User } from "../database/entities/User";
import { GroupService } from "./GroupService";
import { UserService } from "./UserService";

const GROUP_SCHEMA_ID = "550e8400-e29b-41d4-a716-446655440003";

interface ParticipantInfo {
    ename: string;
    name: string;
    avatarUrl: string | null;
}

interface RawGroup {
    id: string;
    parsed: {
        name: string;
        // eGroups-created groups use participantIds (MetaEnvelope UUIDs)
        participantIds?: string[];
        // eCharter-created groups use members (enames) and eName (group's own eVault w3id)
        members?: string[];
        admins: string[];
        createdAt?: string;
        ename?: string | null;
        eName?: string | null; // eCharter uses capital N
    };
}

// Registry /resolve expects @ename
function withAt(ename: string): string {
    return ename.startsWith("@") ? ename : `@${ename}`;
}

// eVault GraphQL X-ENAME must match exactly how EVaultClient stores it — without @
function withoutAt(ename: string): string {
    return ename.startsWith("@") ? ename.slice(1) : ename;
}

export class EVaultSyncService {
    private groupService = new GroupService();
    private userService = new UserService();

    private async getPlatformToken(): Promise<string> {
        const registryUrl = process.env.PUBLIC_REGISTRY_URL;
        const platformUrl = process.env.PUBLIC_EGROUPS_BASE_URL;
        const response = await axios.post(`${registryUrl}/platforms/certification`, {
            platform: platformUrl,
        });
        return response.data.token as string;
    }

    private async getEvaultUrl(ename: string): Promise<string> {
        const registryUrl = process.env.PUBLIC_REGISTRY_URL;
        const response = await axios.get(`${registryUrl}/resolve`, {
            params: { w3id: withAt(ename) },
        });
        return response.data.uri as string;
    }

    private async graphql(
        evaultUrl: string,
        ename: string,
        token: string,
        query: string,
    ): Promise<unknown> {
        const response = await axios.post(
            `${evaultUrl}/graphql`,
            { query },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-ENAME": withAt(ename),
                    "Content-Type": "application/json",
                },
            },
        );
        return response.data;
    }

    private async fetchGroupsFromEvault(
        evaultUrl: string,
        ename: string,
        token: string,
    ): Promise<RawGroup[]> {
        const query = `
            query {
                findMetaEnvelopesByOntology(ontology: "${GROUP_SCHEMA_ID}") {
                    id
                    parsed
                }
            }
        `;
        const result = (await this.graphql(evaultUrl, ename, token, query)) as {
            data: { findMetaEnvelopesByOntology: RawGroup[] };
            errors?: unknown[];
        };
        console.log("[EVaultSync] fetchGroups raw response:", JSON.stringify(result));
        const groups = result.data?.findMetaEnvelopesByOntology ?? [];
        console.log(`[EVaultSync] fetchGroups: found ${groups.length} groups`);
        return groups;
    }

    private async resolveParticipant(
        evaultUrl: string,
        globalId: string,
        token: string,
        ename: string,
    ): Promise<ParticipantInfo | null> {
        const query = `
            query {
                metaEnvelope(id: "${globalId}") {
                    parsed
                }
            }
        `;
        try {
            const result = (await this.graphql(evaultUrl, ename, token, query)) as {
                data: { metaEnvelope: { parsed: { ename?: string; username?: string; displayName?: string; avatarUrl?: string } } | null };
            };
            const envelope = result.data?.metaEnvelope;
            console.log(`[EVaultSync] resolveParticipant ${globalId} parsed:`, JSON.stringify(envelope?.parsed));
            // Field may be 'ename' (eGroups/eCharter) or 'username' (blabsy)
            const parsedEname = envelope?.parsed?.ename ?? envelope?.parsed?.username;
            if (!parsedEname) {
                console.log(`[EVaultSync] resolveParticipant ${globalId}: no ename in envelope`);
                return null;
            }
            return {
                ename: withAt(parsedEname),
                name: envelope!.parsed!.displayName ?? parsedEname,
                avatarUrl: envelope!.parsed!.avatarUrl ?? null,
            };
        } catch (err) {
            console.error(`[EVaultSync] resolveParticipant ${globalId} error:`, err);
            return null;
        }
    }

    private async resolveUserProfile(
        evaultUrl: string,
        ename: string,
        token: string,
    ): Promise<{ name: string | null; metaEnvelopeId: string | null }> {
        const USER_SCHEMA_ID = "550e8400-e29b-41d4-a716-446655440000";
        const query = `
            query {
                findMetaEnvelopesByOntology(ontology: "${USER_SCHEMA_ID}") {
                    id
                    parsed
                }
            }
        `;
        try {
            const result = (await this.graphql(evaultUrl, ename, token, query)) as {
                data: { findMetaEnvelopesByOntology: Array<{ id: string; parsed: Record<string, unknown> }> };
            };
            const envelopes = result.data?.findMetaEnvelopesByOntology ?? [];
            if (envelopes.length > 0) {
                return {
                    name: (envelopes[0].parsed?.displayName as string) ?? null,
                    metaEnvelopeId: envelopes[0].id ?? null,
                };
            }
        } catch (err) {
            console.error("[EVaultSync] resolveUserProfile error:", err);
        }
        return { name: null, metaEnvelopeId: null };
    }

    async resolveAndUpdateName(user: User): Promise<string | null> {
        const normalizedEname = withoutAt(user.ename);
        const needsNameResolution = user.name === normalizedEname || user.name === withAt(user.ename);
        const needsMetaEnvelopeId = !user.externalMetaEnvelopeId;

        if (!needsNameResolution && !needsMetaEnvelopeId) {
            return null; // nothing to resolve
        }

        try {
            const token = await this.getPlatformToken();
            const evaultUrl = await this.getEvaultUrl(user.ename);

            // First: directly query the user's own profile MetaEnvelope (blabsy schema 000)
            const { name, metaEnvelopeId } = await this.resolveUserProfile(evaultUrl, user.ename, token);

            if (metaEnvelopeId && needsMetaEnvelopeId) {
                await this.userService.updateUser(user.id, { externalMetaEnvelopeId: metaEnvelopeId } as any);
                console.log(`[EVaultSync] stored externalMetaEnvelopeId ${metaEnvelopeId} for ${user.ename}`);
            }

            if (needsNameResolution && name && name !== normalizedEname) {
                await this.userService.updateUser(user.id, { name });
                return name;
            }

            // Fallback: scan groups to find user's own participant MetaEnvelope
            if (needsNameResolution) {
                const groups = await this.fetchGroupsFromEvault(evaultUrl, user.ename, token);
                for (const group of groups) {
                    for (const participantId of group.parsed?.participantIds ?? []) {
                        const info = await this.resolveParticipant(evaultUrl, participantId, token, user.ename);
                        if (info && withoutAt(info.ename) === normalizedEname) {
                            if (info.name && info.name !== normalizedEname) {
                                await this.userService.updateUser(user.id, { name: info.name });
                                return info.name;
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error("[EVaultSync] resolveAndUpdateName error:", err);
        }
        return null;
    }

    async syncGroupsForUser(currentUser: User): Promise<void> {
        console.log(`[EVaultSync] starting sync for ${currentUser.ename}`);
        try {
            const token = await this.getPlatformToken();
            console.log("[EVaultSync] got platform token");

            const evaultUrl = await this.getEvaultUrl(currentUser.ename);
            console.log("[EVaultSync] evaultUrl:", evaultUrl);
            console.log("[EVaultSync] querying with X-ENAME:", withAt(currentUser.ename));

            const rawGroups = await this.fetchGroupsFromEvault(evaultUrl, currentUser.ename, token);

            for (const rawGroup of rawGroups) {
                console.log(`[EVaultSync] importing group "${rawGroup.parsed?.name}" (${rawGroup.id})`);
                await this.importGroup(rawGroup, currentUser, evaultUrl, token);
            }

            console.log("[EVaultSync] sync complete");
        } catch (error) {
            console.error("[EVaultSync] sync failed:", error);
        }
    }

    private async importGroup(
        rawGroup: RawGroup,
        currentUser: User,
        evaultUrl: string,
        token: string,
    ): Promise<void> {
        const externalId = rawGroup.id;
        const parsed = rawGroup.parsed;

        // Support both eGroups format (participantIds = MetaEnvelope UUIDs)
        // and eCharter format (members = enames)
        const participantIds: string[] = parsed.participantIds ?? [];
        const memberEnames: string[] = parsed.members ?? [];
        const groupEname = parsed.ename ?? parsed.eName ?? undefined;

        if (!parsed?.name || (participantIds.length === 0 && memberEnames.length === 0)) {
            console.log(`[EVaultSync] skipping group ${externalId}: missing name or members`);
            return;
        }

        const existing = await this.groupService.findByExternalId(externalId)
            ?? (groupEname ? await this.groupService.findByEname(groupEname) : null);

        let groupId: string;
        if (existing) {
            groupId = existing.id;
            console.log(`[EVaultSync] group already exists: ${groupId}`);
        } else {
            const group = await this.groupService.createGroupDirect({
                name: parsed.name,
                externalId,
                createdBy: currentUser.ename,
                ename: groupEname,
            });
            groupId = group.id;
            console.log(`[EVaultSync] created group: ${groupId}`);
        }

        const adminSet = new Set<string>(parsed.admins ?? []);

        // Resolve ename-based members (eCharter format)
        for (const memberEname of memberEnames) {
            const { user } = await this.userService.findOrCreateByEname(memberEname);
            const isMember = await this.groupService.isMember(groupId, user.id);
            if (!isMember) {
                const role = adminSet.has(memberEname) ? "admin" : "member";
                await this.groupService.addMemberDirect(groupId, user.id, role);
                console.log(`[EVaultSync] added ${memberEname} as ${role} (ename-based)`);
            }
        }

        console.log(`[EVaultSync] resolving ${participantIds.length} UUID-based participants`);

        for (const participantGlobalId of participantIds) {
            const info = await this.resolveParticipant(
                evaultUrl,
                participantGlobalId,
                token,
                currentUser.ename,
            );

            if (!info) {
                // Can't resolve this participant via current user's eVault context (different tenant).
                // Check if another user already logged in and has this MetaEnvelope ID stored.
                const knownUser = await this.userService.findByExternalMetaEnvelopeId(participantGlobalId);
                if (knownUser) {
                    console.log(`[EVaultSync] participant ${participantGlobalId} resolved via stored ID: ${knownUser.ename}`);
                    const isMember = await this.groupService.isMember(groupId, knownUser.id);
                    if (!isMember) {
                        const role = adminSet.has(participantGlobalId) ? "admin" : "member";
                        await this.groupService.addMemberDirect(groupId, knownUser.id, role);
                        console.log(`[EVaultSync] added stored user ${knownUser.ename} as ${role}`);
                    }
                } else {
                    console.log(`[EVaultSync] participant ${participantGlobalId}: unresolvable, will link when they log in`);
                }
                continue;
            }

            console.log(`[EVaultSync] participant resolved: ${info.ename} (${info.name})`);

            const { user } = await this.userService.findOrCreateByEname(info.ename);

            // Store blabsy MetaEnvelope ID for future cross-reference
            if (!user.externalMetaEnvelopeId) {
                await this.userService.updateUser(user.id, { externalMetaEnvelopeId: participantGlobalId } as any);
            }

            // Update name/avatar if still using ename as placeholder
            const storedName = user.name ?? "";
            const normalizedEname = info.ename.replace(/^@/, "");
            if ((storedName === normalizedEname || storedName === info.ename) && info.name !== normalizedEname) {
                await this.userService.updateUser(user.id, {
                    name: info.name,
                    avatarUrl: info.avatarUrl ?? undefined,
                });
                console.log(`[EVaultSync] updated name for ${info.ename}: "${info.name}"`);
            }

            const isMember = await this.groupService.isMember(groupId, user.id);
            if (!isMember) {
                const role = adminSet.has(participantGlobalId) ? "admin" : "member";
                await this.groupService.addMemberDirect(groupId, user.id, role);
                console.log(`[EVaultSync] added ${info.ename} as ${role}`);
            }
        }
    }
}
