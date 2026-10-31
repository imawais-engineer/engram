import ThreadView from "@/components/views/Thread";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ThreadView id={id} />;
}
