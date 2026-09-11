import { create } from "zustand";
import type { Lang } from "../types/domain";

interface AppState {
  agentName: string;
  /** Twilio Voice Client identity (safe form). backend が /api/token で確定を返す */
  agentId: string;
  lang: Lang;
  setAgent: (name: string) => void;
  setAgentId: (id: string) => void;
  setLang: (l: Lang) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  agentName:
    (typeof window !== "undefined" ? localStorage.getItem("agentName") : "") ||
    "",
  agentId:
    (typeof window !== "undefined" ? localStorage.getItem("agentId") : "") ||
    "",
  lang: ((typeof window !== "undefined"
    ? localStorage.getItem("lang")
    : "ja") as Lang) || "ja",
  setAgent: (name) => {
    localStorage.setItem("agentName", name);
    set({ agentName: name });
  },
  setAgentId: (id) => {
    localStorage.setItem("agentId", id);
    set({ agentId: id });
  },
  setLang: (l) => {
    localStorage.setItem("lang", l);
    set({ lang: l });
  },
  logout: () => {
    localStorage.removeItem("agentName");
    localStorage.removeItem("agentId");
    set({ agentName: "", agentId: "" });
  },
}));
