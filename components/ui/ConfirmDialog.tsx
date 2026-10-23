"use client";
import { useState, useRef } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BG2, BG3, BORDER, DIM, MONO, STATUS_META } from "@/lib/constants";
import { ActionButton } from "./ActionButton";
import { useFocusTrap } from "./useFocusTrap";

interface ConfirmDialogProps {
  /** Dialog heading */
  title: string;
  /** Descriptive body text shown under the title */
  message: string;
  /** If provided, user must retype this exact value before confirming */
  retypeValue?: string;
  /** Placeholder shown in the retype input */
  retypePlaceholder?: string;
  /** Color used for the confirm button and accent strip */
  accentColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  retypeValue,
  retypePlaceholder,
  accentColor = STATUS_META.FAILED.color,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const needsRetype = Boolean(retypeValue);
  const canConfirm = needsRetype ? typed === retypeValue : true;

  // Utilize the shared useFocusTrap hook
  useFocusTrap(dialogRef, {
    onEscape: onCancel,
    initialFocusRef: needsRetype ? inputRef : undefined,
  });

  const mono: CSSProperties = {
    fontFamily: MONO,
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(2px)",
          zIndex: 1000,
        }}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        tabIndex={-1}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
          width: "min(480px, calc(100vw - 32px))",
          background: BG2,
          border: `1px solid ${accentColor}55`,
          outline: "none",
          ...mono,
        }}
      >
        {/* Accent strip */}
        <div style={{ height: 2, background: accentColor, opacity: 0.85 }} />

        <div style={{ padding: "20px 22px 22px" }}>
          {/* Title */}
          <h2
            id="confirm-dialog-title"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: accentColor,
              margin: "0 0 10px 0",
            }}
          >
            ⚠ {title}
          </h2>

          {/* Message */}
          <p
            id="confirm-dialog-desc"
            style={{
              fontSize: 12,
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.75)",
              margin: "0 0 18px",
              ...mono,
            }}
          >
            {message}
          </p>

          {/* Retype confirmation input */}
          {needsRetype && (
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="confirm-retype-input"
                style={{
                  display: "block",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  color: DIM,
                  marginBottom: 6,
                }}
              >
                TYPE THE ADDRESS BELOW TO CONFIRM
              </label>
              <input
                id="confirm-retype-input"
                ref={inputRef}
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={retypePlaceholder ?? retypeValue}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={typed.length > 0 && typed !== retypeValue}
                aria-describedby={
                  typed.length > 0 && typed !== retypeValue ? "retype-error-msg" : undefined
                }
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "9px 12px",
                  background: BG3,
                  border: `1px solid ${typed === retypeValue ? accentColor + "99" : BORDER}`,
                  color: typed === retypeValue ? accentColor : "rgba(255,255,255,0.9)",
                  fontSize: 11,
                  outline: "none",
                  transition: "border-color 0.15s, color 0.15s",
                  ...mono,
                }}
              />
              {typed.length > 0 && typed !== retypeValue && (
                <div
                  id="retype-error-msg"
                  role="alert"
                  style={{
                    fontSize: 10,
                    color: STATUS_META.FAILED.color,
                    marginTop: 5,
                    letterSpacing: "0.04em",
                  }}
                >
                  address mismatch
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <ActionButton label="CANCEL" color="#aaa" onClick={onCancel} />
            <ActionButton
              label="CONFIRM →"
              color={canConfirm ? accentColor : "#666"}
              disabled={!canConfirm}
              onClick={() => {
                if (canConfirm) onConfirm();
              }}
            />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
