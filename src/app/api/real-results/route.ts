import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadRealResults } from "@/lib/queries";

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    const results = await loadRealResults();
    return NextResponse.json({ results });
}
