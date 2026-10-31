import SkillView from "@/components/views/Skill";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SkillView id={id} />;
}
