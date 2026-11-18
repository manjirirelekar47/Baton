import { useState, type FormEvent } from "react";
import { api } from "@/app/api";
import { Button } from "@/shared/ui";

interface AskEvidence {
  source_title: string | null;
  chunk_id: string | null;
  quote: string | null;
}

interface AskMatch {
  claim_id: string;
  statement: string;
  owner: string | null;
  due_date: string | null;
  score: number;
  evidence: AskEvidence[];
}

interface AskResponse {
  answer: string;
  matches: AskMatch[];
  approved_version: string | null;
}

const PROMPTS = ["Who owns the payments module?", "What are the open delivery risks?", "What should the incoming maintainer do first?"];

export function AskPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (question.trim().length < 3 || asking) return;
    setAsking(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api<AskResponse>("/ask", { method: "POST", body: { question: question.trim() } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Baton could not answer this question.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 pb-12">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Evidence-backed answers</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Ask Baton</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Ask about the handover. Baton searches the latest approved snapshot, shows only claims your role can access, and includes source quotes so you can verify each match.</p>
      </header>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-black/30">
        <label htmlFor="ask-question" className="block text-sm font-bold text-slate-800 dark:text-slate-100">Your question</label>
        <textarea id="ask-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} minLength={3} required rows={3} placeholder="Try asking about an owner, decision, dependency, or risk…" className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-white/15 dark:bg-slate-950 dark:text-white dark:focus:ring-violet-950" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">{question.length}/500 characters</span>
          <Button type="submit" disabled={asking || question.trim().length < 3}>{asking ? "Searching approved claims…" : "Ask Baton"}</Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
        {PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => setQuestion(prompt)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-violet-400">{prompt}</button>)}
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
      {result && <section aria-live="polite" className="space-y-4">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-400/20 dark:bg-violet-950/20">
          <p className="text-sm font-bold text-violet-950 dark:text-violet-100">Answer from {result.approved_version ?? "the approved snapshot"}</p>
          <p className="mt-2 text-sm leading-6 text-slate-800 dark:text-slate-200">{result.answer}</p>
        </div>
        {result.matches.map((match) => <article key={match.claim_id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-black/25">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-semibold text-slate-900 dark:text-white">{match.statement}</p>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Verified · {match.score}% match</span>
          </div>
          {(match.owner || match.due_date) && <p className="text-xs text-slate-600 dark:text-slate-400">{match.owner && <>Owner: <strong>{match.owner}</strong></>}{match.owner && match.due_date && " · "}{match.due_date && <>Due: <strong>{match.due_date}</strong></>}</p>}
          {match.evidence.length > 0 ? <ul className="space-y-2">{match.evidence.map((evidence, index) => <li key={`${evidence.chunk_id ?? "evidence"}-${index}`} className="rounded-xl border-l-2 border-violet-400 bg-slate-50 px-3 py-2 dark:bg-white/5">
            {evidence.quote && <blockquote className="text-xs italic leading-5 text-slate-700 dark:text-slate-300">“{evidence.quote}”</blockquote>}
            <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{evidence.source_title ?? "Approved source"}{evidence.chunk_id ? ` · ${evidence.chunk_id}` : ""}</p>
          </li>)}</ul> : <p className="text-xs text-slate-500 dark:text-slate-400">This approved claim has no displayed source excerpt.</p>}
        </article>)}
      </section>}
    </main>
  );
}
