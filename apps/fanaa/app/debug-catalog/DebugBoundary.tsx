"use client";

import { Component, type ReactNode } from "react";

/**
 * Minimal error boundary for the runtime-investigation page.
 *
 * Why this exists: a server component's try/catch CANNOT catch an
 * error thrown while React renders a *child* client component — that
 * throw happens later, during the render pass, and bubbles to the
 * nearest error boundary (or, if none, becomes a digest-only 500).
 *
 * This boundary captures the real Error during SSR via
 * `getDerivedStateFromError` and renders its `.message` + `.stack`
 * inline, so we see exactly what `<ProductGallery>` / `<ProductCard>`
 * threw instead of an opaque digest.
 */
type Props = { label: string; children: ReactNode };
type State = { message: string | null; stack: string | null };

export class DebugBoundary extends Component<Props, State> {
  state: State = { message: null, stack: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? null) : null,
    };
  }

  render() {
    if (this.state.message !== null) {
      return (
        <div
          style={{
            border: "2px solid #c0392b",
            background: "#fff5f5",
            borderRadius: 8,
            padding: 12,
            fontFamily: "monospace",
            fontSize: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          <strong style={{ color: "#c0392b" }}>
            THREW while rendering: {this.props.label}
          </strong>
          {"\n\nmessage: "}
          {this.state.message}
          {"\n\nstack:\n"}
          {this.state.stack ?? "(no stack)"}
        </div>
      );
    }
    return this.props.children;
  }
}
