// Dev では VITE_API_BASE=http://localhost:4000 を .env.local に置く。
// 本番 (backend が dist を serve するモード) では env 空 → 同一 origin 相対にフォールバック。
const BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== "undefined" ? window.location.origin : "");

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async getToken(identity: string) {
    const res = await fetch(`${BASE}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity }),
    });
    return json<{ token: string; identity: string }>(res);
  },
  async startCall(to: string, agentIdentity: string, contactId?: string) {
    const res = await fetch(`${BASE}/api/call/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, agentIdentity, contactId }),
    });
    return json<{ callSid: string }>(res);
  },
  getContacts() {
    return fetch(`${BASE}/api/contacts`).then(json) as Promise<
      import("../types/domain").Contact[]
    >;
  },
  createContact(input: {
    name: string;
    phone: string;
    furigana?: string;
    license?: string;
    experienceYears?: number;
    preferredPrefecture?: string;
    preferredCity?: string;
    preferredEmploymentType?: string;
    wantsNightShift?: boolean;
    hourlyWageMinJpy?: number;
  }) {
    return fetch(`${BASE}/api/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then(json) as Promise<{
      contact: import("../types/domain").Contact;
      memory: { upsert: boolean; identifier: boolean };
    }>;
  },
  updateContactTraits(
    id: string,
    patch: {
      license?: string | null;
      experienceYears?: number | null;
      preferredPrefecture?: string | null;
      preferredCity?: string | null;
      preferredEmploymentType?: string | null;
      wantsNightShift?: boolean | null;
      hourlyWageMinJpy?: number | null;
    },
  ) {
    return fetch(`${BASE}/api/contacts/${id}/traits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json) as Promise<{
      contact: import("../types/domain").Contact;
      memory: { patched: boolean; memProfileId: string | null };
    }>;
  },
  deleteContact(id: string) {
    return fetch(`${BASE}/api/contacts/${id}`, {
      method: "DELETE",
    }).then(json) as Promise<{
      ok: boolean;
      removed: import("../types/domain").Contact;
      memoryDeleted: boolean;
    }>;
  },
  getContactMemory(id: string) {
    return fetch(`${BASE}/api/contacts/${id}/memory`).then(json) as Promise<{
      contact: import("../types/domain").Contact;
      memory: import("../types/domain").MemoryProfileView | null;
    }>;
  },
  getJobs() {
    return fetch(`${BASE}/api/jobs`).then(json) as Promise<
      import("../types/domain").Job[]
    >;
  },
  getTranscriptionConfig() {
    return fetch(`${BASE}/api/transcription/config`).then(json) as Promise<
      import("../types/domain").TranscriptionConfig
    >;
  },
  updateTranscriptionConfig(
    patch: Partial<import("../types/domain").TranscriptionConfig>,
  ) {
    return fetch(`${BASE}/api/transcription/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json) as Promise<import("../types/domain").TranscriptionConfig>;
  },
  getTranscriptionHints() {
    return fetch(`${BASE}/api/transcription/hints`).then(json) as Promise<{
      enabled: boolean;
      count: number;
      words: string[];
    }>;
  },
  getChecklistTemplate() {
    return fetch(`${BASE}/api/templates/checklist`).then(json) as Promise<
      import("../types/domain").ChecklistItemTemplate[]
    >;
  },
  getTalklistTemplate() {
    return fetch(`${BASE}/api/templates/talklist`).then(json) as Promise<
      import("../types/domain").TalklistItemTemplate[]
    >;
  },
};
