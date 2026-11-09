'use client'

import { useEffect } from "react";
import Image from "next/image";
import { Toaster } from "sonner";
import FileMigration from "@/components/app/FileMigration";
import TableMigration from "@/components/app/TableMigration";
import SupabaseConnection from "@/components/app/SupabaseConnection";
import CloudflareConnection from "@/components/app/CloudflareConnection";
import { SupabaseConfig, CloudflareConfig } from "../lib/storage-utils";

// Import the connection store
import { useConnectionStore } from "@/lib/connection-store";

export default function Home() {
    // Use the Zustand store
    const {
        supabaseConfig,
        cloudflareConfig,
        supabaseConnected,
        cloudflareConnected,
        migrationMode,
        isClientSide,
        setClientSide
    } = useConnectionStore();

    // Set client-side flag after initial render to avoid hydration mismatch
    useEffect(() => {
        setClientSide(true);
    }, [setClientSide]);

    return (
        <div className="mission-control flex min-h-screen flex-col bg-background text-foreground">
            <Toaster position="top-right" richColors theme="dark" />
            <header className="border-b border-border/60 bg-foreground/[0.02]">
                <div className="flex min-h-16 w-full items-center justify-between gap-3 px-4 sm:px-6">
                    <Image className="h-10 w-auto flex-shrink-0" src="/supaR2.png" alt="SupaR2" width={160} height={64} priority />
                    <div className="flex items-center justify-end gap-2">
                        <SupabaseConnection />
                        <CloudflareConnection />
                    </div>
                </div>
            </header>

            <main className="flex w-full flex-1 flex-col gap-4 p-3 sm:p-4 lg:p-5">
                {/* Only render migration components after client-side hydration */}
                {isClientSide && migrationMode === "file" && (
                    <FileMigration 
                        supabaseConfig={supabaseConfig as SupabaseConfig}
                        cloudflareConfig={cloudflareConfig as CloudflareConfig}
                        isSupabaseConnected={supabaseConnected}
                        isCloudflareConnected={cloudflareConnected}
                    />
                )}

                {isClientSide && migrationMode === "table" && (
                    <TableMigration 
                        supabaseConfig={supabaseConfig as SupabaseConfig}
                        cloudflareConfig={cloudflareConfig as CloudflareConfig}
                        isSupabaseConnected={supabaseConnected}
                        isCloudflareConnected={cloudflareConnected}
                    />
                )}
            </main>
        </div>
    );
}
