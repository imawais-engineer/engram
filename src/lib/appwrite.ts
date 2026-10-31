import "server-only";
import { cookies } from "next/headers";
import { Account, Client, Embeddings, Storage, TablesDB, Users } from "node-appwrite";

export const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://sfo.cloud.appwrite.io/v1";
export const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "6a5788c00031e7384f3b";
export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID ?? "notemind";
export const NOTES_TABLE_ID = process.env.APPWRITE_NOTES_TABLE_ID ?? "notes";
export const BUCKET_ID = process.env.APPWRITE_BUCKET_ID ?? "documents";
export const T = {
  libraries: "libraries",
  documents: "documents",
  chunks: "chunks",
  threads: "threads",
  memories: "memories",
  keys: "keys",
  activity: "activity",
} as const;
export const SESSION_COOKIE = `a_session_${PROJECT_ID}`;

/** Admin client: uses the server API key. Never import this from client code. */
export function createAdminClient() {
  const key = process.env.APPWRITE_API_KEY;
  if (!key) throw new Error("APPWRITE_API_KEY is not set");
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(key);
  return {
    account: new Account(client),
    users: new Users(client),
    tables: new TablesDB(client),
    embeddings: new Embeddings(client),
    storage: new Storage(client),
  };
}

/** Session client: acts as the signed-in user, built per request from the httpOnly cookie. */
export async function createSessionClient() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setSession(session);
  return { account: new Account(client) };
}

export async function getCurrentUser() {
  try {
    const s = await createSessionClient();
    if (!s) return null;
    return await s.account.get();
  } catch {
    return null;
  }
}
