import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.EGROUPS_JWT_SECRET || "egroups-secret-key";

export const signToken = (payload: object): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string): { userId: string } => {
    try {
        return jwt.verify(token, JWT_SECRET) as { userId: string };
    } catch {
        throw new Error("Invalid token");
    }
};
