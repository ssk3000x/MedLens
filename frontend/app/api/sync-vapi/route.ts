import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://medlens-backend-88029418749.us-central1.run.app'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const res = await fetch(`${BACKEND_URL}/save-vapi-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const text = await res.text()
      console.error('sync-vapi proxy: non-JSON response:', text.slice(0, 200))
      return NextResponse.json(
        { error: 'Backend returned an invalid response.' },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('sync-vapi proxy error:', err)
    return NextResponse.json(
      { error: 'Could not connect to backend.' },
      { status: 502 }
    )
  }
}