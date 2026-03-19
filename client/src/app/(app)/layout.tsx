"use client";

import { Navigation } from "@/components/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <Navigation />
            <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
        </ProtectedRoute>
    );
}
