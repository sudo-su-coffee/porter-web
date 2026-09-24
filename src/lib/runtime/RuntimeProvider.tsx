"use client";

import { useEffect, useState, type ReactNode } from "react";
import { bootstrapRuntime, watchDesktopBackend } from "@/src/lib/runtime/bootstrap";
import type { DesktopRuntimeConfig } from "@/src/lib/runtime/config";

type GateState =
  | { phase: "checking" }
  | { phase: "web" }
  | { phase: "desktop-starting" }
  | { phase: "desktop-ready" }
  | { phase: "desktop-failed"; message: string };

function statusMessage(config: DesktopRuntimeConfig | undefined) {
  if (!config) return "Starting Porter backend...";
  if (config.status === "failed") {
    return config.error?.trim() || "Porter backend failed to start.";
  }
  if (config.status === "stopped") {
    return config.error?.trim() || "Porter backend stopped unexpectedly.";
  }
  return "Starting Porter backend...";
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ phase: "checking" });
  const isBrowser = typeof window !== "undefined" && !("isTauri" in window);

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    void bootstrapRuntime()
      .then((result) => {
        if (cancelled) return;
        if (result.kind === "web") {
          setState({ phase: "web" });
          return;
        }
        if (result.config.status === "ready") {
          setState({ phase: "desktop-ready" });
          void watchDesktopBackend((message) => {
            if (cancelled) return;
            setState({ phase: "desktop-failed", message });
          }, abort.signal);
          return;
        }
        setState({
          phase: "desktop-failed",
          message: statusMessage(result.config),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const detail =
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : "Unable to reach the ServerUI desktop shell.";
        setState({
          phase: "desktop-failed",
          message: detail,
        });
      });
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, []);

  if (typeof window === "undefined" || isBrowser) return <>{children}</>;

  if (state.phase === "checking" || state.phase === "desktop-starting") {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background text-foreground">
        <p className="text-sm opacity-80">Starting Porter backend...</p>
      </div>
    );
  }

  if (state.phase === "desktop-failed") {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-2 bg-background px-6 text-center text-foreground">
        <p className="text-base font-medium">Unable to connect to local Porter backend.</p>
        <p className="max-w-lg whitespace-pre-wrap text-sm opacity-80">{state.message}</p>
      </div>
    );
  }

  return <>{children}</>;
}
