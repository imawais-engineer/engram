import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/appwrite";
import AuthScreen from "@/components/AuthScreen";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/overview");
  return <AuthScreen />;
}
