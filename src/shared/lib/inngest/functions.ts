import {
  createAgent,
  createNetwork,
  createTool,
  openai,
  Tool,
} from '@inngest/agent-kit';
import { inngest } from './client';
import { Sandbox } from '@e2b/code-interpreter';
import { getSendbox, lastAssistentTextMessageContent } from './utils';
import { z } from 'zod';
import { PROMPT } from '@/shared/constants/promt';
import { prisma } from '../db';

type AgantState = {
  summary: string;
  files: {
    [path: string]: string;
  };
};

export const codeAgent = inngest.createFunction(
  { id: 'code-agent' },
  { event: 'code-agent/run' },
  async ({ event, step }) => {
    //Создание песочницы
    const sanboxId = await step.run('get-sandbox-id', async () => {
      const sandbox = await Sandbox.create('z206elgrdtwry7i86irk', {
        apiKey: process.env.E2B_API_KEY,
      });

      return sandbox.sandboxId;
    });

    // Запуск ИИ
    const codeWriterAgent = createAgent<AgantState>({
      name: 'code-agent',
      description: 'Code writer agent',
      system: PROMPT,
      model: openai({
        model: 'gpt-4.1',
        apiKey: process.env.OPEN_API_KEY,
        defaultParameters: {
          temperature: 0.1,
        },
      }),
      tools: [
        createTool({
          name: 'terminal',
          description: 'Use the terminal to run  commands',
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run('terminal', async () => {
              const buffers = { stdout: '', stderr: '' };

              try {
                const sandbox = await getSendbox(sanboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data) => {
                    buffers.stderr += data;
                  },
                });

                return result.stdout;
              } catch (error) {
                console.log(
                  `Command failed: ${error} \n stdout: ${buffers.stdout} \n stderr: ${buffers.stderr}`
                );

                return `Command failed: ${error} \n stdout: ${buffers.stdout} \n stderr: ${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: 'createOrUpdateFiles',
          description: 'create or update files in the sandbox',
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              })
            ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgantState>
          ) => {
            const newFiles = await step?.run(
              'createOrUpdateFiles',
              async () => {
                try {
                  const updatedFiles = network.state.data.files || {};
                  const sanbox = await getSendbox(sanboxId);
                  for (const file of files) {
                    await sanbox.files.write(file.path, file.content);
                    updatedFiles[file.path] = file.content;
                  }

                  return updatedFiles;
                } catch (error) {
                  return 'Error' + error;
                }
              }
            );
            if (typeof newFiles === 'object') {
              network.state.data.files = newFiles;
            }
          },
        }),
        createTool({
          name: 'readFiles',
          description: 'read files from the sandbox',
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run('readFiles', async () => {
              try {
                const sandbox = await getSendbox(sanboxId);
                const contents = [];

                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content });
                }

                return JSON.stringify(contents);
              } catch (error) {
                return 'Error' + error;
              }
            });
          },
        }),
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistentTextMessage =
            lastAssistentTextMessageContent(result);

          if (lastAssistentTextMessage && network)
            if (lastAssistentTextMessage.includes('<task_summary>'))
              network.state.data.summary = lastAssistentTextMessage;

          return result;
        },
      },
    });

    const network = createNetwork<AgantState>({
      name: 'coding-agent-network',
      agents: [codeWriterAgent],
      maxIter: 10,
      router: async ({ network }) => {
        const summary = network.state.data.summary;

        if (summary) {
          return;
        }

        return codeWriterAgent;
      },
    });

    // Получение ответа от ИИ
    const result = await network.run(event.data.value);

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;
    // Получение ссылки на песочницу
    const sandboxUrl = await step.run('get-sandbox-url', async () => {
      const sandbox = await getSendbox(sanboxId);
      const host = sandbox.getHost(3000);

      return `https://${host}`;
    });

    await step.run('save-result', async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            content: 'Somthing go wrong. Please try again',
            role: 'ASSISTANT',
            type: 'ERROR',
            projectId: event.data.projectId,
          },
        });
      }

      return await prisma.message.create({
        data: {
          content: result.state.data.summary,
          role: 'ASSISTANT',
          type: 'RESULT',
          Fragment: {
            create: {
              sandboxUrl,
              title: 'Fragment',
              files: result.state.data.files,
            },
          },
          projectId: event.data.projectId,
        },
      });
    });

    return {
      url: sandboxUrl,
      title: 'Fragment',
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
