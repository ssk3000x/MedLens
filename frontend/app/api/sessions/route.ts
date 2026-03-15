import { NextRequest, NextResponse } from 'next/server'

const SUMMARY_SERVER_URL = process.env.SUMMARY_SERVER_URL || 'https://medlens-backend-88029418749.us-central1.run.app'

/**
 * GET /api/sessions?userId=...
 * Proxies to the summary server's GET /sessions/:userId endpoint.
 * Returns the user's full call history from Firestore.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  try {
    const res = await fetch(`${SUMMARY_SERVER_URL}/sessions/${encodeURIComponent(userId)}`)

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      return NextResponse.json(err, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Sessions proxy error:', err)
    return NextResponse.json({ error: 'Failed to reach summary server' }, { status: 502 })
  }
}