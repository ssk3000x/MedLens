"use client"

import { useState, useEffect } from "react"
import {
  BookOpen,
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
  Download,
  Phone,
  User,
  Pill,
  RefreshCw,
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ── Call History Grid ──────────────────────────────────────────────────────

function CallHistoryGrid({ userId, refreshTrigger }: { userId: string; refreshTrigger: number }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'one-on-one' | 'deployed'>('all')

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`/api/sessions?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        const sorted = (data.sessions || []).sort((a: SessionRecord, b: SessionRecord) => {
          const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
          const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
          return tb - ta
        })
        setSessions(sorted)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId, refreshTrigger])

  const filtered = sessions.filter((s) => {
    if (filter === 'one-on-one') return s.method === 'claude' || s.method === 'gemini' || !s.method || s.method === 'unknown'
    if (filter === 'deployed') return s.method === 'vapi' || s.method === 'voice-agent'
    return true
  })

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
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted w-fit">
        {[
          { key: 'all' as const, label: 'All' },
          { key: 'one-on-one' as const, label: 'One-on-One', icon: <User className="size-3" /> },
          { key: 'deployed' as const, label: 'Deployed Calls', icon: <Phone className="size-3" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              filter === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground text-sm">
          <History className="size-6 opacity-30" />
          <p>No {filter === 'deployed' ? 'deployed call' : 'one-on-one'} sessions found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((session) => {
            const isExpanded = expandedId === session.sessionId
            const isDeployed = session.method === 'vapi' || session.method === 'voice-agent'
            return (
              <div
                key={session.sessionId}
                className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${
                  isExpanded ? 'bg-card border-primary/30 sm:col-span-2' : 'bg-card border-border'
                }`}
              >
                <button
                  className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : session.sessionId)}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className={`flex items-center justify-center size-5 rounded-full flex-shrink-0 ${
                        isDeployed ? 'bg-violet-500/10 text-violet-500' : 'bg-primary/10 text-primary'
                      }`}>
                        {isDeployed ? <Phone className="size-2.5" /> : <User className="size-2.5" />}
                      </div>
                      <span>{formatDate(session.timestamp)}</span>
                      {session.timestamp && (
                        <>
                          <span className="text-border">·</span>
                          <span>{formatTime(session.timestamp)}</span>
                        </>
                      )}
                    </div>
                    {session.summary[0] && (
                      <p className="text-sm text-foreground font-medium leading-snug truncate">
                        {session.summary[0]}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isDeployed ? 'bg-violet-500/10 text-violet-500' : 'bg-primary/10 text-primary'
                      }`}>
                        {isDeployed ? 'Deployed' : 'One-on-One'}
                      </span>
                      {session.actionItems.length > 0 && (
                        <div className="flex items-center gap-1">
                          <ListChecks className="size-3 text-primary" />
                          <span className="text-[10px] text-primary font-medium">
                            {session.actionItems.length} action item{session.actionItems.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 mt-1 text-muted-foreground">
                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border pt-3">
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
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export function SummaryDashboard({ onBack, summary }: { onBack: () => void; summary?: any }) {
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [recipientType, setRecipientType] = useState<'Doctor' | 'Pharmacist'>('Doctor')
  const [deploying, setDeploying] = useState(false)
  const [deployed, setDeployed] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [articlesOpen, setArticlesOpen] = useState(false)
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articles, setArticles] = useState<{ title: string; url: string; snippet: string; source: string }[]>([])
  const [articlesError, setArticlesError] = useState<string | null>(null)
  const [mapsOpen, setMapsOpen] = useState(false)

  // VAPI sync state
  const [pendingVapiCallId, setPendingVapiCallId] = useState<string | null>(null)
  const [pendingVapiRecipientType, setPendingVapiRecipientType] = useState<string>('Doctor')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<'success' | 'error' | null>(null)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)

  useEffect(() => {
    fetch('/api/user')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.userId) setUserId(data.userId) })
      .catch(() => {})
  }, [])

  const runtimeMeds = summary?.medications || null
  const runtimeSummaryRaw = summary?.aiSummary || summary?.summaryText || null
  const runtimeTranscript = summary?.transcript || null
  const runtimeActionItems: string[] = summary?.actionItems || []

  const summaryBullets: string[] = (() => {
    let src = runtimeSummaryRaw
    if (!src) return []
    if (typeof src === 'object') {
      if (Array.isArray(src)) src = src.join('\n')
      else if (src.summary) src = Array.isArray(src.summary) ? src.summary.join('\n') : String(src.summary)
      else src = JSON.stringify(src)
    }
    if (typeof src === 'string') {
      try {
        const parsed = JSON.parse(src)
        if (Array.isArray(parsed)) src = parsed.join('\n')
        else if (parsed?.summary) src = Array.isArray(parsed.summary) ? parsed.summary.join('\n') : String(parsed.summary)
      } catch (_) {}
    }
    return String(src)
      .split(/\n|•/)
      .map((l: string) => l.replace(/^[\-\s"]+|["]+$/g, '').trim())
      .filter((l: string) => l.length > 0)
  })()

  const handleSyncVapiCall = async () => {
    if (!pendingVapiCallId || !userId) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync-vapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: pendingVapiCallId,
          userId,
          recipientType: pendingVapiRecipientType,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      setSyncResult('success')
      setHistoryRefreshTrigger((n) => n + 1)
    } catch {
      setSyncResult('error')
    } finally {
      setSyncing(false)
    }
  }

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

      <main className="px-6 py-8 max-w-6xl mx-auto flex flex-col gap-8">
        {/* AI Disclaimer */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-warning/10">
          <AlertTriangle className="size-5 text-warning-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning-foreground leading-relaxed">
            This summary was generated by an AI assistant and has not been reviewed by a medical professional. Always consult your doctor before making changes to your medication regimen.
          </p>
        </div>

        {/* Session Summary + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Session summary */}
          <div className="lg:col-span-3">
            {summaryBullets.length > 0 ? (
              <div className="flex flex-col items-start gap-3 p-6 rounded-2xl bg-card border border-border h-full">
                <h2 className="text-lg font-semibold text-foreground">This Session</h2>
                <ul className="flex flex-col gap-2.5 w-full">
                  {summaryBullets.map((line, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                      <span className="mt-1 size-1.5 rounded-full bg-primary flex-shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
                {runtimeActionItems.length > 0 && (
                  <div className="w-full mt-2 pt-4 border-t border-border">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Action Items
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {runtimeActionItems.map((item, i) => (
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
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-primary/5 border border-primary/20 h-full justify-center">
                <div className="flex items-center justify-center size-16 rounded-full bg-primary/10">
                  <ShieldCheck className="size-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">No Critical Interactions Found</h2>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  All detected medications have been cross-checked against FDA databases.
                </p>
              </div>
            )}
          </div>

          {/* Right: Quick Actions */}
          <div className="lg:col-span-2">
            <div className="flex flex-col gap-3 h-full">
              <h2 className="text-lg font-semibold text-foreground text-center">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3 flex-1">
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
                  icon={<Download className="size-5" />}
                  title="Export as PDF"
                  description="Download session summary as a PDF report"
                  onClick={() => {
                    const doc = document.createElement('div')
                    doc.style.cssText = 'font-family:system-ui,sans-serif;color:#111;max-width:700px;margin:0 auto;padding:40px'
                    const title = `<h1 style="font-size:22px;margin-bottom:4px">MedLens Session Report</h1>`
                    const date = `<p style="font-size:13px;color:#666;margin-bottom:24px">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>`
                    const disclaimer = `<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:12px;font-size:12px;color:#856404;margin-bottom:24px">⚠ This summary was generated by an AI assistant and has not been reviewed by a medical professional.</div>`
                    const summaryHtml = summaryBullets.length > 0 ? `<h2 style="font-size:16px;margin-bottom:8px">Session Summary</h2><ul style="padding-left:18px;margin-bottom:20px">${summaryBullets.map(b => `<li style="font-size:13px;color:#444;margin-bottom:6px;line-height:1.5">${b}</li>`).join('')}</ul>` : ''
                    const actionsHtml = runtimeActionItems.length > 0 ? `<h2 style="font-size:16px;margin-bottom:8px">Action Items</h2><ul style="padding-left:18px;margin-bottom:20px">${runtimeActionItems.map(a => `<li style="font-size:13px;color:#444;margin-bottom:6px;line-height:1.5">✓ ${a}</li>`).join('')}</ul>` : ''
                    const transcriptHtml = runtimeTranscript?.length > 0 ? `<h2 style="font-size:16px;margin-bottom:8px">Transcript</h2><div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:20px">${runtimeTranscript.map((t: any) => `<p style="font-size:12px;margin:4px 0;color:#555"><strong style="text-transform:uppercase;font-size:10px;letter-spacing:0.5px;margin-right:6px">${t.speaker}</strong>${t.text}</p>`).join('')}</div>` : ''
                    const footer = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px"/><p style="font-size:11px;color:#999;text-align:center">Generated by MedLens · Not a substitute for professional medical advice</p>`
                    doc.innerHTML = title + date + disclaimer + summaryHtml + actionsHtml + transcriptHtml + footer
                    const printWindow = window.open('', '_blank')
                    if (printWindow) {
                      printWindow.document.write(`<!DOCTYPE html><html><head><title>MedLens Report</title><style>@media print{@page{margin:20mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${doc.innerHTML}</body></html>`)
                      printWindow.document.close()
                      setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
                    }
                  }}
                />
                <ActionCard
                  icon={<GeminiIcon className="size-5" />}
                  title="Deploy Gemini Voice Agent"
                  description="Deploy an AI voice agent to call with medication reminders"
                  onClick={() => { if (!deployed) setPhoneDialogOpen(true) }}
                  disabled={deployed}
                />
                <ActionCard
                  icon={<GoogleMapsIcon className="size-5" />}
                  title="Find Nearby Resources"
                  description="Pharmacies & clinics via Google Maps"
                  onClick={() => setMapsOpen(true)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* VAPI Sync Banner — appears after a call is deployed */}
        {pendingVapiCallId && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-violet-500/30 bg-violet-500/5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-8 rounded-full bg-violet-500/10">
                <Phone className="size-4 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{pendingVapiRecipientType} call deployed</p>
                <p className="text-xs text-muted-foreground">After the call ends, sync to save the summary to your history.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {syncResult === 'success' && (
                <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Synced
                </span>
              )}
              {syncResult === 'error' && (
                <span className="text-xs text-destructive font-medium">Call may still be in progress — try again shortly</span>
              )}
              <button
                onClick={handleSyncVapiCall}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-medium hover:bg-violet-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {syncing
                  ? <><Loader2 className="size-3.5 animate-spin" /> Syncing…</>
                  : <><RefreshCw className="size-3.5" /> Sync Call Summary</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Call History Grid */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <History className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Call History</h2>
          </div>
          {userId ? (
            <CallHistoryGrid userId={userId} refreshTrigger={historyRefreshTrigger} />
          ) : (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-border text-sm text-muted-foreground">
              <AlertTriangle className="size-4 flex-shrink-0" />
              Connect Google Fit to load your call history.
            </div>
          )}
        </section>

        {/* Related Articles Modal */}
        <Dialog open={articlesOpen} onOpenChange={setArticlesOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                Related Articles
              </DialogTitle>
              <DialogDescription>Curated articles related to topics from your session</DialogDescription>
            </DialogHeader>
            {articlesLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
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
                  const colors = ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500','bg-pink-500']
                  const color = colors[i % colors.length]
                  return (
                    <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                      className="group flex gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all">
                      <div className={`hidden sm:flex items-center justify-center size-14 rounded-lg flex-shrink-0 ${color}/10`}>
                        <Pill className={`size-6 ${color.replace('bg-','text-')}`} />
                      </div>
                      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full w-fit">
                          <Tag className="size-2.5" />{article.source}
                        </span>
                        <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">{article.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{article.snippet}</p>
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

        {/* Google Maps Modal */}
        <Dialog open={mapsOpen} onOpenChange={setMapsOpen}>
          <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
            <DialogHeader className="px-5 pt-5 pb-3">
              <DialogTitle className="flex items-center gap-2">
                <GoogleMapsIcon className="size-5" />
                Find Nearby Resources
              </DialogTitle>
              <DialogDescription>
                Search for pharmacies, clinics, or other resources near you
              </DialogDescription>
            </DialogHeader>
            <div className="w-full h-[500px]">
              <iframe
                title="Google Maps Search"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src="https://maps.google.com/maps?q=pharmacy+OR+clinic+near+me&output=embed"
              />
            </div>
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
              <label className="text-sm font-medium text-foreground">Call Type</label>
              <div className="flex gap-2 mb-2">
                {(['Doctor', 'Pharmacist'] as const).map((type) => (
                  <button key={type} type="button" onClick={() => setRecipientType(type)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      recipientType === type ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'
                    }`}>
                    {type}
                  </button>
                ))}
              </div>
              <label htmlFor="phone-number" className="text-sm font-medium text-foreground">Phone Number</label>
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
                      body: JSON.stringify({ phoneNumber: phoneNumber.trim(), sessionSummary, recipientType }),
                    })
                    if (res.ok) {
                      const data = await res.json()
                      setDeployed(true)
                      setPhoneDialogOpen(false)
                      // Store callId for sync button
                      if (data.callId) {
                        setPendingVapiCallId(data.callId)
                        setPendingVapiRecipientType(recipientType)
                      }
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
              {deployError && <p className="text-xs text-red-500 mt-2 col-span-full">{deployError}</p>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActionCard({ icon, title, description, disabled = false, onClick }: {
  icon: React.ReactNode; title: string; description: string; disabled?: boolean; onClick?: () => void
}) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border text-center transition-all cursor-pointer ${
        disabled ? "border-border bg-muted opacity-50 cursor-not-allowed" : "border-border bg-card hover:shadow-md hover:border-primary/30"
      }`}>
      <div className={`flex items-center justify-center size-8 rounded-lg flex-shrink-0 ${
        disabled ? "bg-muted-foreground/10 text-muted-foreground" : "bg-primary/10 text-primary"
      }`}>{icon}</div>
      <div className="flex flex-col gap-0.5 items-center">
        <span className="text-sm font-semibold text-foreground leading-tight">{title}</span>
        <span className="text-xs text-muted-foreground leading-snug line-clamp-2">{description}</span>
        {disabled && <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Coming Soon</span>}
      </div>
    </button>
  )
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gemini-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1C7CF4" />
          <stop offset="100%" stopColor="#6E42F5" />
        </linearGradient>
      </defs>
      <path
        d="M14 28C14 21.75 9.53 16.57 3.68 15.32C2.47 15.07 1.24 14.89 0 14.82V13.18C1.24 13.11 2.47 12.93 3.68 12.68C9.53 11.43 14 6.25 14 0C14 6.25 18.47 11.43 24.32 12.68C25.53 12.93 26.76 13.11 28 13.18V14.82C26.76 14.89 25.53 15.07 24.32 15.32C18.47 16.57 14 21.75 14 28Z"
        fill="url(#gemini-grad)"
      />
    </svg>
  )
}

function GoogleMapsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.314-.236.684-.627.687-.391.003-.504-.382-.605-.691-.239-.726-.471-1.456-.832-2.128-.475-.886-1.086-1.681-1.694-2.487-1.972-2.608-4.082-5.133-4.772-8.345-.537-2.508-.107-5.186 1.27-7.337C7.604 0.399 11.478-.693 14.892.544c1.685.606 3.154 1.727 4.219 3.146l.416 1.109z" fill="#3E7BF1"/>
      <path d="M19.527 4.799c-1.065-1.419-2.534-2.54-4.219-3.146-1.98-.717-4.155-.702-6.093.118L14.945 7.5l4.582-2.701z" fill="#FDDC4F"/>
      <path d="M5.199 11.1c-.456-1.584-.527-3.27-.088-4.87L9.268 7.5l-4.069 3.6z" fill="#F0513E"/>
      <path d="M9.215 1.771C7.366 2.628 5.819 4.13 5.111 6.23l4.157 1.27 4.677-5.729c-1.522-.753-3.2-1.033-4.73 0z" fill="#E2443F"/>
      <path d="M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" fill="#F0513E"/>
      <path d="M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" fill="#F0513E"/>
      <path d="M12 9a3 3 0 100 6 3 3 0 000-6z" fill="#FFFFFF"/>
    </svg>
  )
}