import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/user
 * Calls the Google userinfo endpoint using the access token stored in cookies.
 * Returns a stable { userId, email, name } for scoping Firestore data per user.
 * No Firebase Auth required — we piggyback on the existing Google Fit OAuth token.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('google_fit_access_token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch user info' }, { status: res.status })
    }

    const data = await res.json()

    return NextResponse.json({
      userId: data.id,      // stable Google account ID — use as Firestore document key
      email: data.email,
      name: data.name,
      picture: data.picture,
    })
  } catch (err) {
    console.error('User info error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}