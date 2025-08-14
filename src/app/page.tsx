'use client';
import { useTRPC } from '@/shared/providers/client.provider';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export default function Home() {
  const [promt, setPromt] = useState<string>('');
  const trpc = useTRPC();
  const createProject = useMutation(trpc.projects.create.mutationOptions({}));

  return (
    <div className="">
      <Input onChange={(e) => setPromt(e.target.value)} placeholder="Promt" />
      <Button onClick={() => createProject.mutate({ value: promt })}>
        Click
      </Button>
    </div>
  );
}
