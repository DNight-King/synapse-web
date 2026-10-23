/** One entry in a transaction's status history, as shown on a printed receipt. */
export interface TransactionStatusEntry {
  status: string;
  timestamp?: string | number | null;
  detail?: string | null;
}

/**
 * On-chain view of a transaction used by the printable receipt. Distinct from
 * the ledger-row `Transaction` in `@/lib/types`, which models the contract's
 * stored struct.
 */
export interface Transaction {
  hash: string;
  status: string;
  ledger?: number | string | null;
  sourceAccount?: string | null;
  destination?: string | null;
  amount?: string | number | null;
  asset?: string | null;
  fee?: string | number | null;
  memo?: string | null;
  callbackUrl?: string | null;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
  statusHistory?: TransactionStatusEntry[];
}
