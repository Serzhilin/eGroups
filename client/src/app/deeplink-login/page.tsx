"use client";

// This page is the deeplink redirect target for mobile eID Wallet.
// The wallet navigates here with ?ename=...&session=...&signature=...
// We forward the search params to the main login page which handles them.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DeepLinkLoginPage() {
    const router = useRouter();

    useEffect(() => {
        const search = window.location.search;
        router.replace(`/login${search}`);
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
    );
}
