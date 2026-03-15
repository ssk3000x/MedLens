import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.GOOGLE_FIT_REDIRECT_URI || 'http://localhost:3000/api/auth/google-fit/callback'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    console.error('❌ Google OAuth error:', error)
    // Redirect back to home with error
    return NextResponse.redirect(new URL('/?fit_error=' + error, request.url))
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code received' }, { status: 400 })
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', tokens)
      return NextResponse.redirect(new URL('/?fit_error=token_exchange_failed', request.url))
    }

    console.log('✅ Google Fit OAuth successful! Access token obtained.')
    console.log('   Token type:', tokens.token_type)
    console.log('   Expires in:', tokens.expires_in, 'seconds')
    console.log('   Scopes:', tokens.scope)
    if (tokens.refresh_token) {
      console.log('   Refresh token: obtained')
    }

    // Store the access token in a secure httpOnly cookie
    const redirectUrl = new URL('/?fit_connected=true', request.url)
    const response = NextResponse.redirect(redirectUrl)

    response.cookies.set('google_fit_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in || 3600,
      path: '/',
    })

    if (tokens.refresh_token) {
      response.cookies.set('google_fit_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }

    // Try to fetch the user's profile (display name) so the frontend can show "calling on behalf of <name>".
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })

      if (userInfoRes.ok) {
        const profile = await userInfoRes.json()
        const displayName = profile.name || profile.given_name || profile.email || ''
        if (displayName) {
          // Set a non-httpOnly cookie so the frontend JS can read it.
          // Keep value small and safe.
          response.cookies.set('displayName', String(displayName), {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            path: '/',
          })
        }
      } else {
        console.warn('Could not fetch userinfo:', await userInfoRes.text())
      }
    } catch (err) {
      console.warn('Error fetching user profile:', err)
    }

    return response
  } catch (err) {
    console.error('❌ Google Fit callback error:', err)
    return NextResponse.redirect(new URL('/?fit_error=server_error', request.url))
  }
}
