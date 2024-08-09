import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../lib/trpc';
import { usersTable } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const usersRouter = router({
  getMe: protectedProcedure
    .query(async ({ input, ctx }) => {
      const me = ctx.user;
      return me.id;
    }
  ),

  getNotifications: protectedProcedure
    .input(z.object({ isRefetch: z.boolean().optional().default(false) }))
    .query(async ({ input, ctx }) => {
      const me = ctx.user;
      const user = await ctx.db.query.usersTable.findFirst({
        where: eq(usersTable.userId, me.id),
      });

      if (!user) {
        return { notis: [], isRefetch: input.isRefetch };
      }

      const list = await ctx.kv.list({ prefix: `noti:${user.id}:` });
      const notis = await Promise.all(
        list.keys.map(async (key) => {
          const noti = await ctx.kv.get(key.name);
          return { id: key.name, body: noti };
        })
      );
      return { notis, isRefetch: input.isRefetch };
    }
  ),

  readNotification: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.kv.delete(input.key);
    }
  ),
  
  getHello: publicProcedure
    .query(async ({ input, ctx }) => {
      return "Hello from Hono + TRPC";
    }
  ),

  // getUser: publicProcedure
  //   .input(z.object({ id: z.number() }))
  //   .query(async ({ input, ctx }) => {
  //     const user = await ctx.db.query.usersTable.findFirst({
  //       columns: { name: true },
  //       where: eq(usersTable.id, input.id),
  //     });
  //     return user;
  //   }
  // ),

  sendMsg: publicProcedure
    .input(z.object({ id: z.number(), body: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.query.usersTable.findFirst({
        where: eq(usersTable.id, input.id),
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const timestamp = new Date().getTime();
      const key = `noti:${user.id}:${timestamp}`;
      await ctx.kv.put(key, input.body);

      return { id: key, body: input.body };
    }
  ),


  
  //getUsers: publicProcedure
  //  .query(async ({ input, ctx }) => {
  //    const start = performance.now();
  //      const result = await ctx.db.select().from(usersTable).all();
  //    const end = performance.now();
  //    return { result, took: `${end - start}ms` };
  //  }
  //),
});