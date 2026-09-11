export type Lang = "ja" | "en" | "zh";

export interface TranscriptionConfig {
  languageCode: string;
  engine: "google" | "deepgram";
  speechModel: string;
  hintsEnabled: boolean;
  hintsExtra: string;
}
export type SpeakerRole = "agent" | "customer";
export type CallState =
  | "idle"
  | "dialing"
  | "ringing"
  | "connected"
  | "muted"
  | "ended"
  | "failed";

export interface Contact {
  id: string;
  name: string;
  furigana?: string;
  phone: string;
  memoryCustomerId?: string;
  notes?: string;
  license?: string;
  experienceYears?: number;
  preferredPrefecture?: string;
  preferredCity?: string;
  preferredEmploymentType?: "full_time" | "part_time" | "contract" | "dispatch";
  wantsNightShift?: boolean;
  hourlyWageMinJpy?: number;
  tags?: string[];
}

export interface MemoryProfileView {
  memProfileId: string | null;
  traits: Record<string, unknown>;
  observations: Array<{ content: string; occurredAt?: string; score?: number }>;
  summaries: Array<{ content: string; occurredAt?: string }>;
}

export interface LocalizedLabel {
  ja: string;
  en: string;
  zh: string;
}

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

export interface ChecklistStateItem {
  itemId: string;
  value: unknown;
  confidence: number;
  status: "empty" | "partial" | "confirmed";
}
export interface TalklistStateItem {
  itemId: string;
  done: boolean;
  evidence?: string;
}
export interface JobRanking {
  jobId: string;
  score: number;
  reasons: string[];
}

export type LiveEvent =
  | { type: "transcript"; payload: Utterance }
  | {
      type: "call-status";
      payload: { callSid?: string; state: CallState; contactId?: string };
    }
  | {
      type: "verdict";
      payload:
        | ({ kind: "checklist"; items: ChecklistStateItem[] } & {
            callSid: string;
            at: string;
          })
        | ({ kind: "talklist"; items: TalklistStateItem[] } & {
            callSid: string;
            at: string;
          })
        | ({ kind: "jobs"; rankings: JobRanking[] } & {
            callSid: string;
            at: string;
          });
    }
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
