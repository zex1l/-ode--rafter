import { createTRPCRouter } from '../init';
import { messagesRouter } from '@/entity/messages/server/procedures';

export const appRouter = createTRPCRouter({
  messages: messagesRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
