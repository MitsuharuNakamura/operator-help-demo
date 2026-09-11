import { create } from "zustand";
import type {
  CallState,
  ChecklistStateItem,
  Contact,
  JobRanking,
  MemoryProfileView,
  TalklistStateItem,
  Utterance,
} from "../types/domain";

interface CallStore {
  callState: CallState;
  callSid: string | null;
  activeContact: Contact | null;
  callerMemory: MemoryProfileView | null;
  /** ChecklistPanel でオペレータが手動で編集した値 (itemId → value)。
   * 手動値が入っている項目は CI verdict による自動上書きを行わない。 */
  checklistManual: Record<string, unknown>;
  dialInput: string;
  utterances: Utterance[];
  checklist: Record<string, ChecklistStateItem>;
  talklist: Record<string, TalklistStateItem>;
  jobRankings: JobRanking[];
  postCall: {
    open: boolean;
    summary?: string;
    sentiment?: string;
    operators?: Array<{ name: string; kind: string; result: unknown }>;
  };
  error: string | null;

  setCallState: (s: CallState, callSid?: string | null) => void;
  setActiveContact: (c: Contact | null, memory?: MemoryProfileView | null) => void;
  /** 保存後の contact 更新 (checklistManual は維持) */
  updateActiveContactAfterSave: (c: Contact) => void;
  setDialInput: (v: string) => void;
  addUtterance: (u: Utterance) => void;
  clearTranscript: () => void;
  applyChecklist: (items: ChecklistStateItem[]) => void;
  setChecklistManual: (itemId: string, value: unknown) => void;
  clearChecklistManual: () => void;
  applyTalklist: (items: TalklistStateItem[]) => void;
  applyJobs: (r: JobRanking[]) => void;
  openPostCall: (p: CallStore["postCall"]) => void;
  closePostCall: () => void;
  setError: (msg: string | null) => void;
  resetCall: () => void;
}

export const useCallStore = create<CallStore>((set, get) => ({
  callState: "idle",
  callSid: null,
  activeContact: null,
  callerMemory: null,
  checklistManual: {},
  dialInput: "",
  utterances: [],
  checklist: {},
  talklist: {},
  jobRankings: [],
  postCall: { open: false },
  error: null,

  setCallState: (s, callSid) =>
    set((prev) => ({
      callState: s,
      callSid: callSid === undefined ? prev.callSid : callSid,
    })),
  setActiveContact: (c, memory) =>
    set({
      activeContact: c,
      callerMemory: memory ?? null,
      dialInput: c?.phone || "",
      checklistManual: {},
    }),
  updateActiveContactAfterSave: (c) => set({ activeContact: c }),
  setDialInput: (v) => set({ dialInput: v }),
  addUtterance: (u) => {
    const list = [...get().utterances];
    if (!u.final) {
      const idx = list.findIndex(
        (x) => !x.final && x.speaker === u.speaker,
      );
      if (idx >= 0) list[idx] = u;
      else list.push(u);
    } else {
      const idx = list.findIndex(
        (x) => !x.final && x.speaker === u.speaker,
      );
      if (idx >= 0) list.splice(idx, 1);
      list.push(u);
    }
    const trimmed = list.slice(-200);
    set({ utterances: trimmed });
  },
  clearTranscript: () => set({ utterances: [] }),
  applyChecklist: (items) => {
    const map = { ...get().checklist };
    for (const it of items) {
      map[it.itemId] = it;
    }
    set({ checklist: map });
  },
  setChecklistManual: (itemId, value) => {
    const map = { ...get().checklistManual };
    if (value === undefined || value === null || value === "") {
      delete map[itemId];
    } else {
      map[itemId] = value;
    }
    set({ checklistManual: map });
  },
  clearChecklistManual: () => set({ checklistManual: {} }),
  applyTalklist: (items) => {
    const map = { ...get().talklist };
    for (const it of items) {
      map[it.itemId] = it;
    }
    set({ talklist: map });
  },
  applyJobs: (rankings) => set({ jobRankings: rankings }),
  openPostCall: (p) => set({ postCall: { ...p, open: true } }),
  closePostCall: () => set({ postCall: { open: false } }),
  setError: (msg) => set({ error: msg }),
  resetCall: () =>
    set({
      callState: "idle",
      callSid: null,
      utterances: [],
      checklist: {},
      talklist: {},
      jobRankings: [],
    }),
}));
