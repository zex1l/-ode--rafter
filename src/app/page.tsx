import { useTRPC } from '@/shared/providers/client.provider';

export default function Home() {
  const trpc = useTRPC();
  trpc.hello.queryOptions({ text: 'hello' });
  return <div className=""></div>;
}
