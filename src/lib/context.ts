import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { getAuth } from '@hono/clerk-auth';
import { ClerkClient } from '@clerk/backend';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { building } from '../../export/builder/switch';
import * as schema from '../../drizzle/schema';

export const createTRPCHonoContext = async (_c: FetchCreateContextFnOptions, c: any, db: LibSQLDatabase<typeof schema>) => {
    const auth = getAuth(c);
    const clerk = c.get('clerk') as ClerkClient;

    let user;

    if (auth?.userId) {
        user = await clerk.users.getUser(auth.userId);
    }

    return {
      hono: c,
      db,
      kv: c.env.KV as KVNamespace,
      user,
    }
}

export type TRPCHonoContext = building extends true ? any : Awaited<ReturnType<typeof createTRPCHonoContext>>;