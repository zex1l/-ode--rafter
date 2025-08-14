import { prisma } from '@/shared/lib/db';
import { inngest } from '@/shared/lib/inngest/client';
import { baseProcedure, createTRPCRouter } from '@/shared/lib/trpc/init';
import z from 'zod';

export const messagesRouter = createTRPCRouter({
  getMany: baseProcedure.query(async () => {
    const messages = await prisma.message.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        Fragment: true,
      },
    });

    return messages;
  }),
  create: baseProcedure
    .input(
      z.object({
        value: z.string().min(1, { message: 'Message is required' }),
      })
    )
    .mutation(async ({ input }) => {
      const createdMessage = await prisma.message.create({
        data: {
          role: 'USER',
          type: 'RESULT',
          content: input.value,
        },
      });

      await inngest.send({
        name: 'code-agent/run',
        data: {
          value: input.value,
        },
      });

      return createdMessage;
    }),
});
