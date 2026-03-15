import { NextRequest, NextResponse } from 'next/server'

const SUMMARY_SERVER_URL = process.env.SUMMARY_SERVER_URL || 'https://medlens-backend-88029418749.us-central1.run.app'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const res = await fetch(`${SUMMARY_SERVER_URL}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const text = await res.text()
      console.error('Articles proxy: non-JSON response from backend:', text.slice(0, 200))
      return NextResponse.json(
        { error: 'Summary server returned an invalid response. Is it running?' },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('Articles proxy error:', err)
    return NextResponse.json(
      { error: 'Could not connect to the summary server. Make sure it is running on port 8082.' },
      { status: 502 }
    )
  }
}
