"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { signIn, signUp } from "@/lib/auth-client";
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

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const isSignup = mode === "signup";

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            if (isSignup) {
                const { error } = await signUp.email({ name, email, password });
                if (error)
                    throw new Error(error.message ?? "Errore registrazione");
                toast.success("Account creato!");
            } else {
                const { error } = await signIn.email({ email, password });
                if (error)
                    throw new Error(error.message ?? "Credenziali non valide");
            }
            router.push("/");
            router.refresh();
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card className="w-full max-w-sm border-border/60 bg-card/70 shadow-2xl shadow-black/30 backdrop-blur">
            <CardHeader>
                <div className="mb-3 flex items-center gap-2.5">
                    <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
                        <Trophy className="size-4.5" strokeWidth={2.5} />
                    </div>
                    <span className="font-heading text-sm font-semibold tracking-wide text-muted-foreground">
                        MONDIALI <span className="text-primary">2026</span>
                    </span>
                </div>
                <CardTitle className="text-2xl">
                    {isSignup ? "Crea account" : "Accedi"}
                </CardTitle>
                <CardDescription>
                    {isSignup
                        ? "Registrati per iniziare a pronosticare il Mondiale 2026."
                        : "Bentornato. Accedi ai tuoi pronostici."}
                </CardDescription>
            </CardHeader>
            <form onSubmit={onSubmit}>
                <CardContent className="space-y-4">
                    {isSignup && (
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoComplete="name"
                            />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            autoComplete={
                                isSignup ? "new-password" : "current-password"
                            }
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex-col gap-3 mt-6">
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading
                            ? "Attendi…"
                            : isSignup
                              ? "Registrati"
                              : "Accedi"}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                        {isSignup ? (
                            <>
                                Hai già un account?{" "}
                                <Link href="/login" className="underline">
                                    Accedi
                                </Link>
                            </>
                        ) : (
                            <>
                                Non hai un account?{" "}
                                <Link href="/signup" className="underline">
                                    Registrati
                                </Link>
                            </>
                        )}
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
