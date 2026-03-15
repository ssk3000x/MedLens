import { NextRequest, NextResponse } from 'next/server'

const SUMMARY_SERVER_URL = process.env.SUMMARY_SERVER_URL || 'https://medlens-backend-88029418749.us-central1.run.app'

/**
 * POST /api/summarize
 * Proxies to summary server. Accepts { transcript, userId } in the body.
 * userId is used by the summary server to scope the Firestore write to the user.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const res = await fetch(`${SUMMARY_SERVER_URL}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), // passes through transcript + userId as-is
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('Summarize proxy error:', err)
    return NextResponse.json({ error: 'Failed to reach summary server' }, { status: 502 })
  }
}