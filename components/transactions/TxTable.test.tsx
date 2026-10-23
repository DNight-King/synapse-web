import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TxTable } from "./TxTable";
import { ToastProvider } from "@/components/ui/Toast";
import type { Transaction } from "@/lib/types";

const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    asset: "USDC",
    amount: 100.5,
    from: "GBZXN7PIRZGNMHGA728RGRYA72R6UGRM6X8J73V2S8L7D2Z5V5P8K3M4",
    to: "GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G6EXO2Z6K3M4GBZXN7P",
    status: "COMPLETED",
    retries: 0,
    timestamp: Date.now() - 5000,
    created_at: Date.now() - 5000,
    memo: "test memo",
    callback_url: "https://example.com/cb",
  },
  {
    id: "tx-2",
    asset: "USDC",
    amount: 50.0,
    from: "GBZXN7PIRZGNMHGA728RGRYA72R6UGRM6X8J73V2S8L7D2Z5V5P8K3M4",
    to: "GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G6EXO2Z6K3M4GBZXN7P",
    status: "PENDING",
    retries: 1,
    timestamp: Date.now() - 10000,
    created_at: Date.now() - 10000,
    memo: "transfer",
    callback_url: "https://example.com/cb",
  },
];

describe("TxTable Performance & Render Suite", () => {
  it("renders transaction rows without crashing", () => {
    const onSelect = vi.fn();
    render(
      <ToastProvider>
        <TxTable txs={mockTransactions} onSelect={onSelect} />
      </ToastProvider>
    );

    // Each row renders in both the table and the stacked card layout.
    expect(screen.getAllByText("100.50").length).toBeGreaterThan(0);
    expect(screen.getAllByText("50.00").length).toBeGreaterThan(0);
  });

  it("calls onSelect when row is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ToastProvider>
        <TxTable txs={mockTransactions} onSelect={onSelect} />
      </ToastProvider>
    );

    const row = screen
      .getAllByText("100.50")
      .map((el) => el.closest("tr"))
      .find((tr) => tr !== null);
    if (row) fireEvent.click(row);

    expect(onSelect).toHaveBeenCalledWith(mockTransactions[0]);
  });
});
