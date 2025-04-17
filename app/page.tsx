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
        <div className="flex flex-col min-h-screen">
            <Toaster position="top-right" richColors />
            <header className="bg-white border-b border-gray-200">
                <div className="mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex ml-4 mr-auto xl:ml-0">
                            <div className="flex items-center flex-shrink-0">
                                <Image className="block w-auto h-18 lg:hidden" src="/supaR2.png" alt="" width={1000} height={1000} />
                                <Image className="hidden w-auto h-26 lg:block" src="/supaR2.png" alt="" width={1000} height={1000} />
                            </div>
                        </div>

                        <div className="flex-1 hidden max-w-xs ml-40 mr-auto lg:block">
                            <label htmlFor="search" className="sr-only"> Search </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                    </svg>
                                </div>

                                <input type="search" name="" id="" className="border block w-full py-2 pl-10 border-gray-300 rounded-lg focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm" placeholder="Type to search" />
                            </div>
                        </div>

                        <div className="flex items-center justify-end space-x-6 sm:ml-5">
                            <div className="relative">
                                <button type="button" className="p-1 text-gray-700 transition-all duration-200 bg-white rounded-full hover:text-gray-900 focus:outline-none hover:bg-gray-100">
                                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                    </svg>
                                </button>
                                <span className="inline-flex items-center px-1.5 absolute -top-px -right-1 py-0.5 rounded-full text-xs font-semibold bg-indigo-600 text-white"> 2 </span>
                            </div>

                            <div className="relative">
                                <button type="button" className="p-1 text-gray-700 transition-all duration-200 bg-white rounded-full hover:text-gray-900 focus:outline-none hover:bg-gray-100">
                                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                                    </svg>
                                </button>
                            </div>

                            <button type="button" className="flex items-center max-w-xs rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
                                <Image className="object-cover bg-gray-300 rounded-full w-9 h-9" src="https://landingfoliocom.imgix.net/store/collection/clarity-dashboard/images/previews/settings/2/avatar-male.png" alt="" width={36} height={36} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 p-6">
                <div className="mt-4 bg-white border border-gray-200 rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        {/* Supabase Connection (Left Side) */}
                        <SupabaseConnection />
                        
                        {/* Cloudflare R2 Connection (Right Side) */}
                        <CloudflareConnection />
                    </div>
                </div>
                
                {/* Only render migration components after client-side hydration */}
                {isClientSide && supabaseConnected && migrationMode === "file" && (
                    <FileMigration 
                        supabaseConfig={supabaseConfig as SupabaseConfig}
                        cloudflareConfig={cloudflareConfig as CloudflareConfig}
                        isSupabaseConnected={supabaseConnected}
                        isCloudflareConnected={cloudflareConnected}
                    />
                )}

                {isClientSide && supabaseConnected && migrationMode === "table" && (
                    <TableMigration 
                        supabaseConfig={supabaseConfig as SupabaseConfig}
                        cloudflareConfig={cloudflareConfig as CloudflareConfig}
                        isSupabaseConnected={supabaseConnected}
                        isCloudflareConnected={cloudflareConnected}
                    />
                )}
            </div>
        </div>
    );
}
