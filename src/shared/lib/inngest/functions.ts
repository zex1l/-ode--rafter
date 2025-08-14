import {
  AnyZodType,
  createAgent,
  createNetwork,
  createTool,
  openai,
} from '@inngest/agent-kit';
import { inngest } from './client';
import { Sandbox } from '@e2b/code-interpreter';
import { getSendbox, lastAssistentTextMessageContent } from './utils';
import { z } from 'zod';
import { PROMPT } from '@/shared/constants/promt';

export const hello = inngest.createFunction(
  { id: 'hello' },
  { event: 'test/hello' },
  async ({ event, step }) => {
    //Создание песочницы
    const sanboxId = await step.run('get-sandbox-id', async () => {
      const sandbox = await Sandbox.create('z206elgrdtwry7i86irk', {
        apiKey: process.env.E2B_API_KEY,
      });

      return sandbox.sandboxId;
    });

    // Запуск ИИ
    const codeWriterAgent = createAgent({
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
          handler: async ({ files }, { step, network }) => {
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

    const network = createNetwork({
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

    // Получение ссылки на песочницу
    const sandboxUrl = await step.run('get-sandbox-url', async () => {
      const sandbox = await getSendbox(sanboxId);
      const host = sandbox.getHost(3000);

      return `https://${host}`;
    });

    return {
      url: sandboxUrl,
      title: 'Fragment',
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
