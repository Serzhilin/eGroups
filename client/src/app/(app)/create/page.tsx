"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const schema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional(),
    logo: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    joinMode: z.enum(["open", "approval_required"]),
});

type FormData = z.infer<typeof schema>;

export default function CreateGroupPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { joinMode: "open" },
    });

    const joinMode = watch("joinMode");

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            const res = await apiClient.post("/api/groups", {
                ...data,
                logo: data.logo || undefined,
            });
            toast({ title: "Group created!", description: `"${data.name}" is ready.` });
            router.push(`/groups/${res.data.id}`);
        } catch {
            toast({
                title: "Failed to create group",
                description: "Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto space-y-4">
            <div className="flex items-center gap-2">
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-xl font-semibold">Create a Group</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Group Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="name">Name *</Label>
                            <Input id="name" placeholder="e.g. Open Source Builders" {...register("name")} />
                            {errors.name && (
                                <p className="text-xs text-destructive">{errors.name.message}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="What is this group about?"
                                rows={3}
                                {...register("description")}
                            />
                            {errors.description && (
                                <p className="text-xs text-destructive">{errors.description.message}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="logo">Logo URL</Label>
                            <Input
                                id="logo"
                                type="url"
                                placeholder="https://example.com/logo.png"
                                {...register("logo")}
                            />
                            {errors.logo && (
                                <p className="text-xs text-destructive">{errors.logo.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Join Mode</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setValue("joinMode", "open")}
                                    className={`p-3 rounded-lg border text-left transition-colors ${
                                        joinMode === "open"
                                            ? "border-primary bg-primary/5 text-primary"
                                            : "border-input hover:bg-muted"
                                    }`}
                                >
                                    <p className="text-sm font-medium">Open</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Anyone with the link joins immediately
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setValue("joinMode", "approval_required")}
                                    className={`p-3 rounded-lg border text-left transition-colors ${
                                        joinMode === "approval_required"
                                            ? "border-primary bg-primary/5 text-primary"
                                            : "border-input hover:bg-muted"
                                    }`}
                                >
                                    <p className="text-sm font-medium">Approval Required</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Admins must approve each request
                                    </p>
                                </button>
                            </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Create Group
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
