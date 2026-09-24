"use client";

import {
  Activity,
  Boxes,
  Cloud,
  Database,
  HardDrive,
  Layers3,
  RefreshCw,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useServer } from "@/src/lib/api/server-context";
import { useSelectedServer } from "@/src/lib/session";

function formatUptime(seconds: number) {
  if (!seconds) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function statusCopy(status: string | undefined, error: string | null, name: string) {
  if (status === "online") return "Connected over SSH. Live telemetry is available.";
  if (status === "connecting") return `Connecting to ${name}…`;
  if (status === "authentication_failed") return "Authentication failed. Edit the node and retry.";
  return error || "Metrics are unavailable until a Porter node is connected.";
}

export function DashboardApp() {
  const selected = useSelectedServer();
  const { server, loading, error, refresh, lastUpdatedAt } = useServer();
  const online = server?.status === "online";
  const name = selected?.name || server?.name || "Porter workspace";
  const host = selected?.address || server?.host;
  const hostname = selected?.hostname || server?.hostname;
  const username = selected?.username || server?.username;
  const lastUpdated = lastUpdatedAt
    ? formatClock(lastUpdatedAt)
    : server?.lastSeen
      ? formatLastSeen(server.lastSeen)
      : null;

  return (
    <div className="sui-app h-full overflow-auto px-7 py-7 sm:px-9 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <p className="sui-eyebrow">Porter control plane</p>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <h3 className="sui-title text-[27px] font-semibold tracking-[-0.035em]">Overview</h3>
              <span className={`size-2 rounded-full ${online ? "bg-emerald-500" : loading ? "bg-amber-400" : "bg-red-500"}`} aria-hidden />
              <span className="text-sm sui-muted">{online ? "Healthy node connection" : loading && !server ? "Connecting" : "Needs attention"}</span>
            </div>
            <p className="mt-2 max-w-xl text-[13px] leading-5 sui-muted">{statusCopy(server?.status, error, name)}</p>
            {username && host ? <p className="mt-1 text-xs sui-muted">{username}@{host}{hostname ? ` · ${hostname}` : ""}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="sui-button-secondary ml-auto inline-flex items-center gap-2 text-[12px]"
            disabled={loading}
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>

        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Live node metrics">
          <MetricCard icon={Activity} label="CPU" value={online ? `${Math.round(server?.cpuUsage || 0)}%` : "—"} tone="blue" loading={loading && !server} />
          <MetricCard icon={Layers3} label="Memory" value={online ? `${Math.round(server?.memoryUsage || 0)}%` : "—"} tone="purple" loading={loading && !server} />
          <MetricCard icon={HardDrive} label="Disk" value={online ? `${Math.round(server?.diskUsage || 0)}%` : "—"} tone="orange" loading={loading && !server} />
          <MetricCard icon={ShieldCheck} label="Uptime" value={online ? formatUptime(server?.uptimeSeconds || 0) : "—"} tone="green" loading={loading && !server} />
        </section>

        <section className="mt-8" aria-labelledby="resource-summary">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="sui-eyebrow">Resource model</p>
              <h4 id="resource-summary" className="mt-1 text-base font-semibold sui-title">Your infrastructure at a glance</h4>
            </div>
            <span className="text-xs sui-muted">API-backed summary</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ResourceCard icon={Cloud} title="Projects" description="Services, environments, and deployments" />
            <ResourceCard icon={Boxes} title="Deployments" description="Build, rollout, and health state" />
            <ResourceCard icon={Server} title="MicroVMs" description="Firecracker replicas and lifecycle" />
            <ResourceCard icon={Database} title="Volumes" description="Persistent block and backup storage" />
            <ResourceCard icon={Workflow} title="Operations" description="Tasks, events, alerts, and audit" />
            <ResourceCard icon={ShieldCheck} title="Security" description="Identity, capabilities, and policy" />
          </div>
        </section>

        <section className="mt-8 grid gap-3 lg:grid-cols-[1.35fr_1fr]" aria-label="Porter status">
          <div className="sui-card rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-[var(--accent)]" aria-hidden />
              <h4 className="font-semibold sui-title">Control-plane status</h4>
            </div>
            <div className="mt-4 space-y-3 text-[12px]">
              <StatusRow label="Node connection" value={online ? "Ready" : loading ? "Connecting" : "Offline"} tone={online ? "success" : loading ? "warning" : "danger"} />
              <StatusRow label="Desired / observed state" value="Available when project API is connected" tone="muted" />
              <StatusRow label="Last telemetry" value={lastUpdated ? lastUpdated : "Not available"} tone="muted" />
            </div>
          </div>
          <div className="sui-card rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Workflow className="size-4 text-[var(--accent)]" aria-hidden />
              <h4 className="font-semibold sui-title">Next steps</h4>
            </div>
            <p className="mt-3 text-[12px] leading-5 sui-muted">Connect the documented Porter project and deployment routes to populate workloads, builds, environments, and event timelines here.</p>
            <p className="mt-3 text-[11px] leading-5 sui-muted">No fake operational state is shown while those APIs are unavailable.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone, loading }: { icon: typeof Activity; label: string; value: string; tone: string; loading: boolean }) {
  const toneClass = tone === "purple" ? "text-purple-500 bg-purple-500" : tone === "orange" ? "text-orange-500 bg-orange-500" : tone === "green" ? "text-emerald-500 bg-emerald-500" : "text-blue-500 bg-blue-500";
  return (
    <div className="sui-card rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="sui-eyebrow">{label}</p>
        <Icon className={`size-4 ${toneClass.split(" ")[0]}`} aria-hidden />
      </div>
      <p className="mt-3 text-[24px] font-semibold tracking-[-0.03em] tabular-nums sui-title">{loading ? "…" : value}</p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className={`h-full rounded-full ${toneClass.split(" ")[1]}`} style={{ width: loading || value === "—" ? "0%" : value.includes("%") ? value : "100%" }} /></div>
    </div>
  );
}

function ResourceCard({ icon: Icon, title, description }: { icon: typeof Cloud; title: string; description: string }) {
  return (
    <div className="sui-card rounded-2xl p-4 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--app-selected)] text-[var(--accent)]"><Icon className="size-4" aria-hidden /></span>
        <div className="min-w-0"><h5 className="font-semibold sui-title">{title}</h5><p className="mt-1 text-[12px] leading-5 sui-muted">{description}</p></div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "danger" | "muted" }) {
  return <div className="flex items-center justify-between gap-4 border-t border-[var(--separator)] pt-3 first:border-t-0 first:pt-0"><span className="sui-muted">{label}</span><span className={tone === "muted" ? "sui-muted" : `status-${tone}`}>{value}</span></div>;
}

function formatLastSeen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatClock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
