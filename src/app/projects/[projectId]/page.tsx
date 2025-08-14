type PropsPage = {
  params: Promise<{ projectId: string }>;
};

export const Page = async ({ params }: PropsPage) => {
  const { projectId } = await params;

  return (
    <div>
      <h1>{projectId}</h1>
    </div>
  );
};
