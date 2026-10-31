import "server-only";
import { cookies } from "next/headers";
import { createAdminClient, SESSION_COOKIE } from "./appwrite";

export async function startSession(email: string, password: string) {
  const { account } = createAdminClient();
  const session = await account.createEmailPasswordSession({ email, password });
  (await cookies()).set(SESSION_COOKIE, session.secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: new Date(session.expire),
    path: "/",
  });
  return session;
}
