import "server-only";
import type { AgentStore, KeyStore, LibraryStore, ProviderCapabilities, SkillStore, ThreadStore, VectorStore } from "@/core/stores";
import * as agents from "@/lib/agents";
import * as keys from "@/lib/keys";
import * as libraries from "@/lib/libraries";
import * as skills from "@/lib/skills";
import * as threads from "@/lib/threads";
import { vectorStore as tablesVectorStore } from "@/lib/vector-store";

// Thin adapters over the existing domain functions (unchanged), which already talk to Appwrite TablesDB.
export const libraryStore: LibraryStore = {
  list: libraries.listLibraries, get: libraries.getLibrary, create: libraries.createLibrary, remove: libraries.deleteLibrary,
  listDocuments: libraries.listDocuments, search: libraries.searchLibraries,
};
export const threadStore: ThreadStore = {
  list: threads.listThreads, get: threads.getThread, create: threads.createThread, update: threads.updateThread, remove: threads.deleteThread,
  listEntries: threads.listMemories, addEntry: threads.saveMemory,
};
export const skillStore: SkillStore = {
  list: skills.listSkills, get: skills.getSkill, create: skills.createSkill, update: skills.updateSkill, remove: skills.deleteSkill,
  versions: skills.listSkillVersions, restore: skills.restoreSkillVersion, duplicate: skills.duplicateSkill,
};
export const agentStore: AgentStore = {
  list: agents.listAgents, get: agents.getAgent, create: agents.createAgent, update: agents.updateAgent, remove: agents.deleteAgent,
  assignSkill: agents.assignSkill, removeSkill: agents.removeSkill, assignLibrary: agents.assignLibrary, removeLibrary: agents.removeLibrary,
};
export const keyStore: KeyStore = { list: keys.listKeys, create: keys.createKey, revoke: keys.revokeKey, rotate: keys.rotateKey, authenticate: keys.authenticateToken };
export const vectorStore: VectorStore = tablesVectorStore;

export const capabilities: ProviderCapabilities = {
  provider: "appwrite-tablesdb", status: "production-verified",
  nativeVectorSearch: false, fullTextSearch: false, transactions: false, relationships: false,
  notes: "768-d vectors stored as JSON in TablesDB; cosine + keyword ranking runs in the app. VectorsDB needs a paid dedicated instance on this project.",
};
