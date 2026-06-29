"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/**
 * Barra fissa in cima mostrata mentre un admin impersona un altro utente.
 * "Torna te stesso" chiama stopImpersonating: il plugin admin ripristina
 * la sessione originale dell'admin (vedi session.impersonatedBy).
 */
export function ImpersonationBar({ name }: { name: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function stop() {
        setLoading(true);
        const { error } = await authClient.admin.stopImpersonating();
        if (error) {
            toast.error("Impossibile tornare al tuo account");
            setLoading(false);
            return;
        }
        router.push("/");
        router.refresh();
    }

    return (
        <div className="sticky top-0 z-50 flex h-11 items-center justify-center gap-4 bg-amber-500 px-4 text-sm font-medium text-amber-950 shadow-md">
            <span>
                Stai impersonando <strong>{name}</strong>
            </span>
            <Button
                variant="outline"
                size="sm"
                onClick={stop}
                disabled={loading}
                className="h-7 border-amber-700 bg-amber-400 text-amber-950 hover:bg-amber-300"
            >
                <LogOut className="mr-1.5 size-3.5" />
                Torna te stesso
            </Button>
        </div>
    );
}
