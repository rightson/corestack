import { router } from '@/lib/trpc/trpc';
import { userRouter } from './user';
import { postRouter } from './post';
import { authRouter } from './auth';
import { projectRouter } from './project';
import { sshConfigRouter } from './ssh-config';
import { sshRouter } from './ssh';
import { temporalRouter } from './temporal';

export const appRouter = router({
  user: userRouter,
  post: postRouter,
  auth: authRouter,
  project: projectRouter,
  sshConfig: sshConfigRouter,
  ssh: sshRouter,
  temporal: temporalRouter,
});

export type AppRouter = typeof appRouter;
