"use client";

import { createAuthClient } from "better-auth/react";

// Nessun baseURL: usa l'origin corrente (evita mismatch di porta/dominio)
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
