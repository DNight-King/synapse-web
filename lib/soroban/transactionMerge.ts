import { MOCK_TXS } from "@/lib/mock-data";
import type { Transaction, TxStatus } from "@/lib/types";
import type { NormalizedSorobanEvent } from "./events";

/** Marker string for fields of a row that has been registered on-chain but not yet enriched. */
export const PLACEHOLDER_MARKER = "…";

/** How long an optimistic status stays on screen waiting for the poller to confirm it. */
export const OPTIMISTIC_TIMEOUT_MS = 30_000;

const TX_STATUSES: readonly TxStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"];

function toTxStatus(value: unknown): TxStatus | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  return (TX_STATUSES as readonly string[]).includes(upper) ? (upper as TxStatus) : null;
}

/**
 * Folds live contract events over the mock baseline: `TransactionRegistered`
 * inserts a placeholder row for an unseen id, and `StatusChanged` updates the
 * status of a known row. Events for unknown ids are ignored.
 */
export function mergeTransactionEvents(events: NormalizedSorobanEvent[]): Transaction[] {
  const result: Transaction[] = MOCK_TXS.map((tx) => ({ ...tx }));
  const index = new Map(result.map((tx, i) => [tx.id, i]));

  for (const event of events) {
    if (!event.txId) continue;

    if (event.type === "TransactionRegistered") {
      if (index.has(event.txId)) continue;
      index.set(event.txId, result.length);
      result.push({
        id: event.txId,
        asset: PLACEHOLDER_MARKER,
        amount: 0,
        status: "PENDING",
        timestamp: event.timestamp,
        from: PLACEHOLDER_MARKER,
        to: PLACEHOLDER_MARKER,
        memo: "",
        callback_url: "",
        retries: 0,
        created_at: event.timestamp,
      });
    } else if (event.type === "StatusChanged") {
      const i = index.get(event.txId);
      const status = toTxStatus(event.toStatus);
      const current = i === undefined ? undefined : result[i];
      if (current && status) result[i!] = { ...current, status };
    }
  }

  return result;
}

/**
 * Maps a decoded `get_transaction` struct onto a Transaction, falling back to
 * the placeholder row field-by-field wherever the decoded value is missing or
 * has the wrong type.
 */
export function nativeToTransaction(
  id: string,
  native: unknown,
  fallback: Transaction
): Transaction {
  if (native === null || typeof native !== "object") return fallback;
  const raw = native as Record<string, unknown>;

  const str = (key: string, dflt: string) =>
    typeof raw[key] === "string" ? (raw[key] as string) : dflt;
  const num = (key: string, dflt: number) => {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "bigint") return Number(v);
    return dflt;
  };

  return {
    id,
    asset: str("asset", fallback.asset),
    amount: num("amount", fallback.amount),
    status: toTxStatus(raw.status) ?? fallback.status,
    timestamp: fallback.timestamp,
    from: str("from", fallback.from),
    to: str("to", fallback.to),
    memo: str("memo", fallback.memo),
    callback_url: str("callback_url", fallback.callback_url),
    retries: num("retries", fallback.retries),
    created_at: num("created_at", fallback.created_at),
  };
}

/** A status change the user just submitted, shown before the poller confirms it. */
export interface OptimisticTransition {
  txId: string;
  expectedStatus: TxStatus;
  previousStatus: TxStatus;
  submittedAt: number;
  failed?: boolean;
  error?: string;
}

function isSettled(tx: Transaction | undefined, t: OptimisticTransition, now: number): boolean {
  return (
    Boolean(t.failed) ||
    now - t.submittedAt > OPTIMISTIC_TIMEOUT_MS ||
    tx?.status === t.expectedStatus
  );
}

/**
 * Shows each pending transition's expected status immediately. Once the
 * poller confirms it, the submission fails, or the timeout passes, the
 * poller's own value is shown again (a rollback).
 */
export function applyOptimisticOverlay(
  txs: Transaction[],
  transitions: OptimisticTransition[],
  now: number = Date.now()
): Transaction[] {
  if (transitions.length === 0) return txs;
  const byId = new Map(transitions.map((t) => [t.txId, t]));
  return txs.map((tx) => {
    const t = byId.get(tx.id);
    if (!t || isSettled(tx, t, now)) return tx;
    return { ...tx, status: t.expectedStatus };
  });
}

/** Drops transitions that no longer need an overlay. */
export function pruneOptimisticTransitions(
  txs: Transaction[],
  transitions: OptimisticTransition[],
  now: number = Date.now()
): OptimisticTransition[] {
  const byId = new Map(txs.map((tx) => [tx.id, tx]));
  return transitions.filter((t) => !isSettled(byId.get(t.txId), t, now));
}

export interface MergeableTransaction {
  id: string;
  [key: string]: unknown;
}

/**
 * Merge two transaction lists, preferring the freshest copy of each
 * transaction (by id) while preserving the order of the incoming list.
 */
export function mergeTransactions<T extends MergeableTransaction>(
  existing: T[],
  incoming: T[]
): T[] {
  const byId = new Map<string, T>();
  for (const tx of existing) {
    byId.set(tx.id, tx);
  }
  for (const tx of incoming) {
    byId.set(tx.id, tx);
  }
  return Array.from(byId.values());
}

/**
 * Adaptive polling interval controller.
 *
 * Tracks recent event frequency and exposes the next poll delay within a
 * defined [minInterval, maxInterval] range: polling faster during bursts of
 * activity and backing off when idle.
 */
export interface AdaptivePollingOptions {
  /** Fastest allowed poll interval in ms (used during bursts). */
  minInterval?: number;
  /** Slowest allowed poll interval in ms (used when idle). */
  maxInterval?: number;
  /** Number of recent polls considered when measuring event rate. */
  windowSize?: number;
}

const DEFAULT_MIN_INTERVAL = 2_000;
const DEFAULT_MAX_INTERVAL = 30_000;
const DEFAULT_WINDOW_SIZE = 5;

/**
 * Tracks recent event counts and computes an adaptive next-poll delay.
 *
 * The delay scales linearly between `minInterval` (when every recent poll
 * produced events) and `maxInterval` (when recent polls were idle).
 */
export class AdaptivePollingController {
  private readonly minInterval: number;
  private readonly maxInterval: number;
  private readonly windowSize: number;
  private readonly recentEventCounts: number[] = [];

  constructor(options: AdaptivePollingOptions = {}) {
    this.minInterval = options.minInterval ?? DEFAULT_MIN_INTERVAL;
    this.maxInterval = options.maxInterval ?? DEFAULT_MAX_INTERVAL;
    this.windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;
  }

  /** Record the number of events observed in the most recent poll. */
  recordEventCount(count: number): void {
    this.recentEventCounts.push(Math.max(0, count));
    if (this.recentEventCounts.length > this.windowSize) {
      this.recentEventCounts.shift();
    }
  }

  /**
   * Compute the next poll delay in ms based on recent event frequency.
   * Returns `minInterval` during bursts and `maxInterval` when idle.
   */
  nextDelay(): number {
    if (this.recentEventCounts.length === 0) {
      return this.maxInterval;
    }

    const total = this.recentEventCounts.reduce((sum, n) => sum + n, 0);
    const average = total / this.recentEventCounts.length;

    // Normalize activity into [0, 1]; 1+ events per poll is a full burst.
    const activity = Math.min(1, average);

    const delay = this.maxInterval - activity * (this.maxInterval - this.minInterval);

    return Math.round(delay);
  }

  /** Reset tracked activity (e.g. after a visibility pause). */
  reset(): void {
    this.recentEventCounts.length = 0;
  }
}
