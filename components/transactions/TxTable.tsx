"use client";
import { memo, useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { AMBER, BG3, BORDER, DIM, MONO } from "@/lib/constants";
import { shortId, elapsed, formatAmount } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

const PAGE_SIZE = 15;

interface TxTableProps {
  txs: Transaction[];
  onSelect: (tx: Transaction) => void;
}

const HEADERS = ["TX ID", "ASSET", "AMOUNT", "FROM", "TO", "STATUS", "RETRIES", "AGE"];
const ROW_STYLE: CSSProperties = {
  cursor: "pointer",
  borderBottom: `1px solid ${BORDER}`,
  transition: "background 0.15s",
};
const CELL_STYLE: CSSProperties = { padding: "9px 8px" };
const FLEX_CELL_STYLE: CSSProperties = { display: "flex", alignItems: "center" };
const ID_STYLE: CSSProperties = {
  fontSize: 10,
  color: AMBER,
  fontFamily: MONO,
};
const COPY_BUTTON_STYLE: CSSProperties = { marginLeft: 4 };
const ASSET_STYLE: CSSProperties = {
  ...CELL_STYLE,
  fontSize: 10,
  color: "#ccc",
  fontFamily: MONO,
};
const AMOUNT_STYLE: CSSProperties = { ...ASSET_STYLE, color: "#fff" };
const ADDRESS_STYLE: CSSProperties = { ...ID_STYLE, color: DIM };
const RETRIES_STYLE: CSSProperties = { ...ASSET_STYLE, color: DIM, textAlign: "center" };
const AGE_STYLE: CSSProperties = { ...ASSET_STYLE, color: DIM };

interface TxRowProps {
  tx: Transaction;
  onSelect: (tx: Transaction) => void;
}

function hasSameRenderedData(previous: TxRowProps, next: TxRowProps) {
  const previousTx = previous.tx;
  const nextTx = next.tx;

  return (
    previous.onSelect === next.onSelect &&
    previousTx.id === nextTx.id &&
    previousTx.asset === nextTx.asset &&
    previousTx.amount === nextTx.amount &&
    previousTx.from === nextTx.from &&
    previousTx.to === nextTx.to &&
    previousTx.status === nextTx.status &&
    previousTx.retries === nextTx.retries &&
    previousTx.timestamp === nextTx.timestamp
  );
}

const TxRow = memo(function TxRow({ tx, onSelect }: TxRowProps) {
  return (
    <tr
      onClick={() => onSelect(tx)}
      style={ROW_STYLE}
      onMouseEnter={(event) => (event.currentTarget.style.background = BG3)}
      onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
    >
      <td style={CELL_STYLE}>
        <div style={FLEX_CELL_STYLE}>
          <span style={ID_STYLE}>{shortId(tx.id)}</span>
          <CopyButton value={tx.id} label="Tx ID" style={COPY_BUTTON_STYLE} />
        </div>
      </td>
      <td style={ASSET_STYLE}>{tx.asset}</td>
      <td style={AMOUNT_STYLE}>{formatAmount(tx.amount)}</td>
      <td style={CELL_STYLE}>
        <div style={FLEX_CELL_STYLE}>
          <span style={ADDRESS_STYLE}>{tx.from.slice(0, 10)}…</span>
          <CopyButton value={tx.from} label="From address" style={COPY_BUTTON_STYLE} />
        </div>
      </td>
      <td style={CELL_STYLE}>
        <div style={FLEX_CELL_STYLE}>
          <span style={ADDRESS_STYLE}>{tx.to.slice(0, 10)}…</span>
          <CopyButton value={tx.to} label="To address" style={COPY_BUTTON_STYLE} />
        </div>
      </td>
      <td style={CELL_STYLE}>
        <Badge status={tx.status} />
      </td>
      <td style={RETRIES_STYLE}>{tx.retries}</td>
      <td style={AGE_STYLE} suppressHydrationWarning>
        {elapsed(tx.timestamp)}
      </td>
    </tr>
  );
}, hasSameRenderedData);

const CARD_STYLE: CSSProperties = {
  border: `1px solid ${BORDER}`,
  padding: "10px 12px",
  marginBottom: 8,
  cursor: "pointer",
  transition: "background 0.15s",
};
const CARD_ROW_STYLE: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
};
const CARD_LABEL_STYLE: CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.1em",
  color: DIM,
  fontFamily: MONO,
  flexShrink: 0,
};
const CARD_VALUE_STYLE: CSSProperties = {
  fontSize: 10,
  color: "#ccc",
  fontFamily: MONO,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  textAlign: "right",
  minWidth: 0,
};

const TxCard = memo(function TxCard({ tx, onSelect }: TxRowProps) {
  return (
    <div
      onClick={() => onSelect(tx)}
      style={CARD_STYLE}
      onMouseEnter={(event) => (event.currentTarget.style.background = BG3)}
      onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
    >
      <div style={CARD_ROW_STYLE}>
        <span style={CARD_LABEL_STYLE}>TX ID</span>
        <span style={CARD_VALUE_STYLE}>
          <span style={ID_STYLE}>{shortId(tx.id)}</span>
          <CopyButton value={tx.id} label="Tx ID" style={COPY_BUTTON_STYLE} />
        </span>
      </div>
      <div style={CARD_ROW_STYLE}>
        <span style={CARD_LABEL_STYLE}>ASSET</span>
        <span style={CARD_VALUE_STYLE}>{tx.asset}</span>
      </div>
      <div style={CARD_ROW_STYLE}>
        <span style={CARD_LABEL_STYLE}>AMOUNT</span>
        <span style={{ ...CARD_VALUE_STYLE, color: "#fff" }}>{formatAmount(tx.amount)}</span>
      </div>
      <div style={CARD_ROW_STYLE}>
        <span style={CARD_LABEL_STYLE}>FROM</span>
        <span style={CARD_VALUE_STYLE}>
          <span style={ADDRESS_STYLE}>{tx.from.slice(0, 10)}…</span>
          <CopyButton value={tx.from} label="From address" style={COPY_BUTTON_STYLE} />
        </span>
      </div>
      <div style={CARD_ROW_STYLE}>
        <span style={CARD_LABEL_STYLE}>TO</span>
        <span style={CARD_VALUE_STYLE}>
          <span style={ADDRESS_STYLE}>{tx.to.slice(0, 10)}…</span>
          <CopyButton value={tx.to} label="To address" style={COPY_BUTTON_STYLE} />
        </span>
      </div>
      <div style={CARD_ROW_STYLE}>
        <span style={CARD_LABEL_STYLE}>STATUS</span>
        <span style={CARD_VALUE_STYLE}>
          <Badge status={tx.status} />
        </span>
      </div>
      <div style={CARD_ROW_STYLE}>
        <span style={CARD_LABEL_STYLE}>RETRIES</span>
        <span style={CARD_VALUE_STYLE}>{tx.retries}</span>
      </div>
      <div style={{ ...CARD_ROW_STYLE, marginBottom: 0 }}>
        <span style={CARD_LABEL_STYLE}>AGE</span>
        <span style={CARD_VALUE_STYLE} suppressHydrationWarning>
          {elapsed(tx.timestamp)}
        </span>
      </div>
    </div>
  );
}, hasSameRenderedData);

export function TxTable({ txs, onSelect }: TxTableProps) {
  const [page, setPage] = useState(1);
  const [knownLength, setKnownLength] = useState(txs.length);
  if (txs.length !== knownLength) {
    setKnownLength(txs.length);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(txs.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageTxs = txs.slice(start, start + PAGE_SIZE);

  return (
    <div>
      {/* Mobile-first: below the md breakpoint (768px) the dense grid degrades to
          stacked cards so every column stays reachable without horizontal scroll. */}
      <div className="md:hidden">
        {pageTxs.map((tx) => (
          <TxCard key={tx.id} tx={tx} onSelect={onSelect} />
        ))}
        {txs.length === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: DIM,
              fontFamily: MONO,
              fontSize: 11,
            }}
          >
            no transactions match filter
          </div>
        )}
      </div>

      {/* md and up: full tabular grid. */}
      <div className="hidden md:block" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              {HEADERS.map((header) => (
                <th
                  key={header}
                  style={{
                    padding: "4px 8px 10px",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: DIM,
                    fontFamily: MONO,
                    textAlign: "left",
                    borderBottom: `1px solid ${BORDER}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageTxs.map((tx) => (
              <TxRow key={tx.id} tx={tx} onSelect={onSelect} />
            ))}
            {txs.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: DIM,
                    fontFamily: MONO,
                    fontSize: 11,
                  }}
                >
                  no transactions match filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {txs.length > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: "6px 14px",
              background: "transparent",
              border: `1px solid ${BORDER}`,
              color: page === 1 ? DIM : "#ccc",
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.5 : 1,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.06em",
            }}
          >
            ← PREV
          </button>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: DIM,
              letterSpacing: "0.06em",
            }}
          >
            page {page} of {totalPages} · {txs.length} total
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: "6px 14px",
              background: "transparent",
              border: `1px solid ${BORDER}`,
              color: page === totalPages ? DIM : "#ccc",
              cursor: page === totalPages ? "not-allowed" : "pointer",
              opacity: page === totalPages ? 0.5 : 1,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.06em",
            }}
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}
