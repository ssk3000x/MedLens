import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''

export async function GET(request: NextRequest) {
  try {
    let token = request.cookies.get('google_fit_access_token')?.value || null
    const refresh = request.cookies.get('google_fit_refresh_token')?.value || null

    // If access token is missing but we have a refresh token, get a new one
    if (!token && refresh && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: refresh,
            grant_type: 'refresh_token',
          }),
        })
        if (res.ok) {
          const data = await res.json()
          token = data.access_token
          // Return fresh token and set updated cookie
          const response = NextResponse.json({ accessToken: token, refreshToken: refresh })
          response.cookies.set('google_fit_access_token', token!, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: data.expires_in || 3600,
            path: '/',
          })
          return response
        }
      } catch (refreshErr) {
        console.error('Token refresh error:', refreshErr)
      }
    }

    return NextResponse.json({ accessToken: token, refreshToken: refresh })
  } catch (err) {
    console.error('Token bridge error', err)
    return NextResponse.json({ accessToken: null }, { status: 500 })
  }
}
