"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

// Nessun baseURL: usa l'origin corrente (evita mismatch di porta/dominio)
export const authClient = createAuthClient({
    plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
