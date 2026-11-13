import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGapInterview, postGapAnswer } from "../api";
import type { GapItem } from "../types";
import { Button, EmptyState, ErrorState, Loading } from "@/shared/ui";

export function GapInterviewView() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["gapInterview"],
    queryFn: getGapInterview,
  });

  const [activeAnswers, setActiveAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ gapId: string; message: string; isError?: boolean } | null>(null);

  const mutation = useMutation({
    mutationFn: ({ gapId, answer }: { gapId: string; answer: string }) =>
      postGapAnswer(gapId, answer),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["gapInterview"] });
      queryClient.invalidateQueries({ queryKey: ["reviewQueue"] });
      queryClient.invalidateQueries({ queryKey: ["readiness"] });
      setActiveAnswers((prev) => {
        const next = { ...prev };
        delete next[vars.gapId];
        return next;
      });
      const redactionNote = res.redactions > 0 ? ` (${res.redactions} secret(s) automatically redacted)` : "";
      setFeedback({
        gapId: vars.gapId,
        message: `Answer submitted successfully as an Attested claim!${redactionNote}`,
      });
    },
    onError: (err: Error, vars) => {
      setFeedback({
        gapId: vars.gapId,
        message: err.message || "Failed to submit answer.",
        isError: true,
      });
    },
  });

  if (isLoading) {
    return <Loading label="Loading interview questions" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load interview questions"
        detail={(error as Error).message}
        onRetry={() => void refetch()}
      />
    );
  }

  const items = data?.items ?? [];
  const unansweredCount = items.filter((i) => !i.answered).length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl text-olive">Leaver Gap Interview</h2>
            <p className="mt-1 text-sm text-muted">
              Answer questions about knowledge that lacks written documentation. Your answers are recorded as{" "}
              <strong className="text-ink">Attested claims</strong> to complete the handover.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                unansweredCount === 0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {unansweredCount === 0 ? "All answered" : `${unansweredCount} pending`}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-line bg-wash p-3.5 text-xs text-muted flex items-start gap-2.5">
          <span className="text-base leading-none text-olive" aria-hidden="true">🔒</span>
          <div>
            <p className="font-semibold text-ink">Confidentiality & Automated Redaction</p>
            <p className="mt-0.5">
              Secrets (AWS keys, OpenAI tokens, GitHub credentials, passwords, phone numbers) are automatically
              redacted before storage. Stored responses are treated strictly as data, never instructions.
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`rounded-md p-4 text-sm flex items-center justify-between ${
            feedback.isError
              ? "border border-red-200 bg-red-50 text-red-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="No questions pending">
          There are currently no gap questions or approver inquiries for this project.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <GapQuestionCard
              key={item.gap_id}
              item={item}
              answerDraft={activeAnswers[item.gap_id] ?? ""}
              onAnswerChange={(val) =>
                setActiveAnswers((prev) => ({ ...prev, [item.gap_id]: val }))
              }
              onSubmit={(answer) =>
                mutation.mutate({ gapId: item.gap_id, answer })
              }
              isSubmitting={mutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GapQuestionCard({
  item,
  answerDraft,
  onAnswerChange,
  onSubmit,
  isSubmitting,
}: {
  item: GapItem;
  answerDraft: string;
  onAnswerChange: (val: string) => void;
  onSubmit: (answer: string) => void;
  isSubmitting: boolean;
}) {
  const isAskLeaver = item.source === "ask_leaver";

  return (
    <article
      className={`rounded-lg border p-5 transition-shadow ${
        item.answered
          ? "border-line bg-card/60 opacity-90"
          : "border-line bg-card shadow-sm hover:shadow-md"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            isAskLeaver
              ? "bg-purple-100 text-purple-800 border border-purple-200"
              : "bg-amber-100 text-amber-800 border border-amber-200"
          }`}
        >
          {isAskLeaver ? "Approver Inquiry" : "Knowledge Gap"}
        </span>

        {item.acl_label && (
          <span className="rounded bg-paper px-2 py-0.5 text-xs text-muted border border-line">
            Access: {item.acl_label}
          </span>
        )}

        {item.entity_key && (
          <span className="font-mono text-xs text-muted">
            Topic: {item.entity_key}
          </span>
        )}

        {item.answered ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            ✓ Attested
          </span>
        ) : (
          <span className="ml-auto text-xs text-amber-600 font-medium">
            Awaiting answer
          </span>
        )}
      </div>

      <h3 className="font-medium text-ink text-base mb-3 leading-snug">
        {item.question}
      </h3>

      {item.answered ? (
        <div className="rounded-md border border-line bg-wash p-3.5 mt-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
            Attested Answer
          </p>
          <p className="text-sm text-ink whitespace-pre-wrap">{item.answer}</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (answerDraft.trim()) {
              onSubmit(answerDraft.trim());
            }
          }}
          className="mt-3 space-y-3"
        >
          <div>
            <label htmlFor={`answer-${item.gap_id}`} className="sr-only">
              Your answer to {item.question}
            </label>
            <textarea
              id={`answer-${item.gap_id}`}
              rows={3}
              maxLength={1000}
              value={answerDraft}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder="Explain the process, context, key documents or owners..."
              className="w-full rounded-md border border-line bg-paper p-3 text-sm text-ink placeholder:text-muted focus:border-olive focus:outline-none focus:ring-1 focus:ring-olive"
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>Plain-text only. Tokens/credentials will be automatically masked.</span>
              <span>{answerDraft.length}/1000</span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting || !answerDraft.trim()}
              className="min-w-[120px]"
            >
              {isSubmitting ? "Submitting…" : "Submit Answer"}
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
