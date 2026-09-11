export type SpeakerRole = "agent" | "customer";

export interface Contact {
  id: string;
  name: string;
  furigana?: string;
  phone: string;
  memoryCustomerId?: string;
  notes?: string;
  // Optional checklist-shaped traits (persisted locally in contacts.json).
  // Memory 側は firstName/lastName/city の 3 つのみ mirror される。
  license?: string;
  experienceYears?: number;
  preferredPrefecture?: string;
  preferredCity?: string;
  preferredEmploymentType?: "full_time" | "part_time" | "contract" | "dispatch";
  wantsNightShift?: boolean;
  hourlyWageMinJpy?: number;
  tags?: string[];
}

export type LocalizedLabel = {
  ja: string;
  en: string;
  zh: string;
};

export interface ChecklistItemTemplate {
  id: string;
  label: LocalizedLabel;
  extractionKey: string;
  extractionHint?: string;
}

export interface TalklistItemTemplate {
  id: string;
  label: LocalizedLabel;
  criteria: string;
}

export interface Job {
  id: string;
  title: string;
  location: { prefecture: string; city?: string };
  employmentType: "full_time" | "part_time" | "contract" | "dispatch";
  hourlyWageJpy?: [number, number];
  requirements: {
    license?: ("RN" | "LPN" | "care_worker")[];
    experienceYears?: number;
    nightShift?: boolean;
  };
  tags: string[];
  description?: LocalizedLabel;
}

export interface Utterance {
  id: string;
  callSid: string;
  speaker: SpeakerRole;
  text: string;
  final: boolean;
  confidence?: number;
  timestamp: string;
}

export type CallState =
  | "idle"
  | "dialing"
  | "ringing"
  | "connected"
  | "muted"
  | "ended"
  | "failed";

export type Verdict =
  | {
      kind: "checklist";
      items: Array<{
        itemId: string;
        value: unknown;
        confidence: number;
        status: "empty" | "partial" | "confirmed";
      }>;
    }
  | {
      kind: "talklist";
      items: Array<{ itemId: string; done: boolean; evidence?: string }>;
    }
  | {
      kind: "jobs";
      rankings: Array<{ jobId: string; score: number; reasons: string[] }>;
    };

export type LiveEvent =
  | { type: "transcript"; payload: Utterance }
  | {
      type: "call-status";
      payload: { callSid?: string; state: CallState; contactId?: string };
    }
  | { type: "verdict"; payload: Verdict & { callSid: string; at: string } }
  | {
      type: "ci-post-call";
      payload: {
        callSid: string;
        summary?: string;
        sentiment?: string;
        operators: Array<{ name: string; kind: string; result: unknown }>;
      };
    }
  | { type: "error"; payload: { message: string } };

export interface CallSession {
  callSid: string;
  agentIdentity: string;
  contactId?: string;
  customerPhone?: string;
  startedAt: string;
  endedAt?: string;
  conversationId?: string;
  extracted: Record<string, unknown>;
}
