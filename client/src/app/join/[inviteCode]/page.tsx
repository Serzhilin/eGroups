"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/navigation";
import { Users, Clock, Loader2 } from "lucide-react";

interface GroupPreview {
    id: string;
    name: string;
    description?: string;
    logo?: string;
    joinMode: "open" | "approval_required";
    memberCount: number;
}

export default function JoinGroupPage() {
    const { inviteCode } = useParams<{ inviteCode: string }>();
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const { toast } = useToast();

    const [group, setGroup] = useState<GroupPreview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [joined, setJoined] = useState(false);
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
        // Persist redirect so login page can bounce back here
        sessionStorage.setItem("postLoginRedirect", `/join/${inviteCode}`);

        const base = process.env.NEXT_PUBLIC_EGROUPS_BASE_URL || "http://localhost:4004";
        fetch(`${base}/api/groups/invite/${inviteCode}`)
            .then((r) => (r.ok ? r.json() : null))
            .then(setGroup)
            .catch(() => setGroup(null))
            .finally(() => setIsLoading(false));
    }, [inviteCode]);

    const handleJoin = async () => {
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }
        setIsJoining(true);
        try {
            const res = await apiClient.post(`/api/groups/join/${inviteCode}`);
            if (res.data.pending) {
                setIsPending(true);
                toast({ title: "Request sent", description: "Waiting for admin approval." });
            } else if (res.data.alreadyMember) {
                router.push(`/groups/${res.data.group.id}`);
            } else {
                setJoined(true);
                toast({ title: `Joined ${group?.name}!` });
                setTimeout(() => router.push(`/groups/${res.data.group.id}`), 1000);
            }
        } catch {
            toast({ title: "Failed to join", variant: "destructive" });
        } finally {
            setIsJoining(false);
        }
    };

    const showNav = isAuthenticated;

    return (
        <>
            {showNav && <Navigation />}
            <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-muted/30">
                {isLoading || authLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : !group ? (
                    <div className="text-center space-y-3">
                        <p className="font-medium">Invalid invite link</p>
                        <p className="text-sm text-muted-foreground">
                            This link may have expired or been regenerated.
                        </p>
                        <Button onClick={() => router.push("/")}>Back to Home</Button>
                    </div>
                ) : (
                    <Card className="w-full max-w-sm">
                        <CardHeader className="text-center pb-3">
                            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 overflow-hidden">
                                {group.logo ? (
                                    <img src={group.logo} alt={group.name} className="h-full w-full object-cover" />
                                ) : (
                                    <Users className="h-8 w-8 text-primary" />
                                )}
                            </div>
                            <CardTitle>{group.name}</CardTitle>
                            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                                <span className="text-sm text-muted-foreground">
                                    {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                    {group.joinMode === "open" ? "Open" : "Approval required"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="text-center space-y-4">
                            {group.description && (
                                <p className="text-sm text-muted-foreground">{group.description}</p>
                            )}

                            {joined ? (
                                <p className="text-green-600 font-medium">Joined! Redirecting…</p>
                            ) : isPending ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Clock className="h-8 w-8 text-muted-foreground" />
                                    <p className="text-sm font-medium">Request sent</p>
                                    <p className="text-xs text-muted-foreground">
                                        An admin will review your request.
                                    </p>
                                    <Button variant="outline" onClick={() => router.push("/")}>Back to Home</Button>
                                </div>
                            ) : (
                                <>
                                    {group.joinMode === "approval_required" && (
                                        <p className="text-xs text-muted-foreground">
                                            Joining requires admin approval.
                                        </p>
                                    )}
                                    <Button className="w-full" onClick={handleJoin} disabled={isJoining}>
                                        {isJoining && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        {isAuthenticated
                                            ? group.joinMode === "open"
                                                ? "Join Group"
                                                : "Request to Join"
                                            : "Sign in to Join"}
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}
