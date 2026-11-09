import type { Metadata } from "next";
import { Geist, Geist_Mono, League_Spartan } from "next/font/google";
import "./globals.css";


const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const leagueSpartan = League_Spartan({
    variable: "--font-league-spartan",
    subsets: ["latin"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "SupaR2",
    description: "A utility tool to move storage from Supabase to Cloudflare R2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body 
                className={`${geistSans.variable} ${geistMono.variable} ${leagueSpartan.variable} antialiased`}
                suppressHydrationWarning
            >
                {children}
            </body>
        </html>
    );
}
