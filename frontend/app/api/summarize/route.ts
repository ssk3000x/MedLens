import { NextRequest, NextResponse } from 'next/server'

const SUMMARY_BACKEND = 'http://localhost:8082'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const res = await fetch(`${SUMMARY_BACKEND}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Summarize proxy error:', error.message)
    return NextResponse.json(
      { summary: 'Summary unavailable — backend could not be reached.', method: 'error' },
      { status: 502 }
    )
  }
}
