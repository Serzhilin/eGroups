import {
    EventSubscriber,
    EntitySubscriberInterface,
    InsertEvent,
    UpdateEvent,
    RemoveEvent,
    ObjectLiteral,
} from "typeorm";
import { Web3Adapter } from "web3-adapter";
import path from "path";
import dotenv from "dotenv";
import { AppDataSource } from "../../database/data-source";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

export const adapter = new Web3Adapter({
    schemasPath: path.resolve(__dirname, "../mappings/"),
    dbPath: path.resolve(process.env.EGROUPS_MAPPING_DB_PATH || "./egroups-mapping.db"),
    registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
    platform: process.env.PUBLIC_EGROUPS_BASE_URL as string,
    provisionerUrl: process.env.PUBLIC_PROVISIONER_URL as string,
});

@EventSubscriber()
export class PostgresSubscriber implements EntitySubscriberInterface {
    private adapter: Web3Adapter;

    constructor() {
        this.adapter = adapter;
    }

    async afterInsert(event: InsertEvent<any>) {
        const tableName = event.metadata.tableName.endsWith("s")
            ? event.metadata.tableName
            : event.metadata.tableName + "s";

        let entity = event.entity;
        if (entity) {
            entity = (await this.enrichEntity(
                entity,
                event.metadata.tableName,
                event.metadata.target,
            )) as ObjectLiteral;
        }

        await this.handleChange(entity ?? event.entityId, tableName);
    }

    async afterUpdate(event: UpdateEvent<any>) {
        const tableName = event.metadata.tableName.endsWith("s")
            ? event.metadata.tableName
            : event.metadata.tableName + "s";

        let entityId = event.entity?.id || event.databaseEntity?.id;
        let entity = event.entity;

        if (entityId) {
            const repository = AppDataSource.getRepository(event.metadata.target);
            const entityName =
                typeof event.metadata.target === "function"
                    ? event.metadata.target.name
                    : event.metadata.target;

            const fullEntity = await repository.findOne({
                where: { id: entityId },
                relations: this.getRelationsForEntity(entityName),
            });

            if (fullEntity) {
                entity = (await this.enrichEntity(
                    fullEntity,
                    event.metadata.tableName,
                    event.metadata.target,
                )) as ObjectLiteral;
            }
        }

        await this.handleChange(entity ?? event.databaseEntity, tableName);
    }

    async afterRemove(event: RemoveEvent<any>) {
        const tableName = event.metadata.tableName.endsWith("s")
            ? event.metadata.tableName
            : event.metadata.tableName + "s";
        await this.handleChange(event.entityId, tableName);
    }

    private async enrichEntity(entity: any, tableName: string, target: any): Promise<any> {
        try {
            const enriched = { ...entity };

            if (tableName === "groups" && entity.id) {
                const fullGroup = await AppDataSource.getRepository("Group").findOne({
                    where: { id: entity.id },
                    relations: ["members", "members.user"],
                });
                if (fullGroup) {
                    const enriched = { ...this.entityToPlain(fullGroup) };
                    enriched.members = fullGroup.members
                        .filter((m: any) => m.status === "active")
                        .map((m: any) => this.entityToPlain(m));
                    return enriched;
                }
            }

            return this.entityToPlain(enriched);
        } catch (error) {
            console.error("Error enriching entity:", error);
            return this.entityToPlain(entity);
        }
    }

    private async handleChange(entity: any, tableName: string): Promise<void> {
        // group_members changes are propagated via touchGroup() calls in GroupService
        if (tableName === "group_members") return;

        // Skip groups that haven't been provisioned with an eVault yet
        if (tableName === "groups" && !entity?.ename) return;

        const data = this.entityToPlain(entity);
        if (!data.id) return;

        try {
            setTimeout(async () => {
                let globalId = await this.adapter.mappingDb.getGlobalId(data.id);
                globalId = globalId ?? "";

                if (this.adapter.lockedIds.includes(globalId)) return;
                if (this.adapter.lockedIds.includes(data.id)) return;

                await this.adapter.handleChange({
                    data,
                    tableName: tableName.toLowerCase(),
                });
            }, 3_000);
        } catch (error) {
            console.error(`Error processing change for ${tableName}:`, error);
        }
    }

    private getRelationsForEntity(entityName: string): string[] {
        switch (entityName) {
            case "Group":
                return ["members", "members.user"];
            default:
                return [];
        }
    }

    private entityToPlain(entity: any): any {
        if (!entity || typeof entity !== "object") return entity;
        if (entity instanceof Date) return entity.toISOString();
        if (Array.isArray(entity)) return entity.map((i) => this.entityToPlain(i));

        const plain: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(entity)) {
            if (key.startsWith("_")) continue;
            if (value && typeof value === "object") {
                if (Array.isArray(value)) {
                    plain[key] = value.map((i) => this.entityToPlain(i));
                } else if (value instanceof Date) {
                    plain[key] = value.toISOString();
                } else {
                    plain[key] = this.entityToPlain(value);
                }
            } else {
                plain[key] = value;
            }
        }
        return plain;
    }
}
