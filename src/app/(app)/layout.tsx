import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/appwrite";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <Shell user={{ name: user.name || user.email.split("@")[0], email: user.email }}>{children}</Shell>;
}
