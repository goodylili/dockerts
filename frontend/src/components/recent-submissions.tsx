"use client";

import { useCallback, useEffect, useState } from "react";

import { parseApiError } from "@/lib/api-errors";
import type { BioRecord, BioRecordList } from "@/lib/bio";

const PAGE_SIZE = 20;

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: BioRecordList };

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type Settled = Exclude<State, { kind: "loading" }>;

async function fetchPage(offset: number): Promise<Settled> {
  try {
    const response = await fetch(
      `/api/bio-records?limit=${PAGE_SIZE}&offset=${offset}`,
      { cache: "no-store" },
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        kind: "error",
        message: parseApiError(response.status, body).message,
      };
    }
    return { kind: "ready", data: body as BioRecordList };
  } catch {
    return {
      kind: "error",
      message: "Could not load recent submissions. Check your connection.",
    };
  }
}

export function RecentSubmissions({ refreshToken }: { refreshToken: number }) {
  /**
   * Paging is stamped with the refresh token it was chosen under, so a
   * successful submit implicitly sends the reader back to page one without an
   * extra state-syncing effect.
   */
  const [page, setPage] = useState({ offset: 0, token: refreshToken });
  const offset = page.token === refreshToken ? page.offset : 0;
  const setOffset = useCallback(
    (next: number) => setPage({ offset: next, token: refreshToken }),
    [refreshToken],
  );

  const [retryToken, setRetryToken] = useState(0);
  const requestKey = `${refreshToken}:${retryToken}:${offset}`;
  const [result, setResult] = useState<{ key: string; state: Settled } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void fetchPage(offset).then((settled) => {
      if (!cancelled) setResult({ key: requestKey, state: settled });
    });
    return () => {
      cancelled = true;
    };
    // `requestKey` already encodes `offset` plus the refresh/retry triggers.
  }, [requestKey, offset]);

  const state: State =
    result && result.key === requestKey ? result.state : { kind: "loading" };
  const load = useCallback(() => setRetryToken((n) => n + 1), []);

  const isLoading = state.kind === "loading";
  const total = state.kind === "ready" ? state.data.total : 0;
  const canPrev = offset > 0;
  const canNext = state.kind === "ready" && offset + PAGE_SIZE < total;

  return (
    <section
      aria-labelledby="recent-heading"
      className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="recent-heading"
          className="text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          Recent submissions
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {state.kind === "ready"
            ? `${total} record${total === 1 ? "" : "s"} total`
            : " "}
        </p>
      </div>

      <div aria-live="polite" className="mt-5">
        {state.kind === "loading" ? <SkeletonRows /> : null}

        {state.kind === "error" ? (
          <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            <p role="alert">{state.message}</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40"
            >
              Retry
            </button>
          </div>
        ) : null}

        {state.kind === "ready" && state.data.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No records yet. The first submission will show up here.
          </p>
        ) : null}

        {state.kind === "ready" && state.data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <caption className="sr-only">
                Biodata records, newest first
              </caption>
              <thead>
                <tr className="text-left text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Name
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Email
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Age
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    BMI
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.data.items.map((record: BioRecord) => (
                  <tr key={record.id}>
                    <th
                      scope="row"
                      className="py-3 pr-4 text-left font-medium text-slate-900 dark:text-slate-100"
                    >
                      {record.full_name}
                    </th>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      {record.email}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {record.age}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {typeof record.bmi === "number"
                        ? record.bmi.toFixed(1)
                        : "—"}
                    </td>
                    <td className="py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {formatDate(record.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {state.kind === "ready" && total > 0
            ? `Showing ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`
            : " "}
        </p>
        <div className="flex gap-2">
          <PageButton
            disabled={!canPrev || isLoading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </PageButton>
          <PageButton
            disabled={!canNext || isLoading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </PageButton>
        </div>
      </div>
    </section>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-slate-400/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
        />
      ))}
      <span className="sr-only">Loading recent submissions…</span>
    </div>
  );
}
