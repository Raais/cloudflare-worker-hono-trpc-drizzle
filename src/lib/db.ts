import { createClient } from "@libsql/client/web";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";

let db: LibSQLDatabase;

export const getDrizzle = (c: any) => {
  if (!db) {
    const turso = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    });
    db = drizzle(turso);
  }
  return db;
};