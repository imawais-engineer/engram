/**
 * Storage seams. The MCP server, API routes and UI talk to domain functions; these interfaces name
 * the contract those functions already fulfil, so another backend can be added without touching callers.
 * Today there is one implementation: Appwrite TablesDB (src/infrastructure/appwrite-tables.ts).
 */
import type { Agent, AgentInput, AgentWithLinks } from "@/lib/agents";
import type { ApiKey, AuthedKey, KeyInput } from "@/lib/keys";
import type { Doc, Library, SearchHit } from "@/lib/libraries";
import type { Skill, SkillInput, SkillStatus, SkillVersion } from "@/lib/skills";
import type { Memory, Thread } from "@/lib/threads";
export type { VectorStore } from "@/lib/vector-store";

export interface LibraryStore {
  list(userId: string, onlyIds?: string[]): Promise<Library[]>;
  get(userId: string, id: string): Promise<Library | null>;
  create(userId: string, input: { name?: unknown; description?: unknown; icon?: unknown }): Promise<Library>;
  remove(userId: string, id: string): Promise<boolean>;
  listDocuments(userId: string, libraryIds: string[]): Promise<Doc[]>;
  search(userId: string, libraryIds: string[], query: string, limit?: number): Promise<SearchHit[]>;
}

export interface ThreadStore {
  list(userId: string, onlyIds?: string[]): Promise<Thread[]>;
  get(userId: string, id: string): Promise<Thread | null>;
  create(userId: string, input: Record<string, unknown>): Promise<Thread>;
  update(userId: string, id: string, input: Record<string, unknown>): Promise<Thread | null>;
  remove(userId: string, id: string): Promise<boolean>;
  listEntries(userId: string, threadIds: string[], type?: string): Promise<Memory[]>;
  addEntry(userId: string, threadId: string, input: { type?: unknown; content?: unknown; tags?: unknown }, meta: { source: string; keyId?: string }): Promise<Memory>;
}

export interface SkillStore {
  list(userId: string, opts?: { status?: SkillStatus; ids?: string[] }): Promise<Skill[]>;
  get(userId: string, id: string): Promise<Skill | null>;
  create(userId: string, input: SkillInput): Promise<Skill>;
  update(userId: string, id: string, input: SkillInput): Promise<Skill | null>;
  remove(userId: string, id: string): Promise<boolean>;
  versions(userId: string, id: string): Promise<SkillVersion[] | null>;
  restore(userId: string, id: string, version: number): Promise<Skill | null>;
  duplicate(userId: string, id: string): Promise<Skill | null>;
}

export interface AgentStore {
  list(userId: string): Promise<Agent[]>;
  get(userId: string, id: string): Promise<AgentWithLinks | null>;
  create(userId: string, input: AgentInput & { skillIds?: unknown; libraryIds?: unknown }): Promise<AgentWithLinks | null>;
  update(userId: string, id: string, input: AgentInput): Promise<AgentWithLinks | null>;
  remove(userId: string, id: string): Promise<boolean>;
  assignSkill(userId: string, agentId: string, skillId: string, pinnedVersion?: number | null): Promise<AgentWithLinks | null>;
  removeSkill(userId: string, agentId: string, skillId: string): Promise<AgentWithLinks | null>;
  assignLibrary(userId: string, agentId: string, libraryId: string): Promise<AgentWithLinks | null>;
  removeLibrary(userId: string, agentId: string, libraryId: string): Promise<AgentWithLinks | null>;
}

export interface KeyStore {
  list(userId: string): Promise<ApiKey[]>;
  create(userId: string, input: KeyInput): Promise<{ key: ApiKey; token: string }>;
  revoke(userId: string, id: string): Promise<ApiKey | null>;
  rotate(userId: string, id: string): Promise<{ key: ApiKey; token: string } | null>;
  authenticate(token: string): Promise<AuthedKey | null>;
}

/** What the active provider can and can't do. Static and honest: nothing here is simulated. */
export type ProviderCapabilities = {
  provider: string; status: "production-verified" | "planned";
  nativeVectorSearch: boolean; fullTextSearch: boolean; transactions: boolean; relationships: boolean; notes: string;
};
