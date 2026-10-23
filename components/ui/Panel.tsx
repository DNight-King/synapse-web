"use client";
import { BG2, BORDER, DIM, MONO } from "@/lib/constants";
import type { CSSProperties, ReactNode } from "react";

interface PanelProps {
  title?: string;
  children: ReactNode;
  style?: CSSProperties;
  accentColor?: string;
}

export function Panel({ title, children, style, accentColor }: PanelProps) {
  return (
    <div
      style={{
        background: BG2,
        border: `1px solid ${BORDER}`,
        padding: "16px 18px",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {accentColor && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: accentColor,
            opacity: 0.75,
          }}
        />
      )}
      {title && (
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            color: DIM,
            fontFamily: MONO,
            marginBottom: 12,
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
