"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, RefreshCw, Trophy, X } from "lucide-react";
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
    const [menuOpen, setMenuOpen] = useState(false);
    const headerRef = useRef<HTMLElement>(null);

    // Espone l'altezza reale dell'header come variabile CSS (--app-header-h),
    // così gli elementi sticky delle pagine si ancorano subito sotto di esso.
    useEffect(() => {
        const el = headerRef.current;
        if (!el) return;
        const apply = () =>
            document.documentElement.style.setProperty(
                "--app-header-h",
                `${el.offsetHeight}px`
            );
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    async function handleLogout() {
        await signOut();
        router.push("/login");
        router.refresh();
    }

    // Blocca lo scroll del body quando il drawer è aperto
    useEffect(() => {
        if (!menuOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [menuOpen]);

    function isActive(href: string) {
        return pathname === href || pathname.startsWith(href + "/");
    }

    return (
        <div className="flex-1 flex flex-col">
            <header
                ref={headerRef}
                className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl"
            >
                <div className="mx-auto max-w-6xl w-full px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {/* Hamburger: solo mobile */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setMenuOpen(true)}
                            aria-label="Apri menu"
                        >
                            <Menu className="size-5" />
                        </Button>
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
                    {/* Azioni: solo desktop, su mobile vanno nel drawer */}
                    <div className="hidden md:flex items-center gap-2">
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

                {/* Navigazione desktop: ogni vista è una rotta */}
                <nav className="mx-auto max-w-6xl w-full px-4 pb-3 hidden md:block">
                    <div className="flex h-11 items-center gap-1 rounded-full bg-card/60 p-1 backdrop-blur w-fit">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`rounded-full px-5 py-1.5 text-sm transition-colors ${
                                    isActive(item.href)
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </nav>
            </header>

            {/* Drawer laterale mobile */}
            <div
                className={`fixed inset-0 z-40 md:hidden ${
                    menuOpen ? "" : "pointer-events-none"
                }`}
                aria-hidden={!menuOpen}
            >
                {/* Overlay */}
                <div
                    className={`absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity ${
                        menuOpen ? "opacity-100" : "opacity-0"
                    }`}
                    onClick={() => setMenuOpen(false)}
                />
                {/* Pannello */}
                <aside
                    className={`absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col border-r border-border/60 bg-card shadow-2xl transition-transform duration-300 ${
                        menuOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                                <Trophy className="size-4" strokeWidth={2.5} />
                            </div>
                            <span className="text-sm tracking-tight">
                                Mondiali{" "}
                                <span className="text-primary">2026</span>
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMenuOpen(false)}
                            aria-label="Chiudi menu"
                        >
                            <X className="size-5" />
                        </Button>
                    </div>

                    <nav className="flex flex-col gap-1 p-3">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMenuOpen(false)}
                                className={`rounded-xl px-4 py-3 text-sm transition-colors ${
                                    isActive(item.href)
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="mt-auto flex flex-col gap-2 border-t border-border/60 p-3">
                        <Button
                            onClick={handleSync}
                            disabled={syncing}
                            className="w-full justify-start gap-2"
                        >
                            <RefreshCw
                                className={`size-4 ${syncing ? "animate-spin" : ""}`}
                            />
                            {syncing ? "Sync…" : "Sync risultati"}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleLogout}
                            className="w-full justify-start gap-2"
                        >
                            <LogOut className="size-4" />
                            Esci
                        </Button>
                    </div>
                </aside>
            </div>

            <main className="mx-auto max-w-6xl w-full px-4 py-6 flex-1">
                {children}
            </main>
        </div>
    );
}
