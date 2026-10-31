import AgentView from "@/components/views/Agent";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentView id={id} />;
}
