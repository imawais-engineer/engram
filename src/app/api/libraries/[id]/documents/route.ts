import { HttpError } from "@/lib/db";
import { authed, body } from "@/lib/http";
import { addDocument } from "@/lib/libraries";

export const maxDuration = 300;

/** multipart/form-data with `file` (PDF/TXT/MD), or JSON { title, content } for pasted text. */
export const POST = authed(async ({ req, userId, params }) => {
  const type = req.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Attach a file");
    const buf = Buffer.from(await file.arrayBuffer());
    const document = await addDocument(userId, params.id, { title: String(form.get("title") || file.name), sourceType: "upload", file: { name: file.name, mime: file.type || "application/octet-stream", buf } });
    return { document };
  }
  const b = await body(req);
  if (!String(b.content || "").trim()) throw new HttpError(400, "Content is required");
  return { document: await addDocument(userId, params.id, { title: String(b.title || "Untitled note"), sourceType: "text", content: String(b.content) }) };
});
