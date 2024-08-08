import { router } from './lib/trpc';
import { usersRouter } from './users/users.router';

export const appRouter = router({
  users: usersRouter,
});

export type AppRouter = typeof appRouter;