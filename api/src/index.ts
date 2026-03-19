import "reflect-metadata";
import path from "node:path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { AppDataSource } from "./database/data-source";
import { AuthController } from "./controllers/AuthController";
import { UserController } from "./controllers/UserController";
import { GroupController } from "./controllers/GroupController";
import { WebhookController } from "./controllers/WebhookController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { EVaultSyncService } from "./services/EVaultSyncService";
import { UserService } from "./services/UserService";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.EGROUPS_API_PORT || process.env.PORT || 4004;

AppDataSource.initialize()
    .then(() => {
        console.log("Database connection established");
    })
    .catch((error: unknown) => {
        console.error("Error during initialization:", error);
        process.exit(1);
    });

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const authController = new AuthController();
const userController = new UserController();
const groupController = new GroupController();
const webhookController = new WebhookController();
const evaultSync = new EVaultSyncService();
const userService = new UserService();

// Public routes
app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "egroups-api",
        database: AppDataSource.isInitialized ? "connected" : "disconnected",
    });
});

app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);
app.post("/api/webhook", webhookController.handleWebhook);

// Public group info via invite code (so unauthenticated users see group name before login)
app.get("/api/groups/invite/:inviteCode", groupController.getGroupByInviteCode);

// Protected routes
app.use(authMiddleware);

app.get("/api/users/me", authGuard, userController.currentUser);

app.get("/api/groups/my", authGuard, groupController.getUserGroups);
app.post("/api/groups", authGuard, groupController.createGroup);
app.get("/api/groups/:id", authGuard, groupController.getGroupById);
app.put("/api/groups/:id", authGuard, groupController.updateGroup);
app.delete("/api/groups/:id", authGuard, groupController.deleteGroup);

// Join via invite code (authenticated)
app.post("/api/groups/join/:inviteCode", authGuard, groupController.joinByInviteCode);

// Member management
app.get("/api/groups/:id/pending", authGuard, groupController.getPendingMembers);
app.post("/api/groups/:id/members/:userId/approve", authGuard, groupController.approveMember);
app.post("/api/groups/:id/members/:userId/reject", authGuard, groupController.rejectMember);
app.delete("/api/groups/:id/members/:userId", authGuard, groupController.removeMember);
app.post("/api/groups/:id/members/:userId/promote", authGuard, groupController.promoteToAdmin);

// Invite code management
app.post("/api/groups/:id/invite/regenerate", authGuard, groupController.regenerateInviteCode);

// Manual eVault sync
app.post("/api/groups/sync", authGuard, async (req, res) => {
    const user = await userService.getUserById((req as any).user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    evaultSync.syncGroupsForUser(user).catch(console.error);
    res.json({ message: "Sync started" });
});

app.listen(port, () => {
    console.log(`eGroups API running on port ${port}`);
});
