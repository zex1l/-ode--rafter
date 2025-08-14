import { projectsRouter } from '@/entity/projects/server/procedures';
import { createTRPCRouter } from '../init';
import { messagesRouter } from '@/entity/messages/server/procedures';

export const appRouter = createTRPCRouter({
  messages: messagesRouter,
  projects: projectsRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
