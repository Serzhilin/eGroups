import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";
import { DataSource, type DataSourceOptions } from "typeorm";
import { User } from "./entities/User";
import { Group } from "./entities/Group";
import { GroupMember } from "./entities/GroupMember";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const dataSourceOptions: DataSourceOptions = {
    type: "postgres",
    url: process.env.EGROUPS_DATABASE_URL,
    synchronize: false,
    entities: [User, Group, GroupMember],
    migrations: [path.join(__dirname, "migrations", "*.ts")],
    logging: process.env.NODE_ENV === "development",
    subscribers: [PostgresSubscriber],
    ssl: process.env.DB_CA_CERT
        ? {
              rejectUnauthorized: false,
              ca: process.env.DB_CA_CERT,
          }
        : false,
    extra: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
    },
};

export const AppDataSource = new DataSource(dataSourceOptions);
