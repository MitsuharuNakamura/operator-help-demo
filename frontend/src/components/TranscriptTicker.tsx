import { useEffect, useRef } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useCallStore } from "../store/useCallStore";

export default function TranscriptTicker() {
  const { t } = useTranslation();
  const utterances = useCallStore((s) => s.utterances);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [utterances]);

  return (
    <section className="bg-brand-900 rounded-clinical shadow-clinical h-full flex flex-col overflow-hidden ring-1 ring-brand-800/50">
      <header className="px-4 py-2.5 border-b border-brand-800 flex items-center gap-2 bg-brand-900/95">
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-base tracking-wide text-brand-100 font-semibold">
          {t("transcript.heading")}
        </span>
        <span className="ml-auto text-[10px] text-brand-300">
          {utterances.length > 0
            ? `${utterances.filter((u) => u.final).length} utterances`
            : ""}
        </span>
      </header>

      <div
        ref={ref}
        className="flex-1 overflow-auto px-4 py-3 space-y-3"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {utterances.length === 0 && (
          <div className="text-brand-300 text-sm text-center pt-8">
            {t("transcript.empty")}
          </div>
        )}
        {utterances.map((u) => (
          <UtteranceRow
            key={u.id}
            speaker={u.speaker}
            text={u.text}
            final={u.final}
            timestamp={u.timestamp}
            agentLabel={t("transcript.agent")}
            customerLabel={t("transcript.customer")}
          />
        ))}
      </div>
    </section>
  );
}

interface RowProps {
  speaker: "agent" | "customer";
  text: string;
  final: boolean;
  timestamp: string;
  agentLabel: string;
  customerLabel: string;
}

function UtteranceRow({
  speaker,
  text,
  final,
  timestamp,
  agentLabel,
  customerLabel,
}: RowProps) {
  const isAgent = speaker === "agent";
  const time = new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div className={clsx("flex", isAgent ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[85%] rounded-2xl px-4 py-2 leading-relaxed shadow-sm",
          isAgent
            ? "bg-brand-500 text-white"
            : "bg-brand-800 text-white border border-brand-700",
          !final && "opacity-60 italic",
        )}
      >
        <div
          className={clsx(
            "flex items-baseline gap-2 mb-0.5 text-[10px] uppercase tracking-wide font-semibold",
            isAgent ? "text-brand-100" : "text-brand-300",
          )}
        >
          <span>{isAgent ? agentLabel : customerLabel}</span>
          <span className="opacity-70">{time}</span>
          {!final && <span className="opacity-70">…</span>}
        </div>
        <div className="text-[15px] whitespace-pre-wrap break-words">
          {text}
        </div>
      </div>
    </div>
  );
}
