"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Users, Plus, LogOut } from "lucide-react";

export function Navigation() {
    const { user, logout } = useAuth();

    return (
        <nav className="border-b bg-background sticky top-0 z-40">
            <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 font-bold text-lg">
                    <Users className="h-5 w-5 text-primary" />
                    eGroups
                </Link>

                <div className="flex items-center gap-2">
                    <Link href="/create">
                        <Button size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-1" />
                            New Group
                        </Button>
                    </Link>
                    {user && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground hidden sm:block">
                                {user.name || user.ename}
                            </span>
                            <Button size="icon" variant="ghost" onClick={logout}>
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
