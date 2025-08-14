import { inngest } from '@/shared/lib/inngest/client';
import { hello } from '@/shared/lib/inngest/functions';
import { serve } from 'inngest/next';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [hello],
});
