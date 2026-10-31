import LibraryView from "@/components/views/Library";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryView id={id} />;
}
