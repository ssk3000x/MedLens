import { NextRequest, NextResponse } from 'next/server'

const SUMMARY_SERVER_URL = process.env.SUMMARY_SERVER_URL || 'http://localhost:8082'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const res = await fetch(`${SUMMARY_SERVER_URL}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('Articles proxy error:', err)
    return NextResponse.json({ error: 'Failed to reach summary server' }, { status: 502 })
  }
}
