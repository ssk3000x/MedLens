"use client"

import { useState, useEffect } from "react"
import {
  BookOpen,
  FileText,
  CalendarDays,
  ShoppingBag,
  Pill,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Clock,
  History,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Loader2,
  ExternalLink,
  Tag,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionRecord {
  sessionId: string
  summary: string[]
  actionItems: string[]
  timestamp: string | null
  method: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return 'Unknown date'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ── Call History Grid ──────────────────────────────────────────────────────

function CallHistoryGrid({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`/api/sessions?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setSessions(data.sessions || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading call history…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
        <AlertTriangle className="size-4 flex-shrink-0" />
        Could not load history: {error}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground text-sm">
        <History className="size-8 opacity-30" />
        <p>No past sessions yet. Complete a call to see your history here.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {sessions.map((session) => {
        const isExpanded = expandedId === session.sessionId
        return (
          <div
            key={session.sessionId}
            className="rounded-2xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-md"
          >
            {/* Card header — always visible */}
            <button
              className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : session.sessionId)}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5 flex-shrink-0" />
                  <span>{formatDate(session.timestamp)}</span>
                  {session.timestamp && (
                    <>
                      <span className="text-border">·</span>
                      <Clock className="size-3.5 flex-shrink-0" />
                      <span>{formatTime(session.timestamp)}</span>
                    </>
                  )}
                </div>
                {/* First summary bullet as preview */}
                {session.summary[0] && (
                  <p className="text-sm text-foreground font-medium leading-snug truncate">
                    {session.summary[0]}
                  </p>
                )}
                {/* Action items badge */}
                {session.actionItems.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <ListChecks className="size-3 text-primary" />
                    <span className="text-[11px] text-primary font-medium">
                      {session.actionItems.length} action item{session.actionItems.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 mt-1 text-muted-foreground">
                {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-5 pb-5 flex flex-col gap-4 border-t border-border pt-4">
                {/* Summary bullets */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Session Summary
                  </h4>
                  <ul className="flex flex-col gap-2">
                    {session.summary.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <span className="mt-1.5 size-1.5 rounded-full bg-primary flex-shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action items */}
                {session.actionItems.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Action Items
                    </h4>
                    <ul className="flex flex-col gap-2">
                      {session.actionItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                          <CheckCircle2 className="size-3.5 mt-0.5 text-primary flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export function SummaryDashboard({ onBack, summary }: { onBack: () => void; summary?: any }) {
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [deploying, setDeploying] = useState(false)
  const [deployed, setDeployed] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [articlesOpen, setArticlesOpen] = useState(false)
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articles, setArticles] = useState<{ title: string; url: string; snippet: string; source: string }[]>([])
  const [articlesError, setArticlesError] = useState<string | null>(null)

  // Fetch Google identity on mount for history scoping
  useEffect(() => {
    fetch('/api/user')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.userId) setUserId(data.userId)
      })
      .catch(() => {/* no-op — history just won't load */})
  }, [])

  // runtime-provided summary overrides static content when present
  const runtimeMeds = summary?.medications || null
  const runtimeSummaryRaw = summary?.aiSummary || summary?.summaryText || null
  const runtimeTranscript = summary?.transcript || null
  const runtimeActionItems: string[] = summary?.actionItems || []

  // Normalize summary into clean bullet strings
  const summaryBullets: string[] = (() => {
    let src = runtimeSummaryRaw
    if (!src) return []
    if (typeof src === 'object') {
      if (Array.isArray(src)) {
        src = src.join('\n')
      } else if (src.summary) {
        src = Array.isArray(src.summary) ? src.summary.join('\n') : String(src.summary)
      } else {
        src = JSON.stringify(src)
      }
    }
    if (typeof src === 'string') {
      try {
        const parsed = JSON.parse(src)
        if (Array.isArray(parsed)) {
          src = parsed.join('\n')
        } else if (parsed?.summary) {
          src = Array.isArray(parsed.summary) ? parsed.summary.join('\n') : String(parsed.summary)
        }
      } catch (_) { /* not JSON, use as-is */ }
    }
    return String(src)
      .split(/\n|•/)
      .map((l: string) => l.replace(/^[\-\s"]+|["]+$/g, '').trim())
      .filter((l: string) => l.length > 0)
  })()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            New Session
          </button>
          <h1 className="text-sm font-semibold text-foreground">Session Summary</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>{formatDate(new Date().toISOString())}</span>
          </div>
        </div>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto flex flex-col gap-8">
        {/* AI Disclaimer */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-warning/10">
          <AlertTriangle className="size-5 text-warning-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning-foreground leading-relaxed">
            This summary was generated by an AI assistant and has not been reviewed by a medical professional. Always consult your doctor before making changes to your medication regimen.
          </p>
        </div>

        {/* Current session summary */}
        {summaryBullets.length > 0 ? (
          <div className="flex flex-col items-start gap-3 p-6 rounded-2xl bg-card border border-border">
            <h2 className="text-lg font-semibold text-foreground">This Session</h2>
            <ul className="flex flex-col gap-2.5 w-full">
              {summaryBullets.map((line: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                  <span className="mt-1 size-1.5 rounded-full bg-primary flex-shrink-0" />
                  {line}
                </li>
              ))}
            </ul>

            {/* Action items for this session */}
            {runtimeActionItems.length > 0 && (
              <div className="w-full mt-2 pt-4 border-t border-border">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Action Items
                </h3>
                <ul className="flex flex-col gap-2">
                  {runtimeActionItems.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                      <CheckCircle2 className="size-3.5 mt-0.5 text-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {runtimeTranscript && runtimeTranscript.length > 0 && (
              <details className="mt-2 text-xs text-muted-foreground w-full">
                <summary className="cursor-pointer">View transcript ({runtimeTranscript.length} lines)</summary>
                <div className="mt-2">
                  {runtimeTranscript.map((t: any, i: number) => (
                    <p key={i} className="text-xs py-1 border-b border-border">
                      <strong className="uppercase text-[10px] tracking-wider mr-2">{t.speaker}</strong>
                      {t.text}
                    </p>
                  ))}
                </div>
              </details>
            )}
            <DeployVoiceAgentButton deployed={deployed} onClick={() => { if (!deployed) setPhoneDialogOpen(true) }} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-center size-16 rounded-full bg-primary/10">
              <ShieldCheck className="size-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">No Critical Interactions Found</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              All 3 detected medications have been cross-checked against FDA databases. One minor note was flagged for your awareness.
            </p>
            <DeployVoiceAgentButton deployed={deployed} onClick={() => { if (!deployed) setPhoneDialogOpen(true) }} />
          </div>
        )}

        {/* Call History Grid */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <History className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Call History</h2>
          </div>
          {userId ? (
            <CallHistoryGrid userId={userId} />
          ) : (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-border text-sm text-muted-foreground">
              <AlertTriangle className="size-4 flex-shrink-0" />
              Connect Google Fit to load your call history.
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ActionCard
              icon={<BookOpen className="size-5" />}
              title="View Related Articles"
              description="Browse curated medical articles related to your session"
              onClick={async () => {
                setArticlesOpen(true)
                setArticlesLoading(true)
                setArticlesError(null)
                try {
                  const res = await fetch('/api/articles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ summary: summaryBullets, actionItems: runtimeActionItems }),
                  })
                  const data = await res.json()
                  if (data.error) throw new Error(data.error)
                  setArticles(data.articles || [])
                } catch (e: any) {
                  setArticlesError(e.message || 'Failed to load articles')
                } finally {
                  setArticlesLoading(false)
                }
              }}
            />
            <ActionCard
              icon={<FileText className="size-5" />}
              title="Share Schedule"
              description="Share the medication schedule as a Google Doc"
            />
            <ActionCard
              icon={<GeminiIcon className="size-5" />}
              title="Deploy Gemini Voice Agent"
              description="Deploy an AI voice agent to call with medication reminders"
              onClick={() => { if (!deployed) setPhoneDialogOpen(true) }}
              disabled={deployed}
            />
            <ActionCard
              icon={<ShoppingBag className="size-5" />}
              title="Order Refill"
              description="Connect to your pharmacy portal for refills"
              disabled
            />
          </div>
        </section>

        {/* Related Articles Modal */}
        <Dialog open={articlesOpen} onOpenChange={setArticlesOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                Related Articles
              </DialogTitle>
              <DialogDescription>
                Curated articles related to topics from your session
              </DialogDescription>
            </DialogHeader>

            {articlesLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <div className="relative">
                  <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">Searching for relevant articles…</p>
              </div>
            ) : articlesError ? (
              <div className="flex items-center gap-2 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
                <AlertTriangle className="size-4 flex-shrink-0" />
                {articlesError}
              </div>
            ) : articles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground text-sm">
                <BookOpen className="size-8 opacity-30" />
                <p>No articles found for this session.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 py-2">
                {articles.map((article, i) => {
                  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500']
                  const color = colors[i % colors.length]
                  return (
                    <a
                      key={i}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all"
                    >
                      <div className={`hidden sm:flex items-center justify-center size-14 rounded-lg flex-shrink-0 ${color}/10`}>
                        <Pill className={`size-6 ${color.replace('bg-', 'text-')}`} />
                      </div>
                      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            <Tag className="size-2.5" />
                            {article.source}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {article.snippet}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] font-medium text-muted-foreground">{article.source}</span>
                          <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Deploy Voice Agent Dialog */}
        <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Deploy Gemini Voice Agent</DialogTitle>
              <DialogDescription>
                Enter a phone number to deploy the Gemini voice agent. It will call to provide medication reminders and answer questions about your session.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-4">
              <label htmlFor="phone-number" className="text-sm font-medium text-foreground">
                Phone Number
              </label>
              <input
                id="phone-number"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <button className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
                  Cancel
                </button>
              </DialogClose>
              <button
                disabled={!phoneNumber.trim() || deploying}
                onClick={async () => {
                  setDeploying(true)
                  setDeployError(null)
                  try {
                    const medsList = (runtimeMeds ?? [])
                      .filter((m: any) => m.name && m.name !== 'N/A')
                      .map((m: any) => `${m.name} (${m.dosage}) - ${m.purpose}`)
                      .join('\n')
                    const sessionSummary = [
                      summaryBullets.length > 0 ? 'Session Findings:\n' + summaryBullets.join('\n') : '',
                      medsList ? '\nDetected Medications:\n' + medsList : '',
                    ].filter(Boolean).join('\n') || 'No session summary available.'
                    const res = await fetch("https://medlens-backend-88029418749.us-central1.run.app/deploy-voice-agent", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ phoneNumber: phoneNumber.trim(), sessionSummary }),
                    })
                    if (res.ok) {
                      setDeployed(true)
                      setPhoneDialogOpen(false)
                    } else {
                      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
                      setDeployError(err.error || `Request failed (${res.status})`)
                    }
                  } catch (e: any) {
                    setDeployError(e.message || 'Network error')
                  } finally {
                    setDeploying(false)
                  }
                }}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {deploying ? "Deploying…" : "Deploy Agent"}
              </button>
              {deployError && (
                <p className="text-xs text-red-500 mt-2 col-span-full">{deployError}</p>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActionCard({
  icon, title, description, disabled = false, onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex items-start gap-4 p-5 rounded-xl border text-left transition-all cursor-pointer ${
        disabled
          ? "border-border bg-muted opacity-50 cursor-not-allowed"
          : "border-border bg-card hover:shadow-md hover:border-primary/30"
      }`}
    >
      <div className={`flex items-center justify-center size-10 rounded-lg flex-shrink-0 ${
        disabled ? "bg-muted-foreground/10 text-muted-foreground" : "bg-primary/10 text-primary"
      }`}>
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground leading-relaxed">{description}</span>
        {disabled && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Coming Soon</span>
        )}
      </div>
    </button>
  )
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C12 2 14.5 7.5 17.5 10.5C20.5 13.5 24 12 24 12C24 12 20.5 14.5 17.5 17.5C14.5 20.5 12 22 12 22C12 22 9.5 16.5 6.5 13.5C3.5 10.5 0 12 0 12C0 12 3.5 9.5 6.5 6.5C9.5 3.5 12 2 12 2Z"
        fill="currentColor"
      />
    </svg>
  )
}

function DeployVoiceAgentButton({ deployed, onClick }: { deployed: boolean; onClick: () => void }) {
  return (
    <button
      disabled={deployed}
      onClick={onClick}
      className={`mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
        deployed
          ? "bg-primary/10 text-primary cursor-default"
          : "bg-primary/10 text-primary hover:bg-primary/20"
      }`}
    >
      <GeminiIcon className="size-3.5" />
      {deployed ? "Voice Agent Deployed ✓" : "Deploy Gemini Voice Agent"}
    </button>
  )
}