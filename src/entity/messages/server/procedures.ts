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
        value: z
          .string()
          .min(1, { message: 'Value is required' })
          .max(10000, { message: 'Value is too long' }),
        projectId: z.string().min(1, { message: 'Project ID is required' }),
      })
    )
    .mutation(async ({ input }) => {
      const createdMessage = await prisma.message.create({
        data: {
          role: 'USER',
          type: 'RESULT',
          content: input.value,
          projectId: input.projectId,
        },
      });

      await inngest.send({
        name: 'code-agent/run',
        data: {
          value: input.value,
          projectId: input.projectId,
        },
      });

      return createdMessage;
    }),
});
