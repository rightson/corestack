import { router } from '@/lib/trpc/trpc';
import { userRouter } from './user';
import { postRouter } from './post';
import { authRouter } from './auth';
import { projectRouter } from './project';

export const appRouter = router({
  user: userRouter,
  post: postRouter,
  auth: authRouter,
  project: projectRouter,
});

export type AppRouter = typeof appRouter;
