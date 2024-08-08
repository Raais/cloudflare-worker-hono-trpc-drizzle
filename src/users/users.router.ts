import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../lib/trpc';
import { usersTable } from '../../drizzle/schema';

export const usersRouter = router({
  getMe: protectedProcedure
    .query(async ({ input, ctx }) => {
      const me = ctx.user;
      return me.fullName;
    }
  ),
  
  getHello: publicProcedure
    .query(async ({ input, ctx }) => {
      return "Hello from Hono + TRPC";
    }
  ),
  
  getUsers: publicProcedure
    .query(async ({ input, ctx }) => {
      const start = performance.now();
        const result = await ctx.db.select().from(usersTable).all();
      const end = performance.now();
      return { result, took: `${end - start}ms` };
    }
  ),
});