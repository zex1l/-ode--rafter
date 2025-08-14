'use client';
import { useTRPC } from '@/shared/providers/client.provider';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export default function Home() {
  const [promt, setPromt] = useState<string>('');
  const trpc = useTRPC();
  const messages = useQuery(trpc.messages.getMany.queryOptions());
  const createMessage = useMutation(trpc.messages.create.mutationOptions({}));

  return (
    <div className="">
      <Input onChange={(e) => setPromt(e.target.value)} placeholder='Promt'/>
      <Button onClick={() => createMessage.mutate({ value: promt })} >Click</Button>

      <div>{JSON.stringify(messages.data, null, 2)}</div>
    </div>
  );
}
