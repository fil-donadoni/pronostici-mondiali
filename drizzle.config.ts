import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        // Migrazioni/DDL: usa la connessione diretta (session pooler) se presente,
        // il transaction pooler non è adatto a `drizzle-kit push/migrate`.
        url: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!,
    },
});
