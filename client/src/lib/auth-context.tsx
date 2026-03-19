"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "./apiClient";
import { getAuthToken, getAuthId, setAuthToken, setAuthId, clearAuth } from "./authUtils";

interface User {
    id: string;
    ename: string;
    name?: string;
    avatarUrl?: string;
    isVerified: boolean;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    logout: () => void;
    setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = getAuthToken();
        const userId = getAuthId();

        if (token && userId) {
            apiClient
                .get("/api/users/me")
                .then((res) => setUser(res.data))
                .catch(() => clearAuth())
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    const logout = () => {
        clearAuth();
        setUser(null);
        window.location.href = "/login";
    };

    return (
        <AuthContext.Provider
            value={{ user, isAuthenticated: !!user, isLoading, logout, setUser }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

export { setAuthToken, setAuthId };
