"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    ArrowLeft,
    Users,
    Copy,
    RefreshCw,
    QrCode,
    Trash2,
    Shield,
    UserMinus,
    Check,
    X,
    Loader2,
    Settings,
    Clock,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface GroupMember {
    id: string;
    userId: string;
    role: "admin" | "member";
    status: "active" | "pending";
    joinedAt: string;
    user: { id: string; ename: string; name?: string; avatarUrl?: string };
}

interface GroupDetail {
    id: string;
    name: string;
    description?: string;
    logo?: string;
    joinMode: "open" | "approval_required";
    inviteCode: string;
    createdBy: string;
    memberCount: number;
    pendingCount: number;
    myRole: "admin" | "member" | null;
    myStatus: "active" | "pending" | null;
    members: GroupMember[];
    createdAt: string;
}

const CLIENT_URL = process.env.NEXT_PUBLIC_EGROUPS_URL || "http://localhost:3007";

export default function GroupDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();

    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [pendingMembers, setPendingMembers] = useState<GroupMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showQR, setShowQR] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", description: "", logo: "", joinMode: "open" as "open" | "approval_required" });
    const [isActing, setIsActing] = useState(false);

    const fetchGroup = async () => {
        try {
            const res = await apiClient.get(`/api/groups/${id}`);
            setGroup(res.data);
            setEditForm({
                name: res.data.name,
                description: res.data.description || "",
                logo: res.data.logo || "",
                joinMode: res.data.joinMode,
            });
        } catch {
            router.push("/");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPending = async () => {
        try {
            const res = await apiClient.get(`/api/groups/${id}/pending`);
            setPendingMembers(res.data);
        } catch {
            // not admin, ignore
        }
    };

    useEffect(() => {
        fetchGroup();
    }, [id]);

    useEffect(() => {
        if (group?.myRole === "admin") fetchPending();
    }, [group?.myRole]);

    const inviteUrl = group ? `${CLIENT_URL}/join/${group.inviteCode}` : "";
    const isAdmin = group?.myRole === "admin";

    const copyInviteLink = () => {
        navigator.clipboard.writeText(inviteUrl);
        toast({ title: "Invite link copied!" });
    };

    const regenerateInvite = async () => {
        setIsActing(true);
        try {
            await apiClient.post(`/api/groups/${id}/invite/regenerate`);
            await fetchGroup();
            toast({ title: "Invite link regenerated" });
        } catch {
            toast({ title: "Failed", variant: "destructive" });
        } finally {
            setIsActing(false);
        }
    };

    const handleApprove = async (userId: string) => {
        try {
            await apiClient.post(`/api/groups/${id}/members/${userId}/approve`);
            await Promise.all([fetchGroup(), fetchPending()]);
            toast({ title: "Member approved" });
        } catch {
            toast({ title: "Failed", variant: "destructive" });
        }
    };

    const handleReject = async (userId: string) => {
        try {
            await apiClient.post(`/api/groups/${id}/members/${userId}/reject`);
            await fetchPending();
            toast({ title: "Request rejected" });
        } catch {
            toast({ title: "Failed", variant: "destructive" });
        }
    };

    const handleRemoveMember = async (userId: string) => {
        try {
            await apiClient.delete(`/api/groups/${id}/members/${userId}`);
            await fetchGroup();
            toast({ title: "Member removed" });
        } catch {
            toast({ title: "Failed", variant: "destructive" });
        }
    };

    const handlePromote = async (userId: string) => {
        try {
            await apiClient.post(`/api/groups/${id}/members/${userId}/promote`);
            await fetchGroup();
            toast({ title: "Promoted to admin" });
        } catch {
            toast({ title: "Failed", variant: "destructive" });
        }
    };

    const handleLeave = async () => {
        if (!user) return;
        try {
            await apiClient.delete(`/api/groups/${id}/members/${user.id}`);
            toast({ title: "Left group" });
            router.push("/");
        } catch {
            toast({ title: "Failed", variant: "destructive" });
        }
    };

    const handleSaveEdit = async () => {
        setIsActing(true);
        try {
            await apiClient.put(`/api/groups/${id}`, editForm);
            await fetchGroup();
            setShowEdit(false);
            toast({ title: "Group updated" });
        } catch {
            toast({ title: "Failed to update", variant: "destructive" });
        } finally {
            setIsActing(false);
        }
    };

    const handleDelete = async () => {
        setIsActing(true);
        try {
            await apiClient.delete(`/api/groups/${id}`);
            toast({ title: "Group deleted" });
            router.push("/");
        } catch {
            toast({ title: "Failed to delete", variant: "destructive" });
        } finally {
            setIsActing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!group) return null;

    const activeMembers = group.members?.filter((m) => m.status === "active") ?? [];

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-start gap-3">
                <Link href="/">
                    <Button variant="ghost" size="icon" className="mt-1">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {group.logo ? (
                                <img src={group.logo} alt={group.name} className="h-full w-full object-cover" />
                            ) : (
                                <Users className="h-7 w-7 text-primary" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold truncate">{group.name}</h1>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <span className="text-sm text-muted-foreground">
                                    {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                    {group.joinMode === "open" ? "Open" : "Approval required"}
                                </Badge>
                                {group.myRole && (
                                    <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs">
                                        {group.myRole}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    {group.description && (
                        <p className="text-sm text-muted-foreground mt-3">{group.description}</p>
                    )}
                </div>
            </div>

            {/* Admin controls */}
            {isAdmin && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Admin Controls
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Invite link */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Invite Link</Label>
                            <div className="flex gap-2">
                                <Input value={inviteUrl} readOnly className="text-xs" />
                                <Button size="icon" variant="outline" onClick={copyInviteLink}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => setShowQR(true)}>
                                    <QrCode className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="outline" onClick={regenerateInvite} disabled={isActing}>
                                    <RefreshCw className={`h-4 w-4 ${isActing ? "animate-spin" : ""}`} />
                                </Button>
                            </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => setShowEdit(true)}>
                                <Settings className="h-4 w-4 mr-1" />
                                Edit Group
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete Group
                            </Button>
                        </div>

                        {/* Pending requests */}
                        {pendingMembers.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <p className="text-xs font-medium flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Pending Requests ({pendingMembers.length})
                                    </p>
                                    {pendingMembers.map((m) => (
                                        <div
                                            key={m.id}
                                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                                        >
                                            <span className="text-sm">{m.user.name || m.user.ename}</span>
                                            <div className="flex gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-green-600"
                                                    onClick={() => handleApprove(m.userId)}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => handleReject(m.userId)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Non-admin invite copy */}
            {!isAdmin && group.myRole === "member" && (
                <div className="flex items-center gap-2">
                    <Input value={inviteUrl} readOnly className="text-xs" />
                    <Button size="icon" variant="outline" onClick={copyInviteLink}>
                        <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => setShowQR(true)}>
                        <QrCode className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Members list */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Members ({activeMembers.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {activeMembers.map((m) => (
                        <div key={m.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium overflow-hidden">
                                    {m.user.avatarUrl ? (
                                        <img src={m.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        (m.user.name || m.user.ename || "?")[0].toUpperCase()
                                    )}
                                </div>
                                <span className="text-sm">{m.user.name || m.user.ename}</span>
                                {m.role === "admin" && (
                                    <Badge variant="default" className="text-xs">admin</Badge>
                                )}
                                {m.userId === user?.id && (
                                    <span className="text-xs text-muted-foreground">(you)</span>
                                )}
                            </div>
                            {isAdmin && m.userId !== user?.id && (
                                <div className="flex gap-1">
                                    {m.role !== "admin" && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            title="Promote to admin"
                                            onClick={() => handlePromote(m.userId)}
                                        >
                                            <Shield className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive"
                                        title="Remove member"
                                        onClick={() => handleRemoveMember(m.userId)}
                                    >
                                        <UserMinus className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Leave group */}
            {group.myRole && (
                <Button variant="outline" className="text-destructive" onClick={handleLeave}>
                    Leave Group
                </Button>
            )}

            {/* QR code modal */}
            <Dialog open={showQR} onOpenChange={setShowQR}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Join Link QR Code</DialogTitle>
                        <DialogDescription>Scan to join {group.name}</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center p-4">
                        <QRCodeSVG value={inviteUrl} size={220} level="M" includeMargin />
                    </div>
                    <p className="text-xs text-center text-muted-foreground break-all">{inviteUrl}</p>
                </DialogContent>
            </Dialog>

            {/* Edit modal */}
            <Dialog open={showEdit} onOpenChange={setShowEdit}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label>Name</Label>
                            <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Description</Label>
                            <Textarea rows={3} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Logo URL</Label>
                            <Input value={editForm.logo} onChange={(e) => setEditForm((f) => ({ ...f, logo: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Join Mode</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {(["open", "approval_required"] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setEditForm((f) => ({ ...f, joinMode: mode }))}
                                        className={`p-2 rounded-lg border text-xs text-left transition-colors ${editForm.joinMode === mode ? "border-primary bg-primary/5" : "border-input hover:bg-muted"}`}
                                    >
                                        {mode === "open" ? "Open" : "Approval Required"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={isActing}>
                            {isActing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm modal */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Group</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{group.name}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isActing}>
                            {isActing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
