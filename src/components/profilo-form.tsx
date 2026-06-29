"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfiloForm({
    initialName,
    impersonating = false,
}: {
    initialName: string;
    /** Admin in impersonation: reset password senza currentPassword. */
    impersonating?: boolean;
}) {
    const router = useRouter();

    const [name, setName] = useState(initialName);
    const [savingName, setSavingName] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);

    async function onSubmitName(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            toast.error("Il nickname non può essere vuoto");
            return;
        }
        setSavingName(true);
        try {
            const { error } = await authClient.updateUser({ name: trimmed });
            if (error) throw new Error(error.message ?? "Errore aggiornamento");
            toast.success("Nickname aggiornato!");
            router.refresh();
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setSavingName(false);
        }
    }

    async function onSubmitPassword(e: React.FormEvent) {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Le password non coincidono");
            return;
        }
        setSavingPassword(true);
        try {
            if (impersonating) {
                // Admin in impersonation: reset senza currentPassword.
                const res = await fetch("/api/admin/reset-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ newPassword }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error ?? "Errore reset password");
                }
            } else {
                const { error } = await authClient.changePassword({
                    currentPassword,
                    newPassword,
                    revokeOtherSessions: true,
                });
                if (error)
                    throw new Error(error.message ?? "Errore cambio password");
            }
            toast.success("Password aggiornata!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setSavingPassword(false);
        }
    }

    return (
        <div className="mx-auto max-w-md space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Nickname</CardTitle>
                    <CardDescription>
                        Il nome mostrato nella Classifica.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={onSubmitName}>
                    <CardContent className="space-y-2">
                        <Label htmlFor="name">Nickname</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoComplete="nickname"
                        />
                    </CardContent>
                    <CardFooter className="mt-6">
                        <Button type="submit" disabled={savingName}>
                            {savingName ? "Salvataggio…" : "Salva nickname"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Password</CardTitle>
                    <CardDescription>
                        {impersonating
                            ? "Reset della password di questo utente (impersonation): non serve la password attuale."
                            : "Cambia la password del tuo account."}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={onSubmitPassword}>
                    <CardContent className="space-y-4">
                        {!impersonating && (
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">
                                    Password attuale
                                </Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) =>
                                        setCurrentPassword(e.target.value)
                                    }
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Nuova password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={8}
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">
                                Conferma nuova password
                            </Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                required
                                minLength={8}
                                autoComplete="new-password"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="mt-6">
                        <Button type="submit" disabled={savingPassword}>
                            {savingPassword
                                ? "Salvataggio…"
                                : impersonating
                                  ? "Reset password"
                                  : "Cambia password"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
