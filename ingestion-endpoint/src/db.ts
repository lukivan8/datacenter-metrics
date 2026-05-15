import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
});

export async function closeDb() {
    await pool.end();
}
