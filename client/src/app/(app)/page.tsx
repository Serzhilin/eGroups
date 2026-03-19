"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Plus, ChevronRight, Clock } from "lucide-react";

interface GroupSummary {
    id: string;
    name: string;
    description?: string;
    logo?: string;
    joinMode: "open" | "approval_required";
    memberCount: number;
    myRole: "admin" | "member";
    myStatus: "active" | "pending";
    createdAt: string;
}

export default function HomePage() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<GroupSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        apiClient
            .get("/api/groups/my")
            .then((res) => setGroups(res.data))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">My Groups</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Welcome back, {user?.name || user?.ename}
                    </p>
                </div>
                <Link href="/create">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        New Group
                    </Button>
                </Link>
            </div>

            {isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                    ))}
                </div>
            ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                    <div className="rounded-full bg-muted p-6">
                        <Users className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="font-medium">No groups yet</p>
                        <p className="text-sm text-muted-foreground">
                            Create your first group or join one via an invite link.
                        </p>
                    </div>
                    <Link href="/create">
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Create a Group
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {groups.map((group) => (
                        <Link key={group.id} href={`/groups/${group.id}`}>
                            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                <CardContent className="p-4 flex items-center gap-3">
                                    {/* Logo / avatar */}
                                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {group.logo ? (
                                            <img
                                                src={group.logo}
                                                alt={group.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <Users className="h-6 w-6 text-primary" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium truncate">{group.name}</span>
                                            <Badge
                                                variant={group.myRole === "admin" ? "default" : "secondary"}
                                                className="text-xs"
                                            >
                                                {group.myRole}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                            <Users className="h-3 w-3" />
                                            {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                                            {group.joinMode === "approval_required" && (
                                                <span className="ml-2 flex items-center gap-0.5">
                                                    <Clock className="h-3 w-3" /> approval required
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
