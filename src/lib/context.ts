import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { LibSQLDatabase } from 'drizzle-orm/libsql';

export type building = false;

export const createTRPCHonoContext = async (_c: FetchCreateContextFnOptions, c: any, db: LibSQLDatabase) => {
    //let user;

    //if (auth?.userId) {
    //    user = await clerk.users.getUser(auth.userId);
    //}

    return {
      hono: c,
      db,
      kv: c.env.KV as KVNamespace,
      //user,
    }
}

export type TRPCHonoContext = building extends true ? any : Awaited<ReturnType<typeof createTRPCHonoContext>>;