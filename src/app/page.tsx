import { getCurrentUser } from "@/lib/appwrite";
import AuthScreen from "@/components/AuthScreen";
import NotesApp from "@/components/NotesApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <AuthScreen />;
  return <NotesApp user={{ name: user.name || user.email.split("@")[0], email: user.email }} />;
}
