// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TxCompareView, diffFields } from "./TxCompareView";
import { AMBER } from "@/lib/constants";

// TxTimeline is covered separately; stub it so these tests only exercise the
// compare view's own layout and interactions.
vi.mock("./TxTimeline", () => ({
  TxTimeline: () => <div data-testid="tx-timeline" />,
}));

type Tx = React.ComponentProps<typeof TxCompareView>["txs"][number];

function makeTx(overrides: Record<string, unknown> = {}): Tx {
  return {
    id: "tx-a",
    status: "PENDING",
    asset: "USDC",
    amount: 5,
    memo: "ref-001",
    callback_url: "https://api.example.com/cb/001",
    ...overrides,
  } as unknown as Tx;
}

const FIELD_LABELS = ["tx_id", "status", "asset", "amount", "memo", "callback_url"];

function renderView(txs: Tx[], onClose = vi.fn()) {
  const utils = render(<TxCompareView txs={txs} onClose={onClose} />);
  return { ...utils, onClose };
}

/** All value cells rendered for a given field label, in column order. */
function rowCells(label: string): HTMLElement[] {
  const labelCell = screen.getByText(label);
  const row = labelCell.parentElement as HTMLElement;
  return Array.from(row.children).slice(1) as HTMLElement[];
}

describe("TxCompareView rendering", () => {
  it("shows a header with the number of compared transactions", () => {
    renderView([makeTx({ id: "tx-a" }), makeTx({ id: "tx-b" }), makeTx({ id: "tx-c" })]);
    expect(screen.getByText("COMPARE 3 TRANSACTIONS")).toBeInTheDocument();
  });

  it("renders one column per transaction and one row per compared field", () => {
    renderView([makeTx({ id: "tx-a" }), makeTx({ id: "tx-b" })]);

    expect(screen.getByText("FIELD")).toBeInTheDocument();
    for (const label of FIELD_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(rowCells(label)).toHaveLength(2);
    }
    expect(rowCells("tx_id").map((c) => c.textContent)).toEqual(["tx-a", "tx-b"]);
  });

  it("renders missing, null and empty values as an em dash", () => {
    renderView([
      makeTx({ id: "tx-a", memo: undefined, callback_url: null }),
      makeTx({ id: "tx-b", memo: "", callback_url: "https://x.test/cb" }),
    ]);

    expect(rowCells("memo").map((c) => c.textContent)).toEqual(["—", "—"]);
    expect(rowCells("callback_url").map((c) => c.textContent)).toEqual(["—", "https://x.test/cb"]);
  });

  it("highlights rows whose values differ and leaves matching rows plain", () => {
    renderView([
      makeTx({ id: "tx-a", amount: 5, status: "PENDING" }),
      makeTx({ id: "tx-b", amount: 12, status: "PENDING" }),
    ]);

    for (const cell of rowCells("amount")) {
      expect(cell).toHaveStyle({ color: AMBER });
    }
    for (const cell of rowCells("status")) {
      expect(cell).toHaveStyle({ color: "#ddd" });
    }
  });

  it("does not highlight anything when only one transaction is shown", () => {
    renderView([makeTx({ id: "solo" })]);

    expect(screen.getByText("COMPARE 1 TRANSACTIONS")).toBeInTheDocument();
    for (const label of FIELD_LABELS) {
      for (const cell of rowCells(label)) {
        expect(cell).toHaveStyle({ color: "#ddd" });
      }
    }
  });

  it("renders a timeline panel for each transaction", () => {
    renderView([makeTx({ id: "tx-a" }), makeTx({ id: "tx-b" })]);

    expect(screen.getAllByTestId("tx-timeline")).toHaveLength(2);
    expect(screen.getByText("TIMELINE · tx-a")).toBeInTheDocument();
    expect(screen.getByText("TIMELINE · tx-b")).toBeInTheDocument();
  });

  it("renders chain-supplied values as inert text", () => {
    const payload = "<img src=x onerror=alert(1)>";
    renderView([makeTx({ id: "tx-a", memo: payload }), makeTx({ id: "tx-b" })]);

    expect(screen.getByText(payload)).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("TxCompareView interactions", () => {
  it("calls onClose when the CLOSE button is clicked", async () => {
    const { onClose } = renderView([makeTx({ id: "tx-a" }), makeTx({ id: "tx-b" })]);

    await userEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const { container, onClose } = renderView([makeTx({ id: "tx-a" }), makeTx({ id: "tx-b" })]);

    await userEvent.click(container.firstChild as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the dialog content", async () => {
    const { onClose } = renderView([makeTx({ id: "tx-a" }), makeTx({ id: "tx-b" })]);

    await userEvent.click(screen.getByText("COMPARE 2 TRANSACTIONS"));
    await userEvent.click(rowCells("amount")[0]!);
    await userEvent.click(
      within(screen.getByText("TIMELINE · tx-a").parentElement!).getByTestId("tx-timeline")
    );

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("diffFields", () => {
  it("returns an empty set for an empty list", () => {
    expect(diffFields([]).size).toBe(0);
  });

  it("returns an empty set for a single transaction", () => {
    expect(diffFields([makeTx({ id: "solo", amount: 99 })]).size).toBe(0);
  });

  it("reports only the id when transactions are otherwise identical", () => {
    const result = diffFields([makeTx({ id: "tx-a" }), makeTx({ id: "tx-b" })]);
    expect([...result]).toEqual(["id"]);
  });

  it("reports every compared field that differs", () => {
    const result = diffFields([
      makeTx({ id: "tx-a", status: "PENDING", amount: 5, memo: "a" }),
      makeTx({ id: "tx-b", status: "FAILED", amount: 5, memo: "b" }),
    ]);
    expect(result).toEqual(new Set(["id", "status", "memo"]));
  });

  it("flags a field when any transaction differs from the first, not only adjacent ones", () => {
    const result = diffFields([
      makeTx({ id: "tx-a", asset: "USDC" }),
      makeTx({ id: "tx-b", asset: "USDC" }),
      makeTx({ id: "tx-c", asset: "XLM" }),
    ]);
    expect(result.has("asset")).toBe(true);
  });

  it("treats undefined, null and empty string as the same missing value", () => {
    const result = diffFields([
      makeTx({ id: "tx-a", memo: undefined }),
      makeTx({ id: "tx-b", memo: null }),
      makeTx({ id: "tx-c", memo: "" }),
    ]);
    expect(result.has("memo")).toBe(false);
  });

  it("flags a field that is present on some transactions and missing on others", () => {
    const result = diffFields([
      makeTx({ id: "tx-a", callback_url: "https://x.test/cb" }),
      makeTx({ id: "tx-b", callback_url: undefined }),
    ]);
    expect(result.has("callback_url")).toBe(true);
  });

  it("compares values by their string form", () => {
    const result = diffFields([
      makeTx({ id: "tx-a", amount: 5 }),
      makeTx({ id: "tx-b", amount: "5" }),
    ]);
    expect(result.has("amount")).toBe(false);
  });

  it("ignores fields that are not part of the comparison", () => {
    const result = diffFields([
      makeTx({ id: "tx-a", from: "GADDR1", retries: 0 }),
      makeTx({ id: "tx-b", from: "GADDR2", retries: 3 }),
    ]);
    expect(result).toEqual(new Set(["id"]));
  });
});
