import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('google_fit_access_token')?.value || null
    const refresh = request.cookies.get('google_fit_refresh_token')?.value || null
    return NextResponse.json({ accessToken: token, refreshToken: refresh })
  } catch (err) {
    console.error('Token bridge error', err)
    return NextResponse.json({ accessToken: null }, { status: 500 })
  }
}
