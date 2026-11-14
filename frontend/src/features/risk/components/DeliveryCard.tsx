/**
 * DeliveryCard.tsx
 * Simplified, Scannable Delivery Task Card supporting both Light and Dark modes.
 * Features clean whitespace (p-6, gap-4) and high contrast typography.
 */

import React from "react";

export interface DeliveryItem {
  task: string;
  title: string;
  due: string | null;
  status: string;
  blocked_by: string[];
  holds_up: string[];
  chunk_id: string;
  quote: string;
  label: string;
}

interface DeliveryCardProps {
  item: DeliveryItem;
  isDark?: boolean;
}

export const DeliveryCard: React.FC<DeliveryCardProps> = ({ item, isDark = false }) => {
  return (
    <article
      className={`rounded-2xl transition-all ${
        isDark
          ? "border border-white/10 bg-black/40 backdrop-blur-xl p-6 shadow-2xl hover:border-purple-400/30"
          : "border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          className={`text-base font-bold ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {item.task}: {item.title}
        </h3>
        <span
          className={`text-xs font-bold uppercase px-3 py-1 rounded-full border shadow-xs ${
            isDark
              ? "bg-amber-950/40 text-amber-300 border-amber-500/30"
              : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          {item.status}
        </span>
      </div>

      <p
        className={`mt-2 text-xs ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        Due:{" "}
        <span
          className={`font-semibold ${
            isDark ? "text-slate-200" : "text-slate-800"
          }`}
        >
          {item.due ?? "Not recorded"}
        </span>{" "}
        · Blocked by:{" "}
        <span
          className={`font-semibold ${
            isDark ? "text-slate-200" : "text-slate-800"
          }`}
        >
          {item.blocked_by.join(", ") || "None"}
        </span>{" "}
        · Holds up:{" "}
        <span
          className={`font-semibold ${
            isDark ? "text-slate-200" : "text-slate-800"
          }`}
        >
          {item.holds_up.join(", ") || "None"}
        </span>
      </p>

      {item.quote && (
        <blockquote
          className={`mt-3 border-l-4 border-purple-500 pl-3.5 text-xs italic p-3 rounded-r-xl border ${
            isDark
              ? "bg-black/60 text-slate-300 border-white/5"
              : "bg-slate-50 text-slate-700 border-slate-200/80"
          }`}
        >
          “{item.quote}”
        </blockquote>
      )}

      <p
        className={`mt-3 text-[11px] font-mono ${
          isDark ? "text-slate-500" : "text-slate-400"
        }`}
      >
        Evidence: {item.chunk_id} · {item.label}
      </p>
    </article>
  );
};

export default DeliveryCard;
