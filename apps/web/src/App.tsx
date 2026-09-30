import { Component, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Command,
  Home,
  Layers3,
  Megaphone,
  Plug,
  Plus,
  Radio,
  Send,
  Settings,
  Sparkles,
  Heart,
  MessageCircle,
  Bookmark,
  BarChart3,
  PenTool,
  Eye,
  BrainCircuit,
  Instagram,
  Youtube,
  Play
} from "lucide-react";
import { api } from "./api";

type Campaign = {
  id: string;
  title: string;
  source: string;
  status: string;
  contentVersion?: number;
  approvedVersion?: number | null;
  createdAt: string;
  updatedAt?: string;
  publications: Array<{
    id: string;
    platform: string;
    status: string;
    externalId?: string | null;
    externalUrl?: string | null;
    httpStatus?: number | null;
    latencyMs?: number | null;
    attemptCount?: number | null;
    retryAfterMs?: number | null;
    lastAttemptAt?: string | null;
    createdAt: string;
    updatedAt?: string;
  }>;
};

type Connection = {
  platform: string;
  label: string;
  connected: boolean;
  mode: string;
};

type PlatformKey = "discord" | "mastodon";

const PLATFORM_KEYS: readonly PlatformKey[] = [
  "discord",
  "mastodon"
];

function platformLabel(platform: PlatformKey) {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

type ApiHealth = {
  ok: boolean;
  service: string;
};

type ConstraintProfile = {
  platform: string;
  maxLength: number;
  maxHashtags: number;
  tone: string;
  toneRules?: string[];
};

type ModuleState = "checking" | "online" | "offline";

type ConnectionsResponse = Connection[] | { connections?: Connection[]; data?: unknown };

function normalizeCollection<T>(value: unknown, preferredKeys: readonly string[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const keys = [...preferredKeys, "items", "data", "results"];

  for (const key of keys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate as T[];
    if (candidate && typeof candidate === "object") {
      const nested = normalizeCollection<T>(candidate, preferredKeys);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function normalizeConnections(data: ConnectionsResponse | unknown): Connection[] {
  return normalizeCollection<Connection>(data, ["connections"]);
}

type ActivityEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  campaign?: { title: string } | null;
};


type AiAnalysis = {
  summary: string;
  readiness: "READY" | "NEEDS_REVIEW" | "BLOCKED";
  risks: Array<{
    severity: "LOW" | "MEDIUM" | "HIGH";
    area: string;
    message: string;
  }>;
  platforms: {
    discord: {
      assessment: string;
      suggestedCopy: string;
      reasons: string[];
    };
    mastodon: {
      assessment: string;
      suggestedCopy: string;
      reasons: string[];
    };
  };
  nextActions: string[];
};

type AiInsight = {
  id: string;
  campaignId: string;
  version: number;
  provider: string;
  model: string;
  latencyMs?: number;
  createdAt: string;
  analysis: AiAnalysis;
};

type ReviewQueueItem = {
  id: string;
  title: string;
  status: string;
  contentVersion: number;
  approvedVersion?: number | null;
  updatedAt: string;
  unresolvedCurrentVersion: number;
  currentVersionComments: ReviewComment[];
  approvalVersionMatches: boolean;
  readyForApproval: boolean;
  readyForPublish: boolean;
};

type ReviewComment = {
  id: string;
  campaignId: string;
  version: number;
  author: string;
  message: string;
  resolved: boolean;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type CampaignRevision = {
  id: string;
  campaignId: string;
  version: number;
  discordContent: string;
  mastodonContent: string;
  reason: string;
  createdAt: string;
};

type CampaignVariant = {
  id: string;
  campaignId: string;
  platform: PlatformKey;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type PreflightResponse = {
  campaignId: string;
  campaignStatus: string;
  contentVersion: number;
  approvedVersion?: number | null;
  unresolvedReviewNotes: number;
  approvalReady: boolean;
  ready: boolean;
  checks: Array<{
    platform: PlatformKey;
    connected: boolean;
    contentValid: boolean;
    length: number;
    maxLength: number;
    ready: boolean;
    message: string;
  }>;
};

type MultiPublishResponse = {
  campaignId: string;
  allSucceeded: boolean;
  results: Array<{
    platform: PlatformKey;
    ok: boolean;
    publication?: {
      id: string;
      status: string;
      httpStatus?: number | null;
      latencyMs?: number | null;
      externalId?: string | null;
      externalUrl?: string | null;
      attemptCount?: number | null;
      retryAfterMs?: number | null;
    };
    error?: string;
  }>;
};

type ScheduleRecord = {
  id: string;
  campaignId: string;
  platform: string;
  scheduledAt: string;
  status: string;
  executedAt?: string | null;
  publicationId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  campaign: {
    id: string;
    title: string;
  };
};

type PublicationRecord = {
  id: string;
  platform: string;
  status: string;
  externalId?: string | null;
  externalUrl?: string | null;
  idempotencyKey: string;
  httpStatus?: number | null;
  latencyMs?: number | null;
  errorMessage?: string | null;
  attemptCount?: number;
  retryAfterMs?: number | null;
  lastAttemptAt?: string | null;
  createdAt: string;
  updatedAt: string;
  campaign: {
    id: string;
    title: string;
  };
};

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid h-9 w-9 place-items-center rounded-xl border ${
          light
            ? "border-[#D8DCE4] bg-white"
            : "border-[#4E6A61] bg-[#163B34]"
        } shadow-sm`}
      >
        <div className="h-3.5 w-3.5 rounded-[4px] bg-[#D0AE68]" />
      </div>

      <div>
        <div
          className={`text-[13px] font-semibold tracking-[0.20em] ${
            light ? "text-[#17191D]" : "text-white"
          }`}
        >
          POSTURA
        </div>
        <div
          className={`mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${
            light ? "text-[#7B818D]" : "text-white/55"
          }`}
        >
          Social Media Studio
        </div>
      </div>
    </div>
  );
}

const nav = [
  ["/", "Studio", Home],
  ["/campaigns", "Campaigns", Layers3],
  ["/review", "Review Queue", ClipboardCheck],
  ["/calendar", "Calendar", CalendarDays],
  ["/publishing", "Publishing", Radio],
  ["/intelligence", "Campaign Brain", BrainCircuit],
  ["/activity", "Activity", Activity],
  ["/connections", "Connections", Plug]
] as const;

// Campaigns is intentionally excluded from the activation probes.
// Every other workspace item is checked against a real backend capability.
const MODULE_PROBES: Record<string, string> = {
  "/": "/api/health",
  "/review": "/api/review-queue",
  "/calendar": "/api/schedules",
  "/publishing": "/api/publications",
  "/intelligence": "/api/health",
  "/activity": "/api/activity",
  "/connections": "/api/connections",
  "/settings": "/api/constraint-profiles",
  "/new": "/api/health"
};

const POSTURA_BRAND_REEL = [
  { src: "/postura/founder-night.webp", label: "Founder night" },
  { src: "/postura/creative-desk.webp", label: "Creative desk" },
  { src: "/postura/strategy-session.webp", label: "Strategy session" },
  { src: "/postura/video-direction.webp", label: "Video direction" }
] as const;

function useScrollReveal() {
  useEffect(() => {
    const selectors = [
      ".studio-head",
      ".studio-flow",
      ".studio-focus",
      ".studio-intelligence",
      ".studio-evolution",
      ".studio-evidence",
      ".studio-operations",
      ".intelligence-page-head",
      ".intelligence-campaign-strip",
      ".intelligence-summary-card",
      ".intelligence-readiness-card",
      ".intelligence-platform-card",
      ".intelligence-detail-card",
      ".intelligence-history",
      ".intelligence-action-success",
      ".vision-hero-copy",
      ".vision-social-card",
      ".vision-monolith",
      ".vision-brain-card",
      ".vision-reach-card",
      ".vision-publish-card",
      ".vision-section-intro",
      ".vision-system-card",
      ".vision-live-campaign",
      ".vision-proof-card",
      ".vision-final",
      ".studio-hero-copy",
      ".studio-hero-visual",
      ".studio-section-copy",
      ".studio-floor-visual",
      ".studio-channel-card",
      ".studio-review-visual",
      ".studio-brain-copy",
      ".studio-brain-visual",
      ".studio-receipt",
      ".studio-final-statement",
      ".vision-gallery-card"
    ];

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(selectors.join(","))
    );

    elements.forEach((element, index) => {
      element.classList.add("postura-reveal");
      element.style.setProperty(
        "--postura-reveal-delay",
        `${Math.min((index % 6) * 55, 275)}ms`
      );
    });

    if (
      typeof window === "undefined" ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      elements.forEach(element => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;

          const element = entry.target as HTMLElement;
          element.classList.add("is-visible");
          observer.unobserve(element);
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.12
      }
    );

    elements.forEach(element => observer.observe(element));

    return () => observer.disconnect();
  });
}


class WorkspaceErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("POSTURA workspace route failed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="postura-route-error">
        <strong>Workspace route recovered safely.</strong>
        <span>{this.state.error.message}</span>
        <div>
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
          <button type="button" onClick={() => { window.location.href = "/"; }}>Open Studio</button>
        </div>
      </div>
    );
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  useScrollReveal();
  const navigate = useNavigate();
  const location = useLocation();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [moduleState, setModuleState] = useState<Record<string, ModuleState>>(() =>
    Object.fromEntries(Object.keys(MODULE_PROBES).map(route => [route, "checking"]))
  );

  const routeLabel =
    nav.find(([to]) =>
      to === "/" ? location.pathname === "/" : location.pathname.startsWith(to)
    )?.[1] ??
    (location.pathname.startsWith("/new")
      ? "New campaign"
      : location.pathname.startsWith("/settings")
      ? "Settings"
      : "Workspace");

  useEffect(() => {
    if (!launcherOpen) return;

    let cancelled = false;
    setModuleState(current => ({
      ...current,
      ...Object.fromEntries(Object.keys(MODULE_PROBES).map(route => [route, "checking"]))
    }));

    Promise.all(
      Object.entries(MODULE_PROBES).map(async ([route, endpoint]) => {
        try {
          await api(endpoint);
          return [route, "online"] as const;
        } catch {
          return [route, "offline"] as const;
        }
      })
    ).then(entries => {
      if (!cancelled) setModuleState(Object.fromEntries(entries));
    });

    return () => { cancelled = true; };
  }, [launcherOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setLauncherOpen(open => !open);
      }
      if (event.key === "Escape") setLauncherOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="postura-app postura-app-2026 postura-app-chromeless">
      <main className="postura-main postura-main-2026 postura-main-chromeless">
        <div className="postura-floating-chrome" aria-label="Workspace controls">
          <button
            type="button"
            className={`postura-launcher-trigger ${launcherOpen ? "is-open" : ""}`}
            onClick={() => setLauncherOpen(open => !open)}
            aria-label="Open Postura workspace switcher"
            aria-expanded={launcherOpen}
          >
            <span className="postura-launcher-mark"><i /></span>
            <span className="postura-launcher-word">POSTURA</span>
          </button>

          <div className="postura-context-crumb" aria-label="Current workspace">
            <span>{routeLabel}</span>
          </div>

          <div className="postura-floating-actions">
            <button
              type="button"
              className="postura-switcher-shortcut"
              onClick={() => setLauncherOpen(true)}
              aria-label="Open workspace switcher"
            >
              <Command size={14} strokeWidth={1.8} />
              <kbd>⌘K</kbd>
            </button>

            <button
              type="button"
              className="postura-new-floating"
              onClick={() => navigate("/new")}
            >
              <Plus size={16} />
              <span className="postura-new-label">New</span>
            </button>

            <button
              type="button"
              className="postura-profile-trigger"
              onClick={() => navigate("/settings")}
              aria-label="Open settings"
            >
              P
            </button>
          </div>
        </div>

        {launcherOpen ? (
          <div className="postura-launcher-layer" role="presentation">
            <button
              className="postura-launcher-backdrop"
              type="button"
              aria-label="Close workspace switcher"
              onClick={() => setLauncherOpen(false)}
            />

            <section className="postura-launcher-panel" aria-label="Postura workspace switcher">
              <div className="postura-launcher-panel-head">
                <div>
                  <strong>Workspace</strong>
                  <span>Jump without leaving the campaign flow.</span>
                </div>
                <kbd>⌘K</kbd>
              </div>

              <div className="postura-launcher-grid">
                {nav.map(([to, label, Icon]) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    onClick={() => setLauncherOpen(false)}
                    className={({ isActive }) =>
                      `postura-launcher-link ${isActive ? "is-active" : ""}`
                    }
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{label}</span>
                    {to !== "/campaigns" ? (
                      <span className={`postura-module-state is-${moduleState[to] ?? "checking"}`}>
                        <i />
                        {moduleState[to] === "online"
                          ? "LIVE"
                          : moduleState[to] === "offline"
                          ? "OFFLINE"
                          : "CHECK"}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>

              <div className="postura-launcher-footer">
                <NavLink to="/settings" onClick={() => setLauncherOpen(false)}>
                  <Settings size={16} strokeWidth={1.8} />
                  <span>Settings</span>
                  <span className={`postura-module-state is-${moduleState["/settings"] ?? "checking"}`}>
                    <i />{moduleState["/settings"] === "online" ? "LIVE" : moduleState["/settings"] === "offline" ? "OFFLINE" : "CHECK"}
                  </span>
                </NavLink>
                <button type="button" onClick={() => { setLauncherOpen(false); navigate("/new"); }}>
                  <Plus size={15} /> <span>New campaign</span>
                  <span className={`postura-module-state is-${moduleState["/new"] ?? "checking"}`}>
                    <i />{moduleState["/new"] === "online" ? "LIVE" : moduleState["/new"] === "offline" ? "OFFLINE" : "CHECK"}
                  </span>
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <WorkspaceErrorBoundary key={location.pathname}>
          <div className="page-enter postura-page-2026 postura-page-chromeless">{children}</div>
        </WorkspaceErrorBoundary>
      </main>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-10 border-y border-line py-20 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-line bg-white shadow-sm">
        <Megaphone size={19} />
      </div>
      <h3 className="mt-5 text-lg font-semibold">No campaigns yet.</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        Your publishing workspace starts with real activity. Create the first campaign and Postura will populate this view from the database.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white"
      >
        <Plus size={16} /> Create campaign
      </button>
    </div>
  );
}

function PosturaBrandReel() {
  const [selected, setSelected] = useState(0);
  const visual = POSTURA_BRAND_REEL[selected];

  return (
    <aside className="ps-brand-reel" aria-label="Postura studio references">
      <div className="ps-reel-head">
        <span>Studio references</span>
        <strong>{String(selected + 1).padStart(2, "0")}</strong>
      </div>

      <div className="ps-reel-focus">
        <img src={visual.src} alt={visual.label} />
        <div>
          <span>REFERENCE</span>
          <strong>{visual.label}</strong>
        </div>
      </div>

      <div className="ps-reel-thumbs">
        {POSTURA_BRAND_REEL.map((item, index) => (
          <button
            key={item.src}
            type="button"
            className={index === selected ? "is-active" : ""}
            onClick={() => setSelected(index)}
            aria-label={`Show ${item.label}`}
            title={item.label}
          >
            <img src={item.src} alt="" />
          </button>
        ))}
      </div>

      <div className="ps-reel-note">Brand reference only</div>
    </aside>
  );
}

function StudioPostPreview({
  title,
  copy,
  surface,
  version
}: {
  title: string;
  copy: string;
  surface: string;
  version?: number;
}) {
  const displayTitle = title.trim() || "Untitled campaign";
  const displayCopy = copy.trim() || "Your campaign copy will appear here as you write.";

  return (
    <article className="ps-social-card" aria-label={`${surface} social post preview`}>
      <header className="ps-social-card-head">
        <div className="ps-social-avatar">P</div>
        <div>
          <strong>{displayTitle}</strong>
          <span>{surface === "master" ? "Master post" : `${surface} variant`}</span>
        </div>
        {version ? <small>v{version}</small> : <small>DRAFT</small>}
      </header>

      {surface === "master" ? (
        <div className="ps-social-media" aria-label="Postura campaign video preview">
          <video autoPlay muted loop playsInline poster="/postura/founder-night.webp">
            <source src="/postura/postura-main.mp4" type="video/mp4" />
          </video>
        </div>
      ) : null}

      <div className="ps-social-copy">{displayCopy}</div>

      <footer className="ps-social-actions" aria-label="Social post preview controls">
        <div>
          <Heart size={16} strokeWidth={1.65} />
          <MessageCircle size={16} strokeWidth={1.65} />
          <Bookmark size={16} strokeWidth={1.65} />
        </div>
        <small>{copy.length} chars</small>
      </footer>
    </article>
  );
}

function CampaignCreationStudio({
  connections,
  onCreated,
  onCancel
}: {
  connections: Connection[];
  onCreated: () => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [sourceMode, setSourceMode] = useState<"markdown" | "url">("markdown");
  const [sourceUrl, setSourceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const liveConnections = connections.filter(connection => connection.connected);

  async function createCampaign(event: React.FormEvent) {
    event.preventDefault();
    const hasSource = sourceMode === "markdown" ? Boolean(source.trim()) : Boolean(sourceUrl.trim());
    if (title.trim().length < 2 || !hasSource) return;

    setSaving(true);
    setError("");
    try {
      await api("/api/posts/ingest", {
        method: "POST",
        body: JSON.stringify(
          sourceMode === "url"
            ? { title: title.trim(), url: sourceUrl.trim() }
            : { title: title.trim(), markdown: source.trim() }
        )
      });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create campaign.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ps-studio ps-studio-new ps-creation-studio">
      <PosturaBrandReel />

      <form className="ps-creation-shell" onSubmit={createCampaign}>
        <header className="ps-creation-head">
          <div className="ps-creation-titleline">
            <span className="ps-kicker">NEW CAMPAIGN</span>
            <input
              className="ps-creation-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Campaign name"
              aria-label="Campaign name"
            />
          </div>
          <span className="ps-state-token">DRAFT</span>
        </header>

        <div className="ps-creation-grid">
          <section className="ps-master-stage" aria-label="Master social post composer">
            <div className="ps-stage-label">
              <div>
                <span>MASTER POST</span>
                <strong>Live social preview</strong>
              </div>
              <small>BRAND FILM</small>
            </div>

            <StudioPostPreview title={title} copy={sourceMode === "markdown" ? source : ""} surface="master" />

            <div className="ps-platform-branch" aria-label="Publishing destinations">
              <button type="button" className="is-master">Master</button>
              <span className="ps-branch-line" />
              {liveConnections.length > 0 ? (
                liveConnections.slice(0, 4).map(connection => (
                  <button type="button" key={connection.platform} className="is-live">
                    <i /> {connection.label}
                  </button>
                ))
              ) : (
                <button type="button" onClick={() => navigate("/connections")}>+ Connect destination</button>
              )}
            </div>

            <div className="ps-creation-hint">
              One idea becomes platform-native versions after this campaign is created.
            </div>
          </section>

          <aside className="ps-creation-inspector" aria-label="Campaign setup inspector">
            <section className="ps-inspector-section ps-inspector-write">
              <div className="ps-section-line">
                <span>Source</span>
                <small>{sourceMode === "markdown" ? `${source.length} / 12000` : "URL ingest"}</small>
              </div>
              <div className="ps-source-mode" role="tablist" aria-label="Campaign source type">
                <button type="button" className={sourceMode === "markdown" ? "is-active" : ""} onClick={() => setSourceMode("markdown")}>Write / paste</button>
                <button type="button" className={sourceMode === "url" ? "is-active" : ""} onClick={() => setSourceMode("url")}>Import URL</button>
              </div>
              {sourceMode === "markdown" ? (
                <textarea
                  value={source}
                  onChange={event => setSource(event.target.value)}
                  placeholder="Write or paste the campaign source…"
                  maxLength={12000}
                  aria-label="Campaign source"
                />
              ) : (
                <input
                  className="ps-source-url"
                  type="url"
                  value={sourceUrl}
                  onChange={event => setSourceUrl(event.target.value)}
                  placeholder="https://example.com/source"
                  aria-label="Campaign source URL"
                />
              )}
            </section>

            <section className="ps-inspector-section">
              <div className="ps-section-line"><span>Destinations</span></div>
              <div className="ps-destination-chips">
                {liveConnections.length > 0 ? liveConnections.map(connection => (
                  <span key={connection.platform}><i />{connection.label}</span>
                )) : (
                  <button type="button" onClick={() => navigate("/connections")}>Connect publishing</button>
                )}
              </div>
            </section>

            <section className="ps-inspector-section ps-brain-locked">
              <div className="ps-section-line"><span>Campaign Brain</span></div>
              <div className="ps-brain-lock-row">
                <BrainCircuit size={17} strokeWidth={1.65} />
                <p>Available after the campaign is saved, using real campaign state.</p>
              </div>
            </section>

            {error ? <div className="ps-inline-error">{error}</div> : null}

            <div className="ps-create-actions">
              {onCancel ? <button type="button" className="is-quiet" onClick={onCancel}>Cancel</button> : null}
              <button
                type="submit"
                className="is-primary"
                disabled={saving || title.trim().length < 2 || (sourceMode === "markdown" ? !source.trim() : !sourceUrl.trim())}
              >
                {saving ? "Creating…" : "Create campaign"}
              </button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [brainInsight, setBrainInsight] = useState<AiInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [inspector, setInspector] = useState<"review" | "brain" | "schedule" | "publish">("review");
  const [selectedSurface, setSelectedSurface] = useState<"master" | "discord" | "mastodon">("master");
  const [variantSource, setVariantSource] = useState("");
  const [variantDrafts, setVariantDrafts] = useState({ discord: "", mastodon: "" });
  const [variantBaseline, setVariantBaseline] = useState({ discord: "", mastodon: "" });
  const [savingVariant, setSavingVariant] = useState(false);
  const [variantError, setVariantError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStudio() {
      try {
        const [campaignResult, connectionResult, activityResult, reviewResult, scheduleResult] =
          await Promise.allSettled([
            api<unknown>("/api/campaigns"),
            api<ConnectionsResponse>("/api/connections"),
            api<unknown>("/api/activity"),
            api<unknown>("/api/review-queue"),
            api<unknown>("/api/schedules")
          ]);

        if (cancelled) return;

        const campaignData =
          campaignResult.status === "fulfilled"
            ? normalizeCollection<Campaign>(campaignResult.value, ["campaigns"])
            : [];
        const connectionData = normalizeConnections(
          connectionResult.status === "fulfilled" ? connectionResult.value : []
        );
        const activityData =
          activityResult.status === "fulfilled"
            ? normalizeCollection<ActivityEvent>(activityResult.value, ["events", "activity"])
            : [];
        const reviewData =
          reviewResult.status === "fulfilled"
            ? normalizeCollection<ReviewQueueItem>(reviewResult.value, ["queue", "reviewQueue"])
            : [];
        const scheduleData =
          scheduleResult.status === "fulfilled"
            ? normalizeCollection<ScheduleRecord>(scheduleResult.value, ["schedules"])
            : [];

        setCampaigns(campaignData);
        setConnections(connectionData);
        setEvents(activityData);
        setReviewQueue(reviewData);
        setSchedules(scheduleData);

        const active = [...campaignData].sort(
          (a, b) => +new Date(b.updatedAt ?? b.createdAt) - +new Date(a.updatedAt ?? a.createdAt)
        )[0];

        if (!active) {
          setBrainInsight(null);
          setVariantSource("");
          setVariantDrafts({ discord: "", mastodon: "" });
          setVariantBaseline({ discord: "", mastodon: "" });
          return;
        }

        const [insightResult, variantResult] = await Promise.allSettled([
          api<unknown>(`/api/campaigns/${active.id}/ai/insights`),
          api<{ campaignId: string; source: string; variants: CampaignVariant[] }>(
            `/api/campaigns/${active.id}/variants`
          )
        ]);

        if (cancelled) return;

        if (insightResult.status === "fulfilled") {
          const insightHistory = normalizeCollection<AiInsight>(insightResult.value, ["insights", "history"]);
          setBrainInsight(insightHistory[0] ?? null);
        } else {
          setBrainInsight(null);
        }

        if (variantResult.status === "fulfilled") {
          const data = variantResult.value;
          const discord = data.variants.find(item => item.platform === "discord")?.content ?? data.source;
          const mastodon = data.variants.find(item => item.platform === "mastodon")?.content ?? data.source;
          const nextDrafts = { discord, mastodon };
          setVariantSource(data.source);
          setVariantDrafts(nextDrafts);
          setVariantBaseline(nextDrafts);
        } else {
          const fallback = { discord: active.source, mastodon: active.source };
          setVariantSource(active.source);
          setVariantDrafts(fallback);
          setVariantBaseline(fallback);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStudio();
    return () => { cancelled = true; };
  }, []);

  const orderedCampaigns = [...campaigns].sort(
    (a, b) => +new Date(b.updatedAt ?? b.createdAt) - +new Date(a.updatedAt ?? a.createdAt)
  );
  const activeCampaign = orderedCampaigns[0];
  const currentVersion = activeCampaign?.contentVersion ?? 1;
  const approvedVersion = activeCampaign?.approvedVersion ?? null;
  const activeReview = reviewQueue.find(item => item.id === activeCampaign?.id);
  const activeEvents = activeCampaign
    ? events.filter(event => !event.campaign || event.campaign.title === activeCampaign.title).slice(0, 4)
    : events.slice(0, 4);
  const activeSchedules = activeCampaign
    ? schedules
        .filter(item => item.campaignId === activeCampaign.id)
        .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
    : [];
  const nextSchedule = activeSchedules.find(item => item.status === "SCHEDULED" || item.status === "PROCESSING");
  const latestReceipt = activeCampaign?.publications
    ? [...activeCampaign.publications].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
    : undefined;
  const connectedDestinations = connections.filter(connection => connection.connected);
  const unresolvedNotes = activeReview?.unresolvedCurrentVersion ?? 0;
  const isCurrentApproved = approvedVersion === currentVersion;
  const hasPublished = (activeCampaign?.publications?.length ?? 0) > 0;

  const lifecycle = [
    { label: "Brief", active: Boolean(activeCampaign) },
    { label: "Create", active: Boolean(activeCampaign) },
    { label: "Adapt", active: Boolean(activeCampaign) && (variantDrafts.discord !== variantSource || variantDrafts.mastodon !== variantSource || connectedDestinations.length > 0) },
    { label: "Review", active: activeCampaign?.status === "IN_REVIEW" || isCurrentApproved || hasPublished },
    { label: "Approve", active: isCurrentApproved || hasPublished },
    { label: "Publish", active: hasPublished }
  ];

  const selectedVariantDirty =
    selectedSurface === "discord"
      ? variantDrafts.discord !== variantBaseline.discord
      : selectedSurface === "mastodon"
      ? variantDrafts.mastodon !== variantBaseline.mastodon
      : false;

  async function saveVariant() {
    if (!activeCampaign || selectedSurface === "master" || !selectedVariantDirty) return;
    setSavingVariant(true);
    setVariantError("");
    try {
      await api(`/api/campaigns/${activeCampaign.id}/channel-content`, {
        method: "PUT",
        body: JSON.stringify({
          discord: variantDrafts.discord,
          mastodon: variantDrafts.mastodon
        })
      });
      setVariantBaseline({ ...variantDrafts });
      const freshRaw = await api<unknown>("/api/campaigns");
      const fresh = normalizeCollection<Campaign>(freshRaw, ["campaigns"]);
      setCampaigns(fresh);
    } catch (cause) {
      setVariantError(cause instanceof Error ? cause.message : "Unable to save platform variant.");
    } finally {
      setSavingVariant(false);
    }
  }

  if (!loading && !activeCampaign) {
    return (
      <CampaignCreationStudio
        connections={connections}
        onCreated={() => window.location.reload()}
      />
    );
  }

  const activeSurfaceCopy =
    selectedSurface === "master" ? variantSource : variantDrafts[selectedSurface];

  return (
    <div className="ps-studio ps-studio-live ps-live-studio-v2">
      <PosturaBrandReel />

      <main className="ps-workbench ps-live-workbench">
        <header className="ps-live-head">
          <div>
            <span className="ps-kicker">ACTIVE CAMPAIGN</span>
            <h1>{loading ? "Syncing studio…" : activeCampaign?.title}</h1>
          </div>
          <div className="ps-live-meta">
            {activeCampaign ? <CampaignStatusBadge status={activeCampaign.status} /> : null}
            <span>v{currentVersion}</span>
            <span>{isCurrentApproved ? "approved" : "approval open"}</span>
          </div>
        </header>

        <nav className="ps-surface-tabs" aria-label="Campaign content surfaces">
          <button className={selectedSurface === "master" ? "is-active" : ""} onClick={() => setSelectedSurface("master")}>Master</button>
          <button className={selectedSurface === "discord" ? "is-active" : ""} onClick={() => setSelectedSurface("discord")}>Discord</button>
          <button className={selectedSurface === "mastodon" ? "is-active" : ""} onClick={() => setSelectedSurface("mastodon")}>Mastodon</button>
          <span className="ps-surface-spacer" />
          <button className="ps-open-file" onClick={() => navigate("/campaigns")}>Operations <ArrowUpRight size={13} /></button>
        </nav>

        <section className="ps-live-creative-stage">
          <div className="ps-live-preview-column">
            <div className="ps-stage-label">
              <div>
                <span>{selectedSurface === "master" ? "MASTER POST" : `${selectedSurface.toUpperCase()} VARIANT`}</span>
                <strong>Social preview</strong>
              </div>
              <small>{activeSurfaceCopy.length} CHARS</small>
            </div>

            <StudioPostPreview
              title={activeCampaign?.title ?? ""}
              copy={activeSurfaceCopy}
              surface={selectedSurface}
              version={currentVersion}
            />

            <div className="ps-platform-branch ps-platform-branch-live">
              <button type="button" className={selectedSurface === "master" ? "is-master is-selected" : "is-master"} onClick={() => setSelectedSurface("master")}>Master</button>
              <span className="ps-branch-line" />
              {connectedDestinations.length > 0 ? connectedDestinations.map(connection => (
                <button
                  type="button"
                  key={connection.platform}
                  className={selectedSurface === connection.platform ? "is-live is-selected" : "is-live"}
                  onClick={() => setSelectedSurface(connection.platform === "discord" ? "discord" : connection.platform === "mastodon" ? "mastodon" : "master")}
                >
                  <i /> {connection.label}
                </button>
              )) : (
                <button type="button" onClick={() => navigate("/connections")}>+ Connect destination</button>
              )}
            </div>
          </div>

          <div className="ps-live-editor-column">
            <div className="ps-copy-stage-head">
              <div>
                <span>{selectedSurface === "master" ? "Source brief" : `${selectedSurface} copy`}</span>
                <small>{selectedSurface === "master" ? "Master source" : selectedVariantDirty ? "Unsaved changes" : "Saved version"}</small>
              </div>
              {selectedSurface !== "master" ? (
                <button
                  type="button"
                  className="ps-save-variant"
                  onClick={saveVariant}
                  disabled={!selectedVariantDirty || savingVariant}
                >
                  {savingVariant ? "Saving…" : selectedVariantDirty ? "Save variant" : "Saved"}
                </button>
              ) : (
                <button type="button" className="ps-save-variant" onClick={() => navigate("/campaigns")}>Edit source</button>
              )}
            </div>

            {selectedSurface === "master" ? (
              <div className="ps-master-copy ps-master-copy-v2">{variantSource || activeCampaign?.source}</div>
            ) : (
              <textarea
                className="ps-variant-editor ps-variant-editor-v2"
                value={variantDrafts[selectedSurface]}
                onChange={event => setVariantDrafts(current => ({ ...current, [selectedSurface]: event.target.value }))}
                aria-label={`${selectedSurface} campaign content`}
              />
            )}

            {variantError ? <div className="ps-inline-error">{variantError}</div> : null}
          </div>
        </section>

        <section className="ps-progress-rail" aria-label="Campaign lifecycle">
          <div className="ps-progress-head">
            <div>
              <span>Campaign flow</span>
              <strong>From brief to verified publish</strong>
            </div>
            <small>{activeCampaign?.status?.split("_").join(" ") ?? "DRAFT"}</small>
          </div>

          <div className="ps-progress-track">
            {lifecycle.map((step, index) => {
              const currentIndex = lifecycle.reduce(
                (last, item, itemIndex) => (item.active ? itemIndex : last),
                0
              );
              const state = index < currentIndex ? "Done" : index === currentIndex ? "Current" : "Next";

              return (
                <div
                  key={step.label}
                  className={`${step.active ? "is-active" : ""} ${index === currentIndex ? "is-current" : ""}`.trim()}
                >
                  <span className="ps-progress-dot">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <small>{state}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ps-activity-stream" aria-label="Live campaign trail">
          <header>
            <div>
              <span>Live trail</span>
              <strong>Recent campaign activity</strong>
            </div>
            <button onClick={() => navigate("/activity")}>Full trail <ArrowUpRight size={13} /></button>
          </header>

          <div className="ps-activity-stream-list">
            {activeEvents.length > 0 ? activeEvents.slice(0, 4).map(event => (
              <article key={event.id}>
                <i />
                <div>
                  <strong>{event.message}</strong>
                  <small>{event.campaign?.title ?? activeCampaign?.title ?? "POSTURA"}</small>
                </div>
                <time>
                  {new Date(event.createdAt).toLocaleString([], {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </time>
              </article>
            )) : (
              <div className="ps-activity-empty">No activity recorded yet.</div>
            )}
          </div>
        </section>
      </main>

      <aside className="ps-director-panel" aria-label="Campaign director panel">
        <div className="ps-director-head">
          <span>Director</span>
          <strong>Context tools</strong>
        </div>

        <div className="ps-director-tabs">
          <button className={inspector === "review" ? "is-active" : ""} onClick={() => setInspector("review")} title="Review"><ClipboardCheck size={16} /></button>
          <button className={inspector === "brain" ? "is-active" : ""} onClick={() => setInspector("brain")} title="Campaign Brain"><BrainCircuit size={16} /></button>
          <button className={inspector === "schedule" ? "is-active" : ""} onClick={() => setInspector("schedule")} title="Schedule"><CalendarDays size={16} /></button>
          <button className={inspector === "publish" ? "is-active" : ""} onClick={() => setInspector("publish")} title="Publish"><Radio size={16} /></button>
        </div>

        <div className="ps-director-content">
          {inspector === "review" ? (
            <>
              <span className="ps-kicker">REVIEW</span>
              <h2>{unresolvedNotes === 0 ? "Current version is clear" : `${unresolvedNotes} open note${unresolvedNotes === 1 ? "" : "s"}`}</h2>
              <p>{activeReview?.readyForApproval ? "No blocking review notes remain on this version." : activeReview ? "Resolve current-version notes before approval." : "No review record exists yet."}</p>
              <button onClick={() => navigate("/review")}>Open review workspace <ArrowUpRight size={13} /></button>
            </>
          ) : null}

          {inspector === "brain" ? (
            <>
              <span className="ps-kicker">CAMPAIGN BRAIN</span>
              {brainInsight ? (
                <>
                  <div className="ps-brain-state">{brainInsight.analysis.readiness.replace(/_/g, " ")}</div>
                  <h2>{brainInsight.analysis.summary}</h2>
                  <p>{brainInsight.analysis.risks.length} recorded risk{brainInsight.analysis.risks.length === 1 ? "" : "s"} · {brainInsight.analysis.nextActions.length} next action{brainInsight.analysis.nextActions.length === 1 ? "" : "s"}</p>
                </>
              ) : (
                <><h2>No analysis yet</h2><p>Run Campaign Brain against the real campaign state when you need it.</p></>
              )}
              <button onClick={() => navigate("/intelligence")}>Open Campaign Brain <ArrowUpRight size={13} /></button>
            </>
          ) : null}

          {inspector === "schedule" ? (
            <>
              <span className="ps-kicker">SCHEDULE</span>
              <h2>{nextSchedule ? new Date(nextSchedule.scheduledAt).toLocaleString() : "Nothing queued"}</h2>
              <p>{nextSchedule ? `${nextSchedule.platform} · ${nextSchedule.status.replace(/_/g, " ")}` : "Add a schedule when the approved version is ready to move."}</p>
              <button onClick={() => navigate("/calendar")}>Open calendar <ArrowUpRight size={13} /></button>
            </>
          ) : null}

          {inspector === "publish" ? (
            <>
              <span className="ps-kicker">PUBLISHING PROOF</span>
              <h2>{latestReceipt ? `${latestReceipt.platform} · ${latestReceipt.status}` : "No receipt yet"}</h2>
              <p>{latestReceipt ? `HTTP ${latestReceipt.httpStatus ?? "—"} · ${latestReceipt.latencyMs ?? "—"} ms · ${latestReceipt.attemptCount ?? "—"} attempt(s)` : "Publication receipts appear here only after a real delivery attempt."}</p>
              <button onClick={() => navigate("/publishing")}>Open publishing <ArrowUpRight size={13} /></button>
            </>
          ) : null}
        </div>

        <div className="ps-director-foot">
          <span>Campaign DNA</span>
          <div className="ps-dna-line">
            <i className="is-live" />
            <i className={connectedDestinations.length > 0 ? "is-live" : ""} />
            <i className={activeReview && unresolvedNotes === 0 ? "is-live" : ""} />
            <i className={isCurrentApproved ? "is-live" : ""} />
            <i className={nextSchedule || hasPublished ? "is-live" : ""} />
          </div>
          <small>v{currentVersion} · {connectedDestinations.length} destination{connectedDestinations.length === 1 ? "" : "s"} · {unresolvedNotes} open note{unresolvedNotes === 1 ? "" : "s"}</small>
        </div>
      </aside>
    </div>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const classes =
    status === "APPROVED"
      ? "bg-emerald-50 text-emerald-700"
      : status === "IN_REVIEW"
      ? "bg-amber-50 text-amber-700"
      : status === "PUBLISHED"
      ? "bg-blue-50 text-blue-700"
      : "bg-neutral-100 text-neutral-700";

  const label = status === "IN_REVIEW" ? "IN REVIEW" : status;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

type DiffToken = {
  value: string;
  type: "same" | "added" | "removed";
};

function buildWordDiff(before: string, after: string): DiffToken[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);

  const dp = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0)
  );

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffToken[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push({ value: a[i], type: "same" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ value: a[i], type: "removed" });
      i++;
    } else {
      result.push({ value: b[j], type: "added" });
      j++;
    }
  }

  while (i < a.length) {
    result.push({ value: a[i], type: "removed" });
    i++;
  }

  while (j < b.length) {
    result.push({ value: b[j], type: "added" });
    j++;
  }

  return result;
}

function DiffText({ before, after }: { before: string; after: string }) {
  const tokens = buildWordDiff(before, after);
  const added = tokens.filter(token => token.type === "added").length;
  const removed = tokens.filter(token => token.type === "removed").length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
          +{added} added
        </span>
        <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">
          -{removed} removed
        </span>
      </div>

      <div className="whitespace-pre-wrap rounded-2xl bg-canvas p-4 text-sm leading-7">
        {tokens.map((token, index) => (
          <span
            key={`${index}-${token.type}`}
            className={
              token.type === "added"
                ? "rounded bg-emerald-100 px-0.5 text-emerald-900"
                : token.type === "removed"
                ? "rounded bg-red-100 px-0.5 text-red-800 line-through"
                : ""
            }
          >
            {token.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState("");
  const [historyCampaign, setHistoryCampaign] = useState<Campaign | null>(null);
  const [revisions, setRevisions] = useState<CampaignRevision[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [reviewCampaign, setReviewCampaign] = useState<Campaign | null>(null);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [reviewMessage, setReviewMessage] = useState("");
  const [savingReviewNote, setSavingReviewNote] = useState(false);
  const [aiCampaign, setAiCampaign] = useState<Campaign | null>(null);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [aiHistory, setAiHistory] = useState<AiInsight[]>([]);
  const [runningAi, setRunningAi] = useState(false);
  const [applyingAi, setApplyingAi] = useState(false);
  const [diffSelection, setDiffSelection] = useState<{
    from: CampaignRevision;
    to: CampaignRevision;
  } | null>(null);
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [checkingPreflight, setCheckingPreflight] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [variantDrafts, setVariantDrafts] = useState({
    discord: "",
    mastodon: ""
  });
  const [savingVariants, setSavingVariants] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<
    Record<string, Record<PlatformKey, boolean>>
  >({});
  const [operation, setOperation] = useState<{
    campaign: Campaign;
    stage: "ready" | "publishing" | "success" | "failed";
    result?: MultiPublishResponse;
  } | null>(null);

  async function load() {
    const [campaignData, connectionData] = await Promise.all([
      api<unknown>("/api/campaigns"),
      api<ConnectionsResponse>("/api/connections")
    ]);

    const safeCampaigns = normalizeCollection<Campaign>(campaignData, ["campaigns"]);
    const safeConnections = normalizeConnections(connectionData);

    setCampaigns(safeCampaigns);
    setConnections(safeConnections);

    setSelectedPlatforms(current => {
      const next = { ...current };

      for (const campaign of safeCampaigns) {
        if (!next[campaign.id]) {
          next[campaign.id] = PLATFORM_KEYS.reduce((selection, platform) => {
            const connection = safeConnections.find(c => c.platform === platform);
            selection[platform] = Boolean(connection?.connected && connection.mode === "live");
            return selection;
          }, { discord: false, mastodon: false } as Record<PlatformKey, boolean>);
        }
      }

      return next;
    });
  }

  useEffect(() => {
    load().catch(e =>
      setError(e instanceof Error ? e.message : "Unable to load campaigns.")
    );
  }, []);





  async function openAiIntelligence(campaign: Campaign) {
    setError("");
    setAiCampaign(campaign);
    setAiInsight(null);

    try {
      const historyRaw = await api<unknown>(
        `/api/campaigns/${campaign.id}/ai/insights`
      );
      const history = normalizeCollection<AiInsight>(historyRaw, ["insights", "history"]);

      setAiHistory(history);
      setAiInsight(history[0] ?? null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load Postura Intelligence."
      );
    }
  }

  async function runAiIntelligence() {
    if (!aiCampaign) return;

    setRunningAi(true);
    setError("");

    try {
      const insight = await api<AiInsight>(
        `/api/campaigns/${aiCampaign.id}/ai/analyze`,
        { method: "POST" }
      );

      setAiInsight(insight);
      setAiHistory(current => [insight, ...current]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Postura Intelligence analysis failed."
      );
    } finally {
      setRunningAi(false);
    }
  }

  async function applyAiSuggestions() {
    if (!aiCampaign || !aiInsight) return;

    setApplyingAi(true);
    setError("");

    try {
      await api(`/api/campaigns/${aiCampaign.id}/channel-content`, {
        method: "PUT",
        body: JSON.stringify({
          discord: aiInsight.analysis.platforms.discord.suggestedCopy,
          mastodon: aiInsight.analysis.platforms.mastodon.suggestedCopy
        })
      });

      setAiCampaign(null);
      setAiInsight(null);
      setAiHistory([]);
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to apply AI suggestions."
      );
    } finally {
      setApplyingAi(false);
    }
  }

  async function openReviewNotes(campaign: Campaign) {
    setError("");

    try {
      const data = await api<{
        campaignId: string;
        currentVersion: number;
        comments: ReviewComment[];
      }>(`/api/campaigns/${campaign.id}/comments`);

      setReviewComments(data.comments);
      setReviewCampaign(campaign);
      setReviewMessage("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load review notes."
      );
    }
  }

  async function addReviewNote() {
    if (!reviewCampaign || !reviewMessage.trim()) return;

    setSavingReviewNote(true);
    setError("");

    try {
      await api(`/api/campaigns/${reviewCampaign.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          version: reviewCampaign.contentVersion ?? 1,
          author: "Parthishwara",
          message: reviewMessage.trim()
        })
      });

      setReviewMessage("");
      await openReviewNotes(reviewCampaign);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to add review note."
      );
    } finally {
      setSavingReviewNote(false);
    }
  }

  async function setReviewResolved(comment: ReviewComment, resolved: boolean) {
    setError("");

    try {
      await api(
        `/api/comments/${comment.id}/${resolved ? "resolve" : "reopen"}`,
        { method: "POST" }
      );

      if (reviewCampaign) {
        await openReviewNotes(reviewCampaign);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update review note."
      );
    }
  }

  async function openVersionHistory(campaign: Campaign) {
    setLoadingHistory(true);
    setError("");

    try {
      const data = await api<{
        campaignId: string;
        currentVersion: number;
        approvedVersion?: number | null;
        revisions: CampaignRevision[];
      }>(`/api/campaigns/${campaign.id}/revisions`);

      setRevisions(data.revisions);
      setHistoryCampaign(campaign);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load version history."
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  async function restoreVersion(version: number) {
    if (!historyCampaign) return;

    setError("");

    try {
      await api(
        `/api/campaigns/${historyCampaign.id}/revisions/${version}/restore`,
        { method: "POST" }
      );

      setHistoryCampaign(null);
      setRevisions([]);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to restore version."
      );
    }
  }

  async function openChannelStudio(campaign: Campaign) {
    setError("");

    try {
      const data = await api<{
        campaignId: string;
        source: string;
        variants: CampaignVariant[];
      }>(`/api/campaigns/${campaign.id}/variants`);

      const discordVariant = data.variants.find(
        item => item.platform === "discord"
      );

      const mastodonVariant = data.variants.find(
        item => item.platform === "mastodon"
      );

      setVariantDrafts({
        discord: discordVariant?.content ?? data.source,
        mastodon: mastodonVariant?.content ?? data.source
      });

      setEditingCampaign(campaign);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to open Channel Studio."
      );
    }
  }

  async function saveVariants() {
    if (!editingCampaign) return;

    setSavingVariants(true);
    setError("");

    try {
      await api(`/api/campaigns/${editingCampaign.id}/channel-content`, {
        method: "PUT",
        body: JSON.stringify({
          discord: variantDrafts.discord,
          mastodon: variantDrafts.mastodon
        })
      });

      setEditingCampaign(null);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save channel content."
      );
    } finally {
      setSavingVariants(false);
    }
  }

  function togglePlatform(campaignId: string, platform: PlatformKey) {
    setSelectedPlatforms(current => ({
      ...current,
      [campaignId]: {
        ...(current[campaignId] ?? { discord: false, mastodon: false }),
        [platform]: !(current[campaignId]?.[platform] ?? false)
      }
    }));
  }

  function isConnected(platform: PlatformKey) {
    return connections.some(
      connection => connection.platform === platform && connection.connected
    );
  }

  function selectedFor(campaignId: string): PlatformKey[] {
    const selection =
      selectedPlatforms[campaignId] ?? { discord: false, mastodon: false };

    return PLATFORM_KEYS.filter(
      platform => selection[platform] && isConnected(platform)
    );
  }



  async function updateWorkflow(
    campaign: Campaign,
    action: "submit-review" | "approve" | "reopen"
  ) {
    setError("");

    try {
      await api(`/api/campaigns/${campaign.id}/${action}`, {
        method: "POST"
      });

      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update campaign workflow."
      );
    }
  }

  async function runPreflight(campaign: Campaign) {
    const platforms = selectedFor(campaign.id);

    if (platforms.length === 0) {
      setError("Select at least one connected platform.");
      return;
    }

    setCheckingPreflight(true);
    setError("");

    try {
      const result = await api<PreflightResponse>(
        `/api/campaigns/${campaign.id}/preflight`,
        {
          method: "POST",
          body: JSON.stringify({ platforms })
        }
      );

      setPreflight(result);
      setOperation({
        campaign,
        stage: "ready"
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to run preflight checks."
      );
    } finally {
      setCheckingPreflight(false);
    }
  }

  async function publishSelected(campaign: Campaign) {
    const platforms = selectedFor(campaign.id);

    if (platforms.length === 0) {
      setError("Select at least one connected platform.");
      return;
    }

    setError("");
    setOperation({
      campaign,
      stage: "publishing"
    });

    try {
      const result = await api<MultiPublishResponse>(
        `/api/campaigns/${campaign.id}/publish`,
        {
          method: "POST",
          body: JSON.stringify({ platforms })
        }
      );

      setOperation({
        campaign,
        stage: result.allSucceeded ? "success" : "failed",
        result
      });

      await load();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Multi-platform publish failed.";

      setError(message);
      setOperation({
        campaign,
        stage: "failed",
        result: {
          campaignId: campaign.id,
          allSucceeded: false,
          results: []
        }
      });
    }
  }

  if (operation?.stage === "publishing") {
    const platforms = selectedFor(operation.campaign.id);

    return (
      <Page
        title="Publish Flight"
        eyebrow="Multi-channel delivery"
        subtitle="Postura is delivering one campaign across every selected live platform."
      >
        <div className="max-w-4xl">
          <div className="rounded-[28px] border border-line bg-white p-8 shadow-float">
            <div className="flex items-center justify-between gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Campaign
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  {operation.campaign.title}
                </h2>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-[#F0EEFF] px-3 py-1.5 text-sm font-medium text-brand">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                Publishing
              </div>
            </div>

            <div className="mt-8 divide-y divide-line border-y border-line">
              {platforms.map(platform => (
                <div
                  key={platform}
                  className="flex items-center justify-between py-5"
                >
                  <div>
                    <div className="font-medium capitalize">{platform}</div>
                    <div className="mt-1 text-xs text-muted">
                      Live platform destination
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-medium text-brand">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                    Sending
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Page>
    );
  }

  if (
    operation &&
    (operation.stage === "success" || operation.stage === "failed")
  ) {
    const result = operation.result;

    return (
      <Page
        title={
          operation.stage === "success"
            ? "Campaign delivered."
            : "Campaign completed with issues."
        }
        eyebrow="Multi-channel receipt"
        subtitle="Every result below comes directly from the connected platform response."
      >
        <div className="max-w-5xl">
          <div className="rounded-[28px] border border-line bg-white p-8 shadow-float">
            <div className="flex items-start justify-between gap-5">
              <div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    operation.stage === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <Check size={20} />
                </div>

                <h2 className="mt-5 text-2xl font-semibold">
                  {operation.campaign.title}
                </h2>

                <p className="mt-2 text-sm text-muted">
                  {result?.results.filter(item => item.ok).length ?? 0} of{" "}
                  {result?.results.length ?? 0} selected destinations delivered.
                </p>
              </div>
            </div>

            <div className="mt-8 divide-y divide-line border-y border-line">
              {result?.results.map(item => (
                <div
                  key={item.platform}
                  className="grid gap-4 py-5 md:grid-cols-[150px_120px_100px_120px_1fr] md:items-center"
                >
                  <div className="font-medium capitalize">{item.platform}</div>

                  <div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.ok
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {item.ok ? "Delivered" : "Failed"}
                    </span>
                  </div>

                  <div className="text-sm">
                    HTTP {item.publication?.httpStatus ?? "—"}
                  </div>

                  <div className="text-sm text-muted">
                    {item.publication?.latencyMs != null
                      ? `${item.publication.latencyMs} ms`
                      : "—"}
                  </div>

                  <div className="flex justify-end">
                    {item.publication?.externalUrl ? (
                      <a
                        href={item.publication.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium"
                      >
                        View live
                        <ArrowUpRight size={14} />
                      </a>
                    ) : (
                      <div className="text-sm text-red-700">
                        {item.error ?? item.publication?.status ?? "No URL"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setOperation(null)}
              className="mt-7 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium"
            >
              Back to campaigns
            </button>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Campaigns"
      eyebrow="Content operations"
      subtitle="Choose the live destinations for each campaign, then publish once."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState onCreate={() => navigate("/new")} />
      ) : (
        <div className="divide-y divide-line border-y border-line">
          {campaigns.map(campaign => {
            const selected = selectedFor(campaign.id);

            return (
              <div
                key={campaign.id}
                className="grid gap-6 py-7 lg:grid-cols-[1fr_330px] lg:items-center"
              >
                <div>
                  <div className="font-medium">{campaign.title}</div>
                  <div className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-muted">
                    {campaign.source}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <CampaignStatusBadge status={campaign.status} />

                    {campaign.status === "DRAFT" && (
                      <button
                        onClick={() => updateWorkflow(campaign, "submit-review")}
                        className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium"
                      >
                        Submit for review
                      </button>
                    )}

                    {campaign.status === "IN_REVIEW" && (
                      <>
                        <button
                          onClick={() => updateWorkflow(campaign, "approve")}
                          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateWorkflow(campaign, "reopen")}
                          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium"
                        >
                          Reopen draft
                        </button>
                      </>
                    )}

                    {["APPROVED", "PUBLISHED"].includes(campaign.status) && (
                      <button
                        onClick={() => updateWorkflow(campaign, "reopen")}
                        className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium"
                      >
                        Reopen draft
                      </button>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-muted">
                    Version {campaign.contentVersion ?? 1}
                    {campaign.approvedVersion != null
                      ? ` · Approved v${campaign.approvedVersion}`
                      : " · Approval required"}
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Destinations
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORM_KEYS.map(platform => {
                      const connected = isConnected(platform);
                      const active =
                        selectedPlatforms[campaign.id]?.[platform] ?? false;

                      return (
                        <button
                          key={platform}
                          type="button"
                          disabled={!connected}
                          onClick={() =>
                            togglePlatform(campaign.id, platform)
                          }
                          className={`rounded-xl border px-3 py-3 text-left transition ${
                            active && connected
                              ? "border-brand bg-[#F0EEFF]"
                              : "border-line bg-white"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">
                              {platformLabel(platform)}
                            </div>
                            <div
                              className={`h-2.5 w-2.5 rounded-full ${
                                connected
                                  ? "bg-emerald-500"
                                  : "bg-neutral-300"
                              }`}
                            />
                          </div>

                          <div className="mt-1 text-[11px] text-muted">
                            {connected ? "Live" : "Disconnected"}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => openReviewNotes(campaign)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium transition hover:bg-canvas"
                  >
                    Review notes
                  </button>

                  <button
                    onClick={() => openVersionHistory(campaign)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium transition hover:bg-canvas"
                  >
                    Version history
                  </button>

                  <button
                    onClick={() => openChannelStudio(campaign)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium transition hover:bg-canvas"
                  >
                    Edit channel content
                  </button>

                  <button
                    onClick={() => runPreflight(campaign)}
                    disabled={selected.length === 0 || !["APPROVED", "PUBLISHED"].includes(campaign.status)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
                  >
                    <Send size={15} />
                    {checkingPreflight
                      ? "Checking..."
                      : `Review ${selected.length} ${
                          selected.length === 1 ? "destination" : "destinations"
                        }`}
                  </button>

                  {!["APPROVED", "PUBLISHED"].includes(campaign.status) && (
                    <div className="mt-2 text-center text-xs text-muted">
                      Approval required before publishing.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}






      {aiCampaign && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/25 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 w-full max-w-6xl overflow-hidden rounded-[28px] border border-[#E2E0F5] bg-white shadow-[0_30px_90px_rgba(35,31,75,0.18)]">
            <div className="border-b border-[#ECEAF7] bg-[linear-gradient(135deg,#FBFAFF,#F5F3FF)] px-7 py-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#6258D9]">
                    <Sparkles size={14} />
                    Postura Intelligence
                  </div>

                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[#1F2230]">
                    Campaign Brain
                  </h3>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                    AI reads the real campaign state, channel variants, current version,
                    review feedback and approval context before making recommendations.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setAiCampaign(null);
                    setAiInsight(null);
                    setAiHistory([]);
                  }}
                  className="self-start rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#646A78] shadow-sm ring-1 ring-[#E8E6F4]">
                  {aiCampaign.title}
                </div>

                <div className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#646A78] shadow-sm ring-1 ring-[#E8E6F4]">
                  Current v{aiCampaign.contentVersion ?? 1}
                </div>

                <button
                  onClick={runAiIntelligence}
                  disabled={runningAi}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-50"
                >
                  <Sparkles size={15} />
                  {runningAi ? "Analyzing campaign..." : "Analyze current version"}
                </button>
              </div>
            </div>

            {!aiInsight ? (
              <div className="px-7 py-16 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F3F1FF] text-[#5A50D3]">
                  <Sparkles size={20} />
                </div>
                <div className="mt-4 text-base font-medium text-[#282B34]">
                  No intelligence run selected.
                </div>
                <div className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
                  Run Campaign Brain to analyze the actual content and workflow state.
                  AI will not modify anything automatically.
                </div>
              </div>
            ) : (
              <div className="p-7">
                <div className="grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
                  <div className="rounded-2xl border border-line bg-[#FCFCFD] p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Operational assessment
                    </div>
                    <div className="mt-3 text-base leading-7 text-[#2A2D35]">
                      {aiInsight.analysis.summary}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      AI readiness
                    </div>
                    <div
                      className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
                        aiInsight.analysis.readiness === "READY"
                          ? "bg-emerald-50 text-emerald-700"
                          : aiInsight.analysis.readiness === "BLOCKED"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {aiInsight.analysis.readiness.replace("_", " ")}
                    </div>

                    <div className="mt-4 text-xs leading-5 text-muted">
                      v{aiInsight.version} · {aiInsight.provider} / {aiInsight.model}
                      {aiInsight.latencyMs != null
                        ? ` · ${aiInsight.latencyMs} ms`
                        : ""}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {(["discord", "mastodon"] as const).map(platform => {
                    const platformInsight = aiInsight.analysis.platforms[platform];

                    return (
                      <div
                        key={platform}
                        className="rounded-2xl border border-line bg-white p-5"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                              Platform intelligence
                            </div>
                            <div className="mt-1 text-lg font-semibold capitalize">
                              {platform}
                            </div>
                          </div>
                        </div>

                        <p className="mt-4 text-sm leading-6 text-[#555B67]">
                          {platformInsight.assessment}
                        </p>

                        <div className="mt-5 rounded-xl bg-[#F7F7FA] p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                            Suggested copy
                          </div>
                          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#2E3139]">
                            {platformInsight.suggestedCopy}
                          </div>
                        </div>

                        {platformInsight.reasons.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {platformInsight.reasons.map((reason, index) => (
                              <div
                                key={`${platform}-${index}`}
                                className="flex gap-2 text-xs leading-5 text-muted"
                              >
                                <Check size={13} className="mt-0.5 shrink-0 text-[#6258D9]" />
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  <div className="rounded-2xl border border-line p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Risks detected
                    </div>

                    {aiInsight.analysis.risks.length === 0 ? (
                      <div className="mt-4 text-sm text-emerald-700">
                        No material content risks detected.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {aiInsight.analysis.risks.map((risk, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-line bg-[#FCFCFD] p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                  risk.severity === "HIGH"
                                    ? "bg-red-50 text-red-700"
                                    : risk.severity === "MEDIUM"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-neutral-100 text-neutral-700"
                                }`}
                              >
                                {risk.severity}
                              </span>
                              <span className="text-xs font-medium">
                                {risk.area}
                              </span>
                            </div>

                            <div className="mt-2 text-xs leading-5 text-muted">
                              {risk.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-line p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Next best actions
                    </div>
                    <div className="mt-4 space-y-3">
                      {aiInsight.analysis.nextActions.map((action, index) => (
                        <div
                          key={index}
                          className="flex gap-3 text-sm leading-6 text-[#4D535E]"
                        >
                          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F0EEFF] text-[10px] font-semibold text-[#5B51D0]">
                            {index + 1}
                          </div>
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-[#DDD9FF] bg-[#F8F7FF] p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#2F3150]">
                      Human approval gate
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[#74768E]">
                      Applying suggestions creates a real new campaign version and invalidates the old approval.
                    </div>
                  </div>

                  <button
                    onClick={applyAiSuggestions}
                    disabled={
                      applyingAi ||
                      !aiInsight.analysis.platforms.discord.suggestedCopy.trim() ||
                      !aiInsight.analysis.platforms.mastodon.suggestedCopy.trim()
                    }
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1F2230] px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
                  >
                    <Check size={15} />
                    {applyingAi
                      ? "Creating new version..."
                      : "Accept suggestions as new version"}
                  </button>
                </div>

                {aiHistory.length > 1 && (
                  <div className="mt-7 border-t border-line pt-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Intelligence history
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {aiHistory.map(item => (
                        <button
                          key={item.id}
                          onClick={() => setAiInsight(item)}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                            aiInsight.id === item.id
                              ? "border-[#BDB7FF] bg-[#F3F1FF] text-[#554BCB]"
                              : "border-line bg-white text-muted"
                          }`}
                        >
                          v{item.version} · {new Date(item.createdAt).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {reviewCampaign && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/20 p-4 backdrop-blur-sm">
          <div className="mx-auto my-10 w-full max-w-4xl rounded-[28px] border border-line bg-white p-7 shadow-float">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                  Review Notes
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                  {reviewCampaign.title}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Feedback is attached to a specific campaign version and stored in the database.
                </p>
              </div>

              <button
                onClick={() => {
                  setReviewCampaign(null);
                  setReviewComments([]);
                  setReviewMessage("");
                }}
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium"
              >
                Close
              </button>
            </div>

            <div className="mt-7 rounded-2xl border border-line p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">
                    Add note to version {reviewCampaign.contentVersion ?? 1}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Unresolved notes on the current version must be resolved before approval.
                  </div>
                </div>

                <CampaignStatusBadge status={reviewCampaign.status} />
              </div>

              <textarea
                rows={4}
                value={reviewMessage}
                onChange={e => setReviewMessage(e.target.value)}
                placeholder="Write reviewer feedback..."
                className="mt-5 w-full resize-y rounded-xl border border-line bg-canvas px-4 py-4 text-sm leading-6 outline-none focus:border-brand"
              />

              <div className="mt-4 flex justify-end">
                <button
                  onClick={addReviewNote}
                  disabled={savingReviewNote || !reviewMessage.trim()}
                  className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {savingReviewNote ? "Adding..." : "Add review note"}
                </button>
              </div>
            </div>

            <div className="mt-7">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Notes
              </div>

              {reviewComments.length === 0 ? (
                <div className="mt-4 border-y border-line py-10 text-center text-sm text-muted">
                  No review notes yet.
                </div>
              ) : (
                <div className="mt-4 divide-y divide-line border-y border-line">
                  {reviewComments.map(comment => (
                    <div key={comment.id} className="py-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium">
                              {comment.author}
                            </div>

                            <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-700">
                              v{comment.version}
                            </span>

                            <span
                              className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                                comment.resolved
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {comment.resolved ? "Resolved" : "Unresolved"}
                            </span>
                          </div>

                          <div className="mt-2 whitespace-pre-wrap text-sm leading-6">
                            {comment.message}
                          </div>

                          <div className="mt-2 text-xs text-muted">
                            {new Date(comment.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            setReviewResolved(comment, !comment.resolved)
                          }
                          className="shrink-0 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium"
                        >
                          {comment.resolved ? "Reopen" : "Resolve"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {diffSelection && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/30 p-4 backdrop-blur-sm">
          <div className="mx-auto my-10 w-full max-w-6xl rounded-[28px] border border-line bg-white p-7 shadow-float">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                  Version Diff
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                  v{diffSelection.from.version} → v{diffSelection.to.version}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Exact saved-content changes between these two campaign versions.
                </p>
              </div>

              <button
                onClick={() => setDiffSelection(null)}
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium"
              >
                Close diff
              </button>
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-line p-5">
                <div className="mb-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Discord
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    v{diffSelection.from.version} → v{diffSelection.to.version}
                  </div>
                </div>

                <DiffText
                  before={diffSelection.from.discordContent}
                  after={diffSelection.to.discordContent}
                />
              </section>

              <section className="rounded-2xl border border-line p-5">
                <div className="mb-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Mastodon
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    v{diffSelection.from.version} → v{diffSelection.to.version}
                  </div>
                </div>

                <DiffText
                  before={diffSelection.from.mastodonContent}
                  after={diffSelection.to.mastodonContent}
                />
              </section>
            </div>

            <div className="mt-6 rounded-2xl bg-canvas px-4 py-3 text-xs text-muted">
              Green text was added in v{diffSelection.to.version}. Red struck-through
              text was removed from v{diffSelection.from.version}.
            </div>
          </div>
        </div>
      )}

      {historyCampaign && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/20 p-4 backdrop-blur-sm">
          <div className="mx-auto my-10 w-full max-w-5xl rounded-[28px] border border-line bg-white p-7 shadow-float">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                  Version History
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                  {historyCampaign.title}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Every saved content revision is stored in the database.
                </p>
              </div>

              <button
                onClick={() => {
                  setHistoryCampaign(null);
                  setRevisions([]);
                  setDiffSelection(null);
                }}
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium"
              >
                Close
              </button>
            </div>

            <div className="mt-7 divide-y divide-line border-y border-line">
              {revisions.map((revision, index) => (
                <div key={revision.id} className="py-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-semibold">
                          Version {revision.version}
                        </div>
                        {revision.version === historyCampaign.contentVersion && (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            Current
                          </span>
                        )}
                        {revision.version === historyCampaign.approvedVersion && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Approved
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-xs text-muted">
                        {new Date(revision.createdAt).toLocaleString()} · {revision.reason}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {revisions[index + 1] && (
                        <button
                          onClick={() =>
                            setDiffSelection({
                              from: revisions[index + 1],
                              to: revision
                            })
                          }
                          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium"
                        >
                          Compare changes
                        </button>
                      )}

                      {revision.version !== historyCampaign.contentVersion && (
                        <button
                          onClick={() => restoreVersion(revision.version)}
                          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium"
                        >
                          Restore this version
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl bg-canvas p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        Discord
                      </div>
                      <div className="mt-3 whitespace-pre-wrap text-sm leading-6">
                        {revision.discordContent}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-canvas p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        Mastodon
                      </div>
                      <div className="mt-3 whitespace-pre-wrap text-sm leading-6">
                        {revision.mastodonContent}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {!loadingHistory && revisions.length === 0 && (
                <div className="py-12 text-center text-sm text-muted">
                  No revisions found yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingCampaign && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/20 p-4 backdrop-blur-sm">
          <div className="mx-auto my-10 w-full max-w-5xl rounded-[28px] border border-line bg-white p-7 shadow-float">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                  Channel Studio
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                  {editingCampaign.title}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Edit the actual content each connected platform will receive.
                </p>
              </div>

              <button
                onClick={() => setEditingCampaign(null)}
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium"
              >
                Close
              </button>
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-line p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Discord</div>
                    <div className="mt-1 text-xs text-muted">
                      Community announcement
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Live
                  </span>
                </div>

                <textarea
                  rows={10}
                  value={variantDrafts.discord}
                  onChange={e =>
                    setVariantDrafts(current => ({
                      ...current,
                      discord: e.target.value
                    }))
                  }
                  className="mt-5 w-full resize-y rounded-xl border border-line bg-canvas px-4 py-4 text-sm leading-6 outline-none focus:border-brand"
                />

                <div className="mt-2 text-right text-xs text-muted">
                  {variantDrafts.discord.length} characters
                </div>
              </div>

              <div className="rounded-2xl border border-line p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Mastodon</div>
                    <div className="mt-1 text-xs text-muted">
                      Public social post
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Live
                  </span>
                </div>

                <textarea
                  rows={10}
                  value={variantDrafts.mastodon}
                  onChange={e =>
                    setVariantDrafts(current => ({
                      ...current,
                      mastodon: e.target.value
                    }))
                  }
                  className="mt-5 w-full resize-y rounded-xl border border-line bg-canvas px-4 py-4 text-sm leading-6 outline-none focus:border-brand"
                />

                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className={variantDrafts.mastodon.length > 500 ? "text-red-700" : "text-muted"}>
                    Mastodon default limit: 500 characters
                  </span>
                  <span className={variantDrafts.mastodon.length > 500 ? "text-red-700" : "text-muted"}>
                    {variantDrafts.mastodon.length} / 500
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-7 flex items-center justify-between border-t border-line pt-6">
              <div className="text-sm text-muted">
                Discord and Mastodon are saved together as one campaign version.
              </div>

              <button
                onClick={saveVariants}
                disabled={
                  savingVariants ||
                  !variantDrafts.discord.trim() ||
                  !variantDrafts.mastodon.trim() ||
                  variantDrafts.mastodon.length > 500
                }
                className="rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
              >
                {savingVariants ? "Saving version..." : "Save as new version"}
              </button>
            </div>
          </div>
        </div>
      )}

      {operation?.stage === "ready" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-line bg-white p-7 shadow-float">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Ready to publish
            </div>

            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
              {operation.campaign.title}
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted">
              One campaign will be sent to every selected live destination.
            </p>

            <div className="mt-6 rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Approval</div>
                  <div className="mt-1 text-xs text-muted">
                    Campaign status: {preflight?.campaignStatus ?? "—"}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Current version: v{preflight?.contentVersion ?? "—"}
                    {preflight?.approvedVersion != null
                      ? ` · Approved version: v${preflight.approvedVersion}`
                      : " · No approved version"}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Unresolved review notes: {preflight?.unresolvedReviewNotes ?? 0}
                  </div>
                </div>
                <div
                  className={`flex items-center gap-2 text-sm font-medium ${
                    preflight?.approvalReady
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      preflight?.approvalReady
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    }`}
                  />
                  {preflight?.approvalReady ? "Version approved" : "Re-approval required"}
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {preflight?.checks.map(check => (
                <div
                  key={check.platform}
                  className="rounded-2xl border border-line p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium capitalize">
                        {check.platform}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {check.length} / {check.maxLength} characters
                      </div>
                    </div>

                    <div
                      className={`flex items-center gap-2 text-sm font-medium ${
                        check.ready ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          check.ready ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      {check.ready ? "Ready" : "Needs attention"}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-muted">
                    {check.message}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-center justify-between gap-3">
              <div className="text-sm text-muted">
                {preflight?.ready
                  ? "All selected destinations passed preflight."
                  : "Fix the highlighted issue before publishing."}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setOperation(null);
                    setPreflight(null);
                  }}
                  className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  onClick={() => publishSelected(operation.campaign)}
                  disabled={!preflight?.ready}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  Publish campaign
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function PublishStep({
  label,
  status
}: {
  label: string;
  status: "complete" | "working" | "waiting";
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-7 w-7 place-items-center rounded-full ${
            status === "complete"
              ? "bg-ink text-white"
              : status === "working"
              ? "bg-[#F0EEFF] text-brand"
              : "border border-line text-muted"
          }`}
        >
          {status === "complete" ? (
            <Check size={14} />
          ) : status === "working" ? (
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-line" />
          )}
        </div>
        <div className="text-sm font-medium">{label}</div>
      </div>

      <div className="text-xs text-muted">
        {status === "complete"
          ? "Complete"
          : status === "working"
          ? "Working..."
          : "Waiting"}
      </div>
    </div>
  );
}

function ReceiptItem({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function NewCampaignPage() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    api<ConnectionsResponse>("/api/connections")
      .then(data => setConnections(normalizeConnections(data)))
      .catch(() => setConnections([]));
  }, []);

  return (
    <CampaignCreationStudio
      connections={connections}
      onCreated={() => navigate("/")}
      onCancel={() => navigate(-1)}
    />
  );
}

function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api<ConnectionsResponse>("/api/connections");
      setConnections(normalizeConnections(data));
    } catch (cause) {
      setConnections([]);
      setError(cause instanceof Error ? cause.message : "Unable to load publishing connections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const realConnections = connections.filter(item => item.mode === "live");
  const connectedReal = realConnections.filter(item => item.connected).length;

  return (
    <Page title="Connections" eyebrow="Live infrastructure" subtitle="Real connection state from the POSTURA API. Nothing is marked connected unless the backend reports it.">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">
          {loading ? "Checking publishers…" : `${connectedReal}/${realConnections.length} real publishers configured`}
        </div>
        <button onClick={load} disabled={loading} className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium disabled:opacity-40">
          {loading ? "Checking…" : "Refresh connections"}
        </button>
      </div>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="max-w-3xl divide-y divide-line border-y border-line">
        {connections.map(c => (
          <div key={c.platform} className="flex items-center justify-between gap-5 py-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-medium">{c.label}</div>
                <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {c.mode}
                </span>
              </div>
              <div className="mt-1 text-sm text-muted">
                {c.connected ? (c.mode === "live" ? "Credentials detected and ready for real publishing." : "Local adapter ready for reliability testing.") : "Not configured in the backend environment."}
              </div>
            </div>
            <div className={`flex items-center gap-2 text-sm font-medium ${c.connected ? "text-emerald-700" : "text-muted"}`}>
              {c.connected && <Check size={15} />}
              {c.connected ? "Connected" : "Disconnected"}
            </div>
          </div>
        ))}
        {!loading && connections.length === 0 && !error ? (
          <div className="py-12 text-sm text-muted">No publisher adapters were returned by the API.</div>
        ) : null}
      </div>
    </Page>
  );
}



function IntelligencePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [history, setHistory] = useState<AiInsight[]>([]);
  const [insight, setInsight] = useState<AiInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [applyingPlatform, setApplyingPlatform] = useState<
    "discord" | "mastodon" | null
  >(null);
  const [actionMessage, setActionMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCampaign =
    campaigns.find(c => c.id === selectedCampaignId) ?? campaigns[0];

  async function loadCampaigns() {
    setLoading(true);
    setError("");

    try {
      const dataRaw = await api<unknown>("/api/campaigns");
      const data = normalizeCollection<Campaign>(dataRaw, ["campaigns"]);
      setCampaigns(data);

      const firstId = selectedCampaignId || data[0]?.id || "";
      setSelectedCampaignId(firstId);

      if (firstId) {
        const previousRaw = await api<unknown>(
          `/api/campaigns/${firstId}/ai/insights`
        );
        const previous = normalizeCollection<AiInsight>(previousRaw, ["insights", "history"]);
        setHistory(previous);
        setInsight(previous[0] ?? null);
      } else {
        setHistory([]);
        setInsight(null);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load Postura Intelligence."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function changeCampaign(id: string) {
    setSelectedCampaignId(id);
    setActionMessage("");
    setError("");
    setInsight(null);

    try {
      const previousRaw = await api<unknown>(
        `/api/campaigns/${id}/ai/insights`
      );
      const previous = normalizeCollection<AiInsight>(previousRaw, ["insights", "history"]);
      setHistory(previous);
      setInsight(previous[0] ?? null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load intelligence history."
      );
    }
  }

  async function analyzeCampaign(campaignId: string) {
    const result = await api<AiInsight>(
      `/api/campaigns/${campaignId}/ai/analyze`,
      { method: "POST" }
    );

    setInsight(result);
    setHistory(current => [
      result,
      ...current.filter(item => item.id !== result.id)
    ]);

    return result;
  }

  async function runAnalysis() {
    if (!selectedCampaign) return;

    setRunning(true);
    setActionMessage("");
    setError("");

    try {
      await analyzeCampaign(selectedCampaign.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Postura Intelligence analysis failed."
      );
    } finally {
      setRunning(false);
    }
  }

  async function applyPlatformSuggestion(
    platform: "discord" | "mastodon"
  ) {
    if (!selectedCampaign || !insight || applyingPlatform !== null) return;

    setApplyingPlatform(platform);
    setActionMessage("");
    setError("");

    try {
      const variantData = await api<{
        campaignId: string;
        source: string;
        variants: CampaignVariant[];
      }>(`/api/campaigns/${selectedCampaign.id}/variants`);

      const currentDiscord =
        variantData.variants.find(item => item.platform === "discord")
          ?.content ?? variantData.source;

      const currentMastodon =
        variantData.variants.find(item => item.platform === "mastodon")
          ?.content ?? variantData.source;

      const suggestedCopy =
        insight.analysis.platforms[platform].suggestedCopy;

      await api(`/api/campaigns/${selectedCampaign.id}/channel-content`, {
        method: "PUT",
        body: JSON.stringify({
          discord:
            platform === "discord" ? suggestedCopy : currentDiscord,
          mastodon:
            platform === "mastodon" ? suggestedCopy : currentMastodon
        })
      });

      const refreshedRaw = await api<unknown>("/api/campaigns");
      const refreshedCampaigns = normalizeCollection<Campaign>(refreshedRaw, ["campaigns"]);
      setCampaigns(refreshedCampaigns);

      const refreshedCampaign =
        refreshedCampaigns.find(
          campaign => campaign.id === selectedCampaign.id
        );

      const nextVersion =
        refreshedCampaign?.contentVersion ??
        (selectedCampaign.contentVersion ?? insight.version) + 1;

      setActionMessage(
        `${platform === "discord" ? "Discord" : "Mastodon"} suggestion applied · v${nextVersion} created · re-approval required.`
      );

      // Re-run Campaign Brain against the new real campaign version.
      setRunning(true);
      await analyzeCampaign(selectedCampaign.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `Unable to apply ${platform} AI suggestion.`
      );
    } finally {
      setRunning(false);
      setApplyingPlatform(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1180px] px-6 py-12">
        <div className="text-sm text-muted">Loading Postura Intelligence...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-10 xl:px-10">
      <div className="intelligence-page-head">
        <div>
          <div className="intelligence-eyebrow">
            POSTURA INTELLIGENCE
          </div>
          <h1>Campaign Brain</h1>
          <p>
            Analyze the actual campaign state, platform copy, review context,
            approvals and delivery readiness before publishing.
          </p>
        </div>

        <div className="intelligence-head-actions">
          <select
            value={selectedCampaign?.id ?? ""}
            onChange={e => changeCampaign(e.target.value)}
          >
            {campaigns.map(campaign => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title}
              </option>
            ))}
          </select>

          <button onClick={runAnalysis} disabled={!selectedCampaign || running}>
            <Sparkles size={15} />
            {running ? "Analyzing..." : "Analyze campaign"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="intelligence-action-success">
          <Check size={15} />
          <span>{actionMessage}</span>
        </div>
      )}

      {!selectedCampaign ? (
        <div className="intelligence-empty">
          <Sparkles size={20} />
          <h2>No campaign yet</h2>
          <p>Create a campaign before running Postura Intelligence.</p>
        </div>
      ) : (
        <>
          <section className="intelligence-campaign-strip">
            <div>
              <span>Campaign</span>
              <strong>{selectedCampaign.title}</strong>
            </div>
            <div>
              <span>Version</span>
              <strong>v{selectedCampaign.contentVersion ?? 1}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{selectedCampaign.status}</strong>
            </div>
            <div>
              <span>Approved</span>
              <strong>
                {selectedCampaign.approvedVersion != null
                  ? `v${selectedCampaign.approvedVersion}`
                  : "—"}
              </strong>
            </div>
          </section>

          {!insight ? (
            <section className="intelligence-empty">
              <div className="intelligence-orb">
                <Sparkles size={22} />
              </div>
              <h2>No analysis selected</h2>
              <p>
                Run Campaign Brain to inspect platform fit, workflow risks and
                publishing readiness.
              </p>
            </section>
          ) : (
            <>
              <section className="intelligence-summary-grid">
                <div className="intelligence-summary-card">
                  <div className="intelligence-card-label">
                    OPERATIONAL ASSESSMENT
                  </div>
                  <p>{insight.analysis.summary}</p>
                </div>

                <div className="intelligence-readiness-card">
                  <div className="intelligence-card-label">
                    AI READINESS
                  </div>
                  <div
                    className={`intelligence-readiness ${
                      insight.analysis.readiness === "READY"
                        ? "ready"
                        : insight.analysis.readiness === "BLOCKED"
                        ? "blocked"
                        : "review"
                    }`}
                  >
                    {insight.analysis.readiness.replace("_", " ")}
                  </div>
                  <small>
                    v{insight.version} · {insight.provider} / {insight.model}
                  </small>
                </div>
              </section>

              <section className="intelligence-platform-grid">
                {(["discord", "mastodon"] as const).map(platform => {
                  const platformInsight =
                    insight.analysis.platforms[platform];

                  return (
                    <div className="intelligence-platform-card" key={platform}>
                      <div className="intelligence-card-label">
                        PLATFORM INTELLIGENCE
                      </div>
                      <h2 className="capitalize">{platform}</h2>

                      <p className="intelligence-assessment">
                        {platformInsight.assessment}
                      </p>

                      <div className="intelligence-copy-box">
                        <div className="intelligence-card-label">
                          SUGGESTED COPY
                        </div>
                        <div>{platformInsight.suggestedCopy}</div>
                      </div>

                      <div className="intelligence-reasons">
                        {platformInsight.reasons.map((reason, index) => (
                          <div key={index}>
                            <Check size={13} />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>

                      <div className="intelligence-platform-actions">
                        <button
                          type="button"
                          className="intelligence-apply-button"
                          onClick={() => applyPlatformSuggestion(platform)}
                          disabled={
                            applyingPlatform === platform ||
                            !platformInsight.suggestedCopy.trim()
                          }
                        >
                          <Sparkles size={14} />
                          {applyingPlatform === platform
                            ? "Applying & re-analyzing..."
                            : `Apply ${
                                platform === "discord"
                                  ? "Discord"
                                  : "Mastodon"
                              } suggestion`}
                        </button>

                        <span>
                          Creates a new version and requires re-approval.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="intelligence-detail-grid">
                <div className="intelligence-detail-card">
                  <div className="intelligence-card-label">
                    RISKS DETECTED
                  </div>

                  {insight.analysis.risks.length === 0 ? (
                    <div className="intelligence-no-risk">
                      No material risks detected.
                    </div>
                  ) : (
                    <div className="intelligence-risk-list">
                      {insight.analysis.risks.map((risk, index) => (
                        <div className="intelligence-risk" key={index}>
                          <span
                            className={`risk-level ${risk.severity.toLowerCase()}`}
                          >
                            {risk.severity}
                          </span>
                          <div>
                            <strong>{risk.area}</strong>
                            <p>{risk.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="intelligence-detail-card">
                  <div className="intelligence-card-label">
                    NEXT BEST ACTIONS
                  </div>

                  <div className="intelligence-actions-list">
                    {insight.analysis.nextActions.map((action, index) => (
                      <div key={index}>
                        <span>{index + 1}</span>
                        <p>{action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {history.length > 1 && (
                <section className="intelligence-history">
                  <div className="intelligence-card-label">
                    INTELLIGENCE HISTORY
                  </div>

                  <div className="intelligence-history-row">
                    {history.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setInsight(item)}
                        className={insight.id === item.id ? "is-active" : ""}
                      >
                        v{item.version}
                        <small>
                          {new Date(item.createdAt).toLocaleString()}
                        </small>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function load() {
    const raw = await api<unknown>("/api/review-queue");
    setItems(normalizeCollection<ReviewQueueItem>(raw, ["queue", "reviewQueue"]));
  }

  useEffect(() => {
    load().catch(e =>
      setError(e instanceof Error ? e.message : "Unable to load review queue.")
    );
  }, []);

  async function act(
    campaignId: string,
    action: "approve" | "reopen"
  ) {
    setWorkingId(campaignId);
    setError("");

    try {
      await api(`/api/campaigns/${campaignId}/${action}`, {
        method: "POST"
      });

      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update review workflow."
      );
    } finally {
      setWorkingId(null);
    }
  }

  const needsReview = items.filter(item => item.status === "IN_REVIEW");
  const approved = items.filter(item => item.status === "APPROVED");

  return (
    <Page
      title="Review Queue"
      eyebrow="Approval operations"
      subtitle="A real-time view of campaigns waiting for review, blocked by feedback, or approved for publishing."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted">
            In review
          </div>
          <div className="mt-2 text-3xl font-semibold">{needsReview.length}</div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted">
            Blocked by notes
          </div>
          <div className="mt-2 text-3xl font-semibold">
            {
              needsReview.filter(
                item => item.unresolvedCurrentVersion > 0
              ).length
            }
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted">
            Approved
          </div>
          <div className="mt-2 text-3xl font-semibold">{approved.length}</div>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Needs attention
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
              Campaigns in review
            </h2>
          </div>

          <button
            onClick={() => load().catch(console.error)}
            className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium"
          >
            Refresh
          </button>
        </div>

        {needsReview.length === 0 ? (
          <div className="mt-5 border-y border-line py-12 text-center text-sm text-muted">
            Nothing is waiting for review.
          </div>
        ) : (
          <div className="mt-5 divide-y divide-line border-y border-line">
            {needsReview.map(item => (
              <div
                key={item.id}
                className="grid gap-5 py-6 lg:grid-cols-[1fr_220px_180px] lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{item.title}</div>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      IN REVIEW
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-muted">
                    Version {item.contentVersion}
                    {item.approvedVersion != null
                      ? ` · Approved v${item.approvedVersion}`
                      : " · No approved version"}
                  </div>

                  <div className="mt-1 text-xs text-muted">
                    Updated {new Date(item.updatedAt).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">
                    Current-version feedback
                  </div>

                  <div
                    className={`mt-2 text-sm font-medium ${
                      item.unresolvedCurrentVersion > 0
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {item.unresolvedCurrentVersion > 0
                      ? `${item.unresolvedCurrentVersion} unresolved`
                      : "All notes resolved"}
                  </div>

                  {(item.currentVersionComments ?? []).length > 0 && (
                    <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted">
                      {(item.currentVersionComments ?? [])[0]?.message}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => act(item.id, "approve")}
                    disabled={
                      workingId === item.id ||
                      !item.readyForApproval
                    }
                    className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-35"
                  >
                    {workingId === item.id
                      ? "Working..."
                      : item.readyForApproval
                      ? "Approve campaign"
                      : "Resolve notes first"}
                  </button>

                  <button
                    onClick={() => act(item.id, "reopen")}
                    disabled={workingId === item.id}
                    className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-40"
                  >
                    Reopen draft
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Approved
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          Ready for publishing
        </h2>

        {approved.length === 0 ? (
          <div className="mt-5 border-y border-line py-12 text-center text-sm text-muted">
            No approved campaigns are waiting to publish.
          </div>
        ) : (
          <div className="mt-5 divide-y divide-line border-y border-line">
            {approved.map(item => (
              <div
                key={item.id}
                className="grid gap-4 py-5 md:grid-cols-[1fr_180px_150px] md:items-center"
              >
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="mt-1 text-xs text-muted">
                    Version {item.contentVersion} · Approved v
                    {item.approvedVersion ?? "—"}
                  </div>
                </div>

                <div className="text-sm font-medium text-emerald-700">
                  {item.readyForPublish
                    ? "Ready to publish"
                    : "Approval mismatch"}
                </div>

                <NavLink
                  to="/campaigns"
                  className="rounded-xl border border-line bg-white px-4 py-2.5 text-center text-sm font-medium"
                >
                  Open campaign
                </NavLink>
              </div>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}

function CalendarPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [platform, setPlatform] = useState<PlatformKey>("discord");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [campaignRaw, scheduleRaw, connectionRaw] = await Promise.all([
      api<unknown>("/api/campaigns"),
      api<unknown>("/api/schedules"),
      api<unknown>("/api/connections")
    ]);

    const campaignData = normalizeCollection<Campaign>(campaignRaw, ["campaigns"]);
    const scheduleData = normalizeCollection<ScheduleRecord>(scheduleRaw, ["schedules"]);
    const connectionData = normalizeConnections(connectionRaw);

    setCampaigns(campaignData);
    setSchedules(scheduleData);
    setConnections(connectionData);

    if (campaignData.length > 0) {
      setCampaignId(current => current || campaignData[0].id);
    }

    setPlatform(current => {
      if (connectionData.some(item => item.platform === current && item.connected)) return current;
      const fallback = connectionData.find(item => item.connected && PLATFORM_KEYS.includes(item.platform as PlatformKey));
      return fallback ? (fallback.platform as PlatformKey) : current;
    });
  }

  useEffect(() => {
    load().catch(e =>
      setError(e instanceof Error ? e.message : "Unable to load schedules.")
    );

    const timer = window.setInterval(() => {
      load().catch(console.error);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  async function createSchedule(e: React.FormEvent) {
    e.preventDefault();

    if (!campaignId || !scheduledAt) {
      setError("Choose a campaign and date/time.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const localDate = new Date(scheduledAt);

      if (Number.isNaN(localDate.getTime())) {
        throw new Error("Choose a valid date and time.");
      }

      await api("/api/schedules", {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          platform,
          scheduledAt: localDate.toISOString()
        })
      });

      setScheduledAt("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to schedule campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelSchedule(id: string) {
    setError("");

    try {
      await api(`/api/schedules/${id}/cancel`, {
        method: "POST"
      });

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to cancel schedule.");
    }
  }

  const upcoming = schedules.filter(item =>
    item.status === "SCHEDULED" || item.status === "PROCESSING"
  );

  const history = schedules.filter(item =>
    item.status !== "SCHEDULED" && item.status !== "PROCESSING"
  );

  return (
    <Page
      title="Calendar"
      eyebrow="Scheduled publishing"
      subtitle="Choose a real campaign and Postura will publish it automatically at the scheduled time."
    >
      <div className="grid gap-10 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={createSchedule}
          className="h-fit rounded-[28px] border border-line bg-white p-6 shadow-float"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Schedule delivery
          </div>

          <h2 className="mt-3 text-xl font-semibold">Plan a publish</h2>

          <label className="mt-6 block text-sm font-medium">Campaign</label>
          <select
            value={campaignId}
            onChange={e => setCampaignId(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-brand"
          >
            {campaigns.length === 0 && <option value="">No campaigns available</option>}
            {campaigns.map(campaign => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title}
              </option>
            ))}
          </select>

          <label className="mt-6 block text-sm font-medium">Platform</label>
          <select
            value={platform}
            onChange={e => setPlatform(e.target.value as PlatformKey)}
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-brand"
          >
            {PLATFORM_KEYS.map(key => {
              const connection = connections.find(item => item.platform === key);
              return (
                <option key={key} value={key} disabled={!connection?.connected}>
                  {platformLabel(key)}{connection?.connected ? "" : " · disconnected"}
                </option>
              );
            })}
          </select>

          <label className="mt-6 block text-sm font-medium">Date and time</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-brand"
          />

          <div className="mt-3 rounded-xl bg-canvas px-4 py-3 text-xs leading-5 text-muted">
            The time is interpreted in your browser's local timezone and converted to an exact UTC timestamp before it is stored.
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            disabled={saving || !campaignId || !scheduledAt}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            <CalendarDays size={16} />
            {saving ? "Scheduling..." : "Schedule publish"}
          </button>
        </form>

        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Upcoming
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                Publishing queue
              </h2>
              <div className="mt-2 text-xs text-muted">
                Updates automatically every 5 seconds.
              </div>
            </div>

            <button
              onClick={() => load().catch(console.error)}
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium"
            >
              Live · 5s
            </button>
          </div>

          {upcoming.length === 0 ? (
            <div className="mt-5 border-y border-line py-12 text-sm text-muted">
              Nothing is scheduled yet.
            </div>
          ) : (
            <div className="mt-5 divide-y divide-line border-y border-line">
              {upcoming.map(item => (
                <div
                  key={item.id}
                  className="grid gap-4 py-5 md:grid-cols-[1fr_190px_120px] md:items-center"
                >
                  <div>
                    <div className="font-medium">{item.campaign?.title ?? "Campaign"}</div>
                    <div className="mt-1 text-xs text-muted">
                      {platformLabel(item.platform as PlatformKey)} · {item.status}
                    </div>
                  </div>

                  <div className="text-sm">
                    {new Date(item.scheduledAt).toLocaleString()}
                  </div>

                  <button
                    onClick={() => cancelSchedule(item.id)}
                    disabled={item.status !== "SCHEDULED"}
                    className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}

          {history.length > 0 && (
            <section className="mt-10">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Schedule history
              </div>

              <div className="mt-4 divide-y divide-line border-y border-line">
                {history.map(item => (
                  <div
                    key={item.id}
                    className="grid gap-3 py-5 md:grid-cols-[1fr_180px_120px] md:items-center"
                  >
                    <div>
                      <div className="font-medium">{item.campaign?.title ?? "Campaign"}</div>
                      <div className="mt-1 text-xs text-muted">
                        {new Date(item.scheduledAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="text-sm text-muted">
                      {item.executedAt
                        ? `Executed ${new Date(item.executedAt).toLocaleString()}`
                        : "Not executed"}
                    </div>

                    <div
                      className={`text-sm font-medium ${
                        item.status === "PUBLISHED"
                          ? "text-emerald-700"
                          : item.status === "FAILED"
                          ? "text-red-700"
                          : "text-muted"
                      }`}
                    >
                      {item.status}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Page>
  );
}

function PublishingPage() {
  const [publications, setPublications] = useState<PublicationRecord[]>([]);
  const [selected, setSelected] = useState<PublicationRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<unknown>("/api/publications")
      .then(data => setPublications(normalizeCollection<PublicationRecord>(data, ["publications"])))
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load publishing history."));
  }, []);

  return (
    <Page
      title="Publishing"
      eyebrow="Delivery operations"
      subtitle="Every row below comes from a real publish attempt stored by Postura."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {publications.length === 0 ? (
        <div className="border-y border-line py-16 text-center">
          <div className="text-sm font-medium">No delivery receipts yet.</div>
          <div className="mt-2 text-sm text-muted">
            Publish a campaign and its real platform receipt will appear here.
          </div>
        </div>
      ) : (
        <div className="max-w-6xl">
          <div className="mb-3 hidden grid-cols-[1.5fr_120px_120px_110px_120px_42px] gap-4 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted md:grid">
            <div>Campaign</div>
            <div>Platform</div>
            <div>Status</div>
            <div>HTTP</div>
            <div>Latency</div>
            <div />
          </div>

          <div className="divide-y divide-line border-y border-line">
            {publications.map(pub => (
              <button
                key={pub.id}
                onClick={() => setSelected(pub)}
                className="grid w-full gap-3 py-5 text-left transition hover:bg-white/60 md:grid-cols-[1.5fr_120px_120px_110px_120px_42px] md:items-center md:gap-4 md:px-1"
              >
                <div>
                  <div className="font-medium">{pub.campaign?.title ?? "Campaign"}</div>
                  <div className="mt-1 text-xs text-muted">
                    {new Date(pub.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="text-sm capitalize text-muted">{pub.platform}</div>

                <div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      pub.status === "PUBLISHED"
                        ? "bg-emerald-50 text-emerald-700"
                        : pub.status === "FAILED"
                        ? "bg-red-50 text-red-700"
                        : "bg-[#F0EEFF] text-brand"
                    }`}
                  >
                    {pub.status}
                  </span>
                </div>

                <div className="text-sm font-medium">
                  {pub.httpStatus ?? "—"}
                </div>

                <div className="text-sm text-muted">
                  {pub.latencyMs != null ? `${pub.latencyMs} ms` : "—"}
                </div>

                <div className="text-right text-muted">
                  <ArrowUpRight size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-line bg-white p-7 shadow-float">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                  Delivery receipt
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                  {selected.campaign?.title ?? "Campaign"}
                </h3>
                <div className="mt-2 text-sm text-muted">
                  {new Date(selected.createdAt).toLocaleString()}
                </div>
              </div>

              <span
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  selected.status === "PUBLISHED"
                    ? "bg-emerald-50 text-emerald-700"
                    : selected.status === "FAILED"
                    ? "bg-red-50 text-red-700"
                    : "bg-[#F0EEFF] text-brand"
                }`}
              >
                {selected.status}
              </span>
            </div>

            <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
              <ReceiptItem label="Platform" value={selected.platform} />
              <ReceiptItem label="HTTP status" value={String(selected.httpStatus ?? "—")} />
              <ReceiptItem
                label="Latency"
                value={selected.latencyMs != null ? `${selected.latencyMs} ms` : "—"}
              />
              <ReceiptItem label="Message ID" value={selected.externalId ?? "—"} />
              <ReceiptItem
                label="Attempts"
                value={String(selected.attemptCount ?? 1)}
              />
              <ReceiptItem
                label="Retry-After"
                value={selected.retryAfterMs != null ? `${selected.retryAfterMs} ms` : "—"}
              />
              <ReceiptItem label="Publication ID" value={selected.id} />
              <ReceiptItem label="Idempotency key" value={selected.idempotencyKey} />
            </div>

            {selected.errorMessage && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {selected.errorMessage}
              </div>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              {selected.externalUrl && (
                <a
                  href={selected.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white"
                >
                  View live message
                  <ArrowUpRight size={15} />
                </a>
              )}

              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium"
              >
                Close receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api<unknown>("/api/activity");
      setEvents(normalizeCollection<ActivityEvent>(data, ["events", "activity"]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load activity.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Page title="Activity" eyebrow="Audit trail" subtitle="Real product events, publish attempts, workflow changes, and delivery outcomes from the backend.">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="text-sm text-muted">{loading ? "Syncing audit trail…" : `${events.length} recorded events`}</div>
        <button onClick={load} disabled={loading} className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium disabled:opacity-40">
          {loading ? "Refreshing…" : "Refresh activity"}
        </button>
      </div>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {events.length === 0 && !loading ? (
        <div className="border-y border-line py-16 text-center text-sm text-muted">No activity has happened yet.</div>
      ) : (
        <div className="max-w-4xl divide-y divide-line border-y border-line">
          {events.map(event => (
            <div key={event.id} className="grid gap-2 py-5 md:grid-cols-[150px_1fr]">
              <div className="text-xs text-muted">{new Date(event.createdAt).toLocaleString()}</div>
              <div>
                <div className="text-sm font-medium">{event.message}</div>
                <div className="mt-1 text-xs text-muted">{event.campaign?.title ?? event.type}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

function SettingsPage() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [constraints, setConstraints] = useState<ConstraintProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    const [healthResult, connectionResult, constraintResult] = await Promise.allSettled([
      api<ApiHealth>("/api/health"),
      api<ConnectionsResponse>("/api/connections"),
      api<unknown>("/api/constraint-profiles")
    ]);

    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    else setHealth(null);

    if (connectionResult.status === "fulfilled") setConnections(normalizeConnections(connectionResult.value));
    else setConnections([]);

    if (constraintResult.status === "fulfilled") {
      setConstraints(normalizeCollection<ConstraintProfile>(constraintResult.value, ["profiles", "constraints"]));
    } else setConstraints([]);

    if ([healthResult, connectionResult, constraintResult].every(result => result.status === "rejected")) {
      setError("POSTURA API is not reachable. Start the API and refresh this page.");
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const realPublishers = connections.filter(item => item.mode === "live");
  const activePublishers = realPublishers.filter(item => item.connected).length;

  return (
    <Page title="Settings" eyebrow="System control" subtitle="Live configuration visibility from the API — service health, publisher readiness, and executable platform constraints.">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={`h-2.5 w-2.5 rounded-full ${health?.ok ? "bg-emerald-500" : "bg-red-400"}`} />
          {loading ? "Checking system…" : health?.ok ? `${health.service} online` : "API offline"}
        </div>
        <button onClick={load} disabled={loading} className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium disabled:opacity-40">
          {loading ? "Checking…" : "Refresh system"}
        </button>
      </div>

      {error ? <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted">API</div>
          <div className="mt-2 text-2xl font-semibold">{health?.ok ? "ONLINE" : loading ? "…" : "OFFLINE"}</div>
          <div className="mt-2 text-xs text-muted">{health?.service ?? "No service response"}</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted">Real publishers</div>
          <div className="mt-2 text-2xl font-semibold">{activePublishers}/{realPublishers.length || 0}</div>
          <div className="mt-2 text-xs text-muted">Configured live publishing adapters</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted">Constraint profiles</div>
          <div className="mt-2 text-2xl font-semibold">{constraints.length}</div>
          <div className="mt-2 text-xs text-muted">Executable backend rules loaded</div>
        </div>
      </div>

      <section className="mt-10">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Publishers</div>
        <div className="mt-4 max-w-4xl divide-y divide-line border-y border-line">
          {connections.map(connection => (
            <div key={connection.platform} className="flex items-center justify-between gap-5 py-5">
              <div>
                <div className="font-medium">{connection.label}</div>
                <div className="mt-1 text-xs text-muted">{connection.mode === "live" ? "Real adapter" : "Local mock adapter"}</div>
              </div>
              <div className={connection.connected ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-muted"}>
                {connection.connected ? "Ready" : "Not configured"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Platform constraints</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {constraints.map(profile => (
            <article key={profile.platform} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm">{profile.platform}</strong>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">ENFORCED</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted">Max length</span><div className="mt-1 font-medium">{profile.maxLength}</div></div>
                <div><span className="text-muted">Hashtags</span><div className="mt-1 font-medium">{profile.maxHashtags}</div></div>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted">{profile.tone}</p>
            </article>
          ))}
        </div>
      </section>
    </Page>
  );
}

function Page({ title, eyebrow, subtitle, children }: { title: string; eyebrow: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="product-page">
      <header className="product-page-header">
        <div>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="product-page-description">{subtitle}</div>
      </header>

      <div className="product-page-body">{children}</div>
    </div>
  );
}

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
        <Route path="/review" element={<ReviewQueuePage />} />
        <Route path="/new" element={<NewCampaignPage />} />
        <Route path="/connections" element={<ConnectionsPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/publishing" element={<PublishingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Shell>
  );
}

export default App;

