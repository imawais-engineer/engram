import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/appwrite";

export async function GET() {
  const u = await getCurrentUser();
  return NextResponse.json({ user: u ? { id: u.$id, name: u.name, email: u.email } : null });
}
