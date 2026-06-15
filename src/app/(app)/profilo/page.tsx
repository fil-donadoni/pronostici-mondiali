import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProfiloForm } from "@/components/profilo-form";

export const metadata = { title: "Profilo — Mondiali 2026" };

export default async function ProfiloPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    return <ProfiloForm initialName={session.user.name} />;
}
