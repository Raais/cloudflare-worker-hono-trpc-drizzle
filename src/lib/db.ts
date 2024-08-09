import { createClient } from "@libsql/client/web";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";

let db: LibSQLDatabase<typeof schema>;

export const getDrizzle = (c: any) => {
  if (!db) {
    const turso = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    });
    db = drizzle(turso, { schema });
  }
  return db;
};