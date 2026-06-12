import {
    pgTable,
    text,
    integer,
    boolean,
    timestamp,
    primaryKey,
    uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Schema Drizzle.
 *
 * Principio (vedi docs/adr/0001): persistiamo SOLO gli input grezzi.
 * Classifiche, qualificate, riempimento del Tabellone e propagazione
 * NON sono tabelle: sono derivate a runtime da `prediction`.
 */

// --- Auth (gestite da better-auth) ---

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified")
        .$defaultFn(() => false)
        .notNull(),
    image: text("image"),
    createdAt: timestamp("created_at")
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: timestamp("updated_at")
        .$defaultFn(() => new Date())
        .notNull(),
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

// --- Dominio torneo (seed statico, condiviso da tutti gli utenti) ---

/** Le 48 squadre, assegnate a un Girone (A..L). */
export const team = pgTable("team", {
    id: text("id").primaryKey(), // codice interno, es. "ITA"
    name: text("name").notNull(),
    groupCode: text("group_code").notNull(), // "A".."L"
    externalId: integer("external_id"), // id football-data.org per il mapping
});

/**
 * Partita. Copre sia i Gironi sia il knockout.
 * - Gironi: homeTeamId/awayTeamId valorizzati dal seed.
 * - Knockout: squadre TBD (null), lo slot è definito da `homeSlot`/`awaySlot`
 *   (es. "1A", "2B", "W49") secondo lo schema ufficiale FIFA.
 */
export const match = pgTable("match", {
    id: text("id").primaryKey(), // es. "G-1", "R32-1", "FINAL"
    stage: text("stage").notNull(), // GROUP | R32 | R16 | QF | SF | THIRD | FINAL
    groupCode: text("group_code"), // valorizzato solo per stage=GROUP
    matchNumber: integer("match_number").notNull(),
    kickoff: timestamp("kickoff"),
    homeTeamId: text("home_team_id").references(() => team.id),
    awayTeamId: text("away_team_id").references(() => team.id),
    homeSlot: text("home_slot"), // riferimento simbolico per il knockout
    awaySlot: text("away_slot"),
    externalId: integer("external_id"),
});

/**
 * Pronostico: input grezzo dell'utente per una Partita.
 * Unico source-of-truth lato utente. Una riga per (user, match).
 * penaltyWinner valorizzato solo se knockout + pareggio nei 90'.
 */
export const prediction = pgTable(
    "prediction",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        matchId: text("match_id")
            .notNull()
            .references(() => match.id, { onDelete: "cascade" }),
        homeScore: integer("home_score").notNull(),
        awayScore: integer("away_score").notNull(),
        // "home" | "away" — chi passa ai rigori in caso di pareggio knockout
        penaltyWinner: text("penalty_winner"),
        updatedAt: timestamp("updated_at")
            .$defaultFn(() => new Date())
            .notNull(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.matchId] })]
);

/**
 * Risultato reale scaricato via Sync (cache in DB, vedi D13).
 * Una riga per Partita giocata. Condiviso tra utenti.
 */
export const realResult = pgTable(
    "real_result",
    {
        matchId: text("match_id")
            .notNull()
            .references(() => match.id, { onDelete: "cascade" }),
        homeScore: integer("home_score").notNull(),
        awayScore: integer("away_score").notNull(),
        // squadre reali effettive (per il knockout possono differire dal pronostico)
        homeTeamId: text("home_team_id").references(() => team.id),
        awayTeamId: text("away_team_id").references(() => team.id),
        finished: boolean("finished").notNull().default(false),
        syncedAt: timestamp("synced_at")
            .$defaultFn(() => new Date())
            .notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.matchId] }),
        uniqueIndex("real_result_match_idx").on(t.matchId),
    ]
);
