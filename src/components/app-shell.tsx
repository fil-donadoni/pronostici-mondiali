"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, RefreshCw, Trophy } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { AppProvider, useApp } from "@/lib/app-context";
import type {
    Prediction,
    RealResult,
    MatchInfo,
    TeamInfo,
} from "@/lib/tournament/types";

const NAV = [
    { href: "/gironi", label: "Gironi" },
    { href: "/tabellone", label: "Tabellone" },
    { href: "/confronto", label: "Confronto" },
    { href: "/classifica", label: "Classifica" },
];

export function AppShell({
    userName,
    teams,
    matches,
    initialPredictions,
    initialRealResults,
    children,
}: {
    userName: string;
    teams: TeamInfo[];
    matches: MatchInfo[];
    initialPredictions: Prediction[];
    initialRealResults: RealResult[];
    children: React.ReactNode;
}) {
    return (
        <AppProvider
            userName={userName}
            teams={teams}
            matches={matches}
            initialPredictions={initialPredictions}
            initialRealResults={initialRealResults}
        >
            <Shell>{children}</Shell>
        </AppProvider>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { userName, syncing, handleSync } = useApp();

    async function handleLogout() {
        await signOut();
        router.push("/login");
        router.refresh();
    }

    return (
        <div className="flex-1 flex flex-col">
            <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
                <div className="mx-auto max-w-6xl w-full px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
                            <Trophy className="size-5" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-lg leading-none tracking-tight">
                                Mondiali{" "}
                                <span className="text-primary">2026</span>
                            </h1>
                            <p className="text-xs text-muted-foreground mt-1">
                                Ciao {userName}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleSync}
                            disabled={syncing}
                            className="gap-2 shadow-lg shadow-primary/20"
                        >
                            <RefreshCw
                                className={`size-4 ${syncing ? "animate-spin" : ""}`}
                            />
                            {syncing ? "Sync…" : "Sync risultati"}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleLogout}
                            className="gap-2"
                        >
                            <LogOut className="size-4" />
                            Esci
                        </Button>
                    </div>
                </div>

                {/* Navigazione: ogni vista è una rotta */}
                <nav className="mx-auto max-w-6xl w-full px-4 pb-3">
                    <div className="flex h-11 items-center gap-1 rounded-full bg-card/60 p-1 backdrop-blur w-fit">
                        {NAV.map((item) => {
                            const active =
                                pathname === item.href ||
                                pathname.startsWith(item.href + "/");
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`rounded-full px-5 py-1.5 text-sm transition-colors ${
                                        active
                                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            </header>

            <main className="mx-auto max-w-6xl w-full px-4 py-6 flex-1">
                {children}
            </main>
        </div>
    );
}
