import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import { UserService } from "../services/UserService";
import { EVaultSyncService } from "../services/EVaultSyncService";
import { isVersionValid } from "../utils/version";
import { verifySignature } from "signature-validator";

const MIN_REQUIRED_VERSION = "0.4.0";

export class AuthController {
    private userService: UserService;
    private eventEmitter: EventEmitter;

    private evaultSync: EVaultSyncService;

    constructor() {
        this.userService = new UserService();
        this.eventEmitter = new EventEmitter();
        this.evaultSync = new EVaultSyncService();
    }

    sseStream = async (req: Request, res: Response) => {
        const { id } = req.params;

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
        });

        const handler = (data: unknown) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        this.eventEmitter.on(id, handler);

        req.on("close", () => {
            this.eventEmitter.off(id, handler);
            res.end();
        });

        req.on("error", () => {
            this.eventEmitter.off(id, handler);
            res.end();
        });
    };

    getOffer = async (req: Request, res: Response) => {
        const url = new URL(
            "/api/auth",
            process.env.PUBLIC_EGROUPS_BASE_URL,
        ).toString();
        const session = uuidv4();
        const offer = `w3ds://auth?redirect=${url}&session=${session}&platform=eGroups`;
        res.json({ uri: offer, sessionId: session });
    };

    login = async (req: Request, res: Response) => {
        try {
            const { ename, session, appVersion, signature } = req.body;

            if (!ename) return res.status(400).json({ error: "ename is required" });
            if (!session) return res.status(400).json({ error: "session is required" });
            if (!signature) return res.status(400).json({ error: "signature is required" });

            if (!appVersion || !isVersionValid(appVersion, MIN_REQUIRED_VERSION)) {
                const errorMessage = {
                    error: true,
                    message: `Your eID Wallet app version is outdated. Please update to version ${MIN_REQUIRED_VERSION} or later.`,
                    type: "version_mismatch",
                };
                this.eventEmitter.emit(session, errorMessage);
                return res.status(400).json({
                    error: "App version too old",
                    message: errorMessage.message,
                });
            }

            const registryBaseUrl = process.env.PUBLIC_REGISTRY_URL;
            if (!registryBaseUrl) {
                return res.status(500).json({ error: "Server configuration error" });
            }

            const verificationResult = await verifySignature({
                eName: ename,
                signature,
                payload: session,
                registryBaseUrl,
            });

            if (!verificationResult.valid) {
                return res.status(401).json({
                    error: "Invalid signature",
                    message: verificationResult.error,
                });
            }

            const { user, token } = await this.userService.findOrCreateByEname(ename);

            // Resolve real name synchronously before responding
            const resolvedName = await this.evaultSync.resolveAndUpdateName(user);
            if (resolvedName) user.name = resolvedName;

            const data = {
                user: {
                    id: user.id,
                    ename: user.ename,
                    name: user.name,
                    avatarUrl: user.avatarUrl,
                    isVerified: user.isVerified,
                },
                token,
            };

            this.eventEmitter.emit(session, data);
            res.status(200).json(data);

            // Trigger background eVault sync (non-blocking)
            this.evaultSync.syncGroupsForUser(user).catch((err) => {
                console.error("[auth] background eVault sync error:", err);
            });
        } catch (error) {
            console.error("Error during login:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
