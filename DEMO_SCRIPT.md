# NoteMind — 2-minute demo script

**0:00–0:15 · Hook** (landing page on screen)
"Every student has hundreds of notes, but when you need one, you never remember the exact words you wrote.
NoteMind lets you search your notes by meaning. It's built on Appwrite Databases and Appwrite's built-in embeddings."

**0:15–0:30 · Sign up** (create account → empty state)
"I'll create an account. Auth is Appwrite email/password; the session sits in an httpOnly cookie, and every note is a TablesDB row only I can read.
To start fast, I'll load ten sample computer-science notes."
→ Click **Load sample notes**.

**0:30–1:05 · Semantic search** (type each query slowly)
1. "how do inner functions remember variables" → top result **JavaScript: lexical scope & inner functions**.
   "That note never says 'remember variables', but it's the right one, with a 73% match."
2. "why is my program stuck waiting forever" → **OS: deadlocks**.
3. "make my database queries faster" → **SQL indexes**.
"Each query is embedded with nomic-embed-text through Appwrite Embeddings and ranked against my notes by cosine similarity, in about 100 ms."

**1:05–1:25 · Related notes**
Click the JavaScript note. "On the right is the note and its related notes, the nearest neighbours of its own vector, so revising closures surfaces my React useEffect note too."

**1:25–1:45 · Add and edit**
Click **+ New note**: title "TCP three-way handshake", subject "Computer Networks", paste a short paragraph, Save.
Search "how does a connection get started between two computers" → the new note is first.
Click **Edit**, change the title, save. "Edits re-embed the note automatically."

**1:45–2:00 · Wrap-up**
Show the Appwrite Console: database `notemind`, table `notes`, its typed columns, indexes and row permissions.
"NoteMind: TablesDB for the notes and vectors, Appwrite Embeddings for meaning, Appwrite Auth for privacy. Find any note by what it means. Thanks!"

---

## Submission blurb (short)
**NoteMind: search your study notes by meaning.** Write or paste lecture notes, then ask in your own words. "Why is my program stuck waiting forever?" finds your deadlocks note even though it never uses those words. Every note also shows its related notes. Notes, subjects, tags and 768-dimension vectors live in Appwrite **TablesDB** (typed columns, per-user row security, composite indexes). Vectors come from Appwrite's built-in **nomic-embed-text** embeddings, and Appwrite **Auth** handles sign-in. Built with Next.js, TypeScript and Tailwind, deployed on Vercel.
