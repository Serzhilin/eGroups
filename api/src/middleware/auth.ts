import type { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { verifyToken } from "../utils/jwt";

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return next();
        }

        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token);

        if (!decoded?.userId) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const user = await AppDataSource.getRepository(User).findOneBy({
            id: decoded.userId,
        });

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        req.user = user;
        next();
    } catch {
        res.status(401).json({ error: "Invalid token" });
    }
};

export const authGuard = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    next();
};
