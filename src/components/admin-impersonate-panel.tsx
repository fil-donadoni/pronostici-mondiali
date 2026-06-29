"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserCog } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { UserRow } from "@/lib/queries";

/**
 * Pannello admin: elenco utenti con pulsante "Impersona".
 * Solo gli admin vedono questo pannello (gating lato server nella pagina).
 * L'impersonation usa il plugin admin di better-auth (session swap sicuro).
 */
export function AdminImpersonatePanel({
    users,
    meId,
}: {
    users: UserRow[];
    meId: string;
}) {
    const router = useRouter();
    const [pending, setPending] = useState<string | null>(null);
    const [query, setQuery] = useState("");

    async function impersonate(userId: string) {
        setPending(userId);
        const { error } = await authClient.admin.impersonateUser({ userId });
        if (error) {
            toast.error(error.message ?? "Impersonation fallita");
            setPending(null);
            return;
        }
        router.push("/");
        router.refresh();
    }

    const others = useMemo(() => {
        const rest = users.filter((u) => u.id !== meId);
        const q = query.trim().toLowerCase();
        if (!q) return rest;
        return rest.filter(
            (u) =>
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q)
        );
    }, [users, meId, query]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Admin — Impersona utente</CardTitle>
                <CardDescription>
                    Apri la sessione di un altro utente per vedere i suoi
                    Pronostici. Una barra in alto ti permette di tornare te
                    stesso.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cerca per nome o email…"
                        className="pl-9"
                        aria-label="Cerca utente"
                    />
                </div>
                <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
                    {others.length === 0 && (
                        <li className="px-4 py-3 text-sm text-muted-foreground">
                            {query.trim()
                                ? "Nessun utente corrisponde."
                                : "Nessun altro utente."}
                        </li>
                    )}
                    {others.map((u) => (
                        <li
                            key={u.id}
                            className="flex items-center justify-between gap-4 px-4 py-3"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                    {u.name}
                                    {u.role === "admin" && (
                                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                            admin
                                        </span>
                                    )}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {u.email}
                                </p>
                            </div>
                            {u.role === "admin" ? (
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    non impersonabile
                                </span>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => impersonate(u.id)}
                                    disabled={pending !== null}
                                    className="shrink-0 gap-1.5"
                                >
                                    <UserCog className="size-3.5" />
                                    {pending === u.id ? "Avvio…" : "Impersona"}
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
