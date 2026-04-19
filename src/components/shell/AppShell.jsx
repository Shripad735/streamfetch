import Card from "../ui/Card";
import Button from "../ui/Button";
import Separator from "../ui/Separator";
import { cn } from "../../lib/cn";

function NavIcon({ id }) {
  if (id === "new-download") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (id === "active-queue") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h16M4 12h10M4 17h7" />
      </svg>
    );
  }
  if (id === "history") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  );
}

function WindowControl({ label, onClick, danger = false }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app-border bg-app-card text-xs text-app-muted transition-colors duration-200 hover:border-app-borderStrong hover:text-app-text",
        danger && "hover:border-app-dangerBorder hover:bg-app-dangerBg hover:text-app-dangerText"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function AppShell({
  currentView,
  setCurrentView,
  viewItems,
  viewMeta,
  children,
  runningJobId,
  counts,
  hasElectron,
  theme,
  onThemeToggle,
  onOpenRepo,
  onMinimize,
  onToggleMaximize,
  onClose,
  maximized
}) {
  const activeItem = viewItems.find((item) => item.id === currentView) || viewItems[0];

  return (
    <div className="h-screen bg-app-canvas p-3">
      <div className="mx-auto grid h-full max-w-[1680px] grid-cols-1 overflow-hidden rounded-[28px] border border-app-border bg-app-bg shadow-shell lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-app-border bg-app-sidebar lg:flex lg:flex-col">
          <div className="px-5 pb-5 pt-6">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-app-accent text-white shadow-button">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 5v8" />
                  <path d="M8.5 10.5 12 14l3.5-3.5" />
                  <path d="M5 18h14" />
                </svg>
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-app-text">StreamFetch</p>
                <p className="text-xs text-app-muted">Structured desktop downloader</p>
              </div>
            </div>
          </div>

          <div className="px-4">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Workspace</p>
            <nav className="mt-3 space-y-1.5">
              {viewItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentView(item.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-all duration-200",
                    currentView === item.id
                      ? "border-app-borderStrong bg-app-card text-app-text shadow-card"
                      : "border-transparent text-app-muted hover:bg-app-cardMuted hover:text-app-text"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-xl border",
                        currentView === item.id
                          ? "border-app-border bg-app-cardMuted text-app-text"
                          : "border-app-border bg-app-bg text-app-muted"
                      )}
                    >
                      <NavIcon id={item.id} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-app-muted">{item.hint}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-app-cardMuted px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-app-muted">
                    {item.metric}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-4">
            <Card className="bg-app-card/90 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Overview</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div>
                  <p className="text-2xl font-semibold text-app-text">{counts.active}</p>
                  <p className="text-xs text-app-muted">active jobs</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-app-text">{counts.history}</p>
                  <p className="text-xs text-app-muted">history items</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-app-text">{runningJobId ? "Live" : "Idle"}</p>
                  <p className="text-xs text-app-muted">engine state</p>
                </div>
              </div>
            </Card>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <header className="border-b border-app-border px-4 py-3 md:px-6" style={{ WebkitAppRegion: "drag" }}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Workspace</p>
                <div className="mt-1 flex items-center gap-3">
                  <h1 className="truncate font-display text-2xl font-semibold text-app-text">{activeItem.label}</h1>
                  <span className="hidden rounded-full bg-app-cardMuted px-2.5 py-1 text-[11px] font-medium text-app-muted sm:inline-flex">
                    {viewMeta}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" }}>
                <Button size="sm" variant="ghost" onClick={onOpenRepo}>
                  Source
                </Button>
                <Button size="sm" variant="ghost" onClick={onThemeToggle}>
                  {theme === "dark" ? "Light" : "Dark"}
                </Button>
                {hasElectron && (
                  <>
                    <Separator className="hidden h-8 w-px bg-app-border md:block" />
                    <WindowControl label="-" onClick={onMinimize} />
                    <WindowControl label={maximized ? "o" : "+"} onClick={onToggleMaximize} />
                    <WindowControl label="x" onClick={onClose} danger />
                  </>
                )}
              </div>
            </div>
          </header>

          <div className="border-b border-app-border px-3 py-2 lg:hidden">
            <div className="flex gap-2 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {viewItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentView(item.id)}
                  className={cn(
                    "shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-200",
                    currentView === item.id
                      ? "border-app-accent/25 bg-app-card text-app-text"
                      : "border-app-border bg-app-bg text-app-muted"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1">{children}</div>
        </section>
      </div>
    </div>
  );
}

export default AppShell;
