import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ChecklistItemTemplate,
  Contact,
  Job,
  TalklistItemTemplate,
} from "../types/domain";
import { api } from "../api/http";
import { connectLive } from "../api/live";
import { initDevice } from "../api/twilioClient";
import { useAppStore } from "../store/useAppStore";
import { useCallStore } from "../store/useCallStore";
import TopBar from "../components/TopBar/TopBar";
import CallerProfileCard from "../components/CallerProfileCard";
import ChecklistPanel from "../components/ChecklistPanel";
import TalklistPanel from "../components/TalklistPanel";
import JobSuggestionsPanel from "../components/JobSuggestionsPanel";
import TranscriptTicker from "../components/TranscriptTicker";
import PostCallCIPanel from "../components/PostCallCIPanel";

export default function MainScreen() {
  const { t } = useTranslation();
  const agentName = useAppStore((s) => s.agentName);
  const error = useCallStore((s) => s.error);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [checklistTpl, setChecklistTpl] = useState<
    ChecklistItemTemplate[]
  >([]);
  const [talklistTpl, setTalklistTpl] = useState<TalklistItemTemplate[]>([]);
  const [ready, setReady] = useState(false);

  const refreshContacts = async () => {
    try {
      const c = await api.getContacts();
      setContacts(c);
    } catch (e) {
      useCallStore.getState().setError((e as Error).message);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [c, j, cl, tl] = await Promise.all([
          api.getContacts(),
          api.getJobs(),
          api.getChecklistTemplate(),
          api.getTalklistTemplate(),
        ]);
        setContacts(c);
        setJobs(j);
        setChecklistTpl(cl);
        setTalklistTpl(tl);

        // initDevice 経由で backend が確定した safe identity を取得し、
        // 以降 WS / call.start はその identity で routing される。
        let identity = "";
        try {
          const res = await initDevice(agentName);
          identity = res.identity;
          useAppStore.getState().setAgentId(identity);
        } catch (e) {
          useCallStore.getState().setError((e as Error).message);
        }
        connectLive(identity || agentName);
        setReady(true);
      } catch (e) {
        useCallStore.getState().setError((e as Error).message);
      }
    })();
  }, [agentName]);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-brand-50">
      <TopBar
        contacts={contacts}
        checklistTpl={checklistTpl}
        onContactsChanged={refreshContacts}
      />

      {error && (
        <div className="bg-red-100 text-red-800 text-sm px-4 py-2">
          {error.startsWith("errors.") ? t(error) : error}
        </div>
      )}

      <main
        className="flex-1 min-h-0 grid gap-3 p-3"
        style={{
          gridTemplateColumns:
            "minmax(280px, 1fr) minmax(360px, 1.3fr) minmax(320px, 1.1fr)",
        }}
      >
        {/* Left column: caller profile + checklist */}
        <div className="min-h-0 grid grid-rows-[minmax(0,auto)_minmax(0,1fr)] gap-3">
          <CallerProfileCard />
          <ChecklistPanel template={checklistTpl} />
        </div>

        {/* Middle column: full-height live transcript */}
        <div className="min-h-0">
          <TranscriptTicker />
        </div>

        {/* Right column: talklist + jobs */}
        <div className="min-h-0 grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <TalklistPanel template={talklistTpl} />
          <JobSuggestionsPanel jobs={jobs} />
        </div>
      </main>

      <PostCallCIPanel />

      {!ready && (
        <div className="fixed bottom-4 right-4 text-xs text-slate-500 bg-white border border-slate-200 rounded px-2 py-1 shadow">
          Loading…
        </div>
      )}
    </div>
  );
}
