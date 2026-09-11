import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ChecklistItemTemplate,
  Contact,
  Job,
  TalklistItemTemplate,
} from "../types/domain.js";

const __filename = fileURLToPath(import.meta.url);
const dataDir = path.resolve(path.dirname(__filename), "..", "data");

function loadJson<T>(file: string): T {
  const p = path.join(dataDir, file);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as T;
}

export function loadContacts(): Contact[] {
  return loadJson<Contact[]>("contacts.json");
}

export function saveContacts(list: Contact[]): void {
  const p = path.join(dataDir, "contacts.json");
  fs.writeFileSync(p, JSON.stringify(list, null, 2) + "\n", "utf8");
}

export function loadJobs(): Job[] {
  return loadJson<Job[]>("jobs.json");
}

export function loadChecklistTemplate(): ChecklistItemTemplate[] {
  return loadJson<ChecklistItemTemplate[]>("checklist.template.json");
}

export function loadTalklistTemplate(): TalklistItemTemplate[] {
  return loadJson<TalklistItemTemplate[]>("talklist.template.json");
}
