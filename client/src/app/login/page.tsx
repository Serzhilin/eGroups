"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { setAuthToken, setAuthId } from "@/lib/auth-context";
import { isMobileDevice, getDeepLinkUrl } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_EGROUPS_BASE_URL || "http://localhost:4004";

export default function LoginPage() {
    const [qrData, setQrData] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        setIsMobile(isMobileDevice());
    }, []);

    // Handle deeplink auto-login (params injected by eID Wallet redirect)
    useEffect(() => {
        if (typeof window === "undefined") return;

        const params = new URLSearchParams(window.location.search);
        const ename = params.get("ename");
        const session = params.get("session");
        const signature = params.get("signature");
        const appVersion = params.get("appVersion");

        if (ename && session && signature) {
            window.history.replaceState({}, "", window.location.pathname);
            handleAutoLogin(ename, session, signature, appVersion || "0.4.0");
            return;
        }

        fetchOffer();
    }, []);

    const fetchOffer = async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/auth/offer`);
            const data = await res.json();
            setQrData(data.uri);
            setSessionId(data.sessionId);
        } catch {
            setErrorMessage("Failed to load QR code. Is the API running?");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAutoLogin = async (
        ename: string,
        session: string,
        signature: string,
        appVersion: string,
    ) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/api/auth`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ename, session, signature, appVersion }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.token && data.user) {
                    setAuthToken(data.token);
                    setAuthId(data.user.id);
                    const redirect = sessionStorage.getItem("postLoginRedirect") || "/";
                    sessionStorage.removeItem("postLoginRedirect");
                    window.location.href = redirect;
                }
            } else {
                const err = await res.json();
                if (err.type === "version_mismatch") {
                    setErrorMessage(err.message);
                }
                setIsLoading(false);
                fetchOffer();
            }
        } catch {
            setIsLoading(false);
            fetchOffer();
        }
    };

    // SSE listener
    useEffect(() => {
        if (!sessionId) return;

        const es = new EventSource(`${BASE_URL}/api/auth/sessions/${sessionId}`);

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.error && data.type === "version_mismatch") {
                    setErrorMessage(data.message);
                    es.close();
                    return;
                }

                if (data.token && data.user) {
                    setAuthToken(data.token);
                    setAuthId(data.user.id);
                    const redirect = sessionStorage.getItem("postLoginRedirect") || "/";
                    sessionStorage.removeItem("postLoginRedirect");
                    window.location.href = redirect;
                }
            } catch {
                // ignore parse errors
            }
        };

        es.onerror = () => es.close();
        return () => es.close();
    }, [sessionId]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-muted/30">
            {/* Logo */}
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-2 text-2xl font-bold">
                    <Users className="h-8 w-8 text-primary" />
                    eGroups
                </div>
                <p className="text-muted-foreground">Group management for the W3DS</p>
            </div>

            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <h2 className="text-xl font-semibold">Sign in with your eID</h2>
                    <p className="text-sm text-muted-foreground">
                        {isMobile
                            ? "Tap the button below to open your eID Wallet"
                            : "Scan the QR code with your eID Wallet app"}
                    </p>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    {errorMessage && (
                        <div className="w-full p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-md text-sm">
                            {errorMessage}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="w-52 h-52 bg-muted rounded-lg flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : qrData ? (
                        isMobile ? (
                            <Button asChild size="lg" className="w-full">
                                <a href={getDeepLinkUrl(qrData)}>Login with eID Wallet</a>
                            </Button>
                        ) : (
                            <div className="p-4 bg-white rounded-lg border">
                                <QRCodeSVG value={qrData} size={200} level="M" includeMargin />
                            </div>
                        )
                    ) : (
                        <div className="w-52 h-52 bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                            QR unavailable
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground text-center">
                        QR code expires in 60 seconds. Refresh the page if it expires.
                    </p>

                    <div className="text-xs text-muted-foreground text-center bg-muted/50 p-3 rounded-md">
                        eGroups is a W3DS platform. Your group data is stored in your sovereign eVault,
                        not on centralised servers.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
