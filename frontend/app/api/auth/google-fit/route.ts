import { NextResponse } from 'next/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const REDIRECT_URI = process.env.GOOGLE_FIT_REDIRECT_URI || 'http://localhost:3000/api/auth/google-fit/callback'

// Google Fit / Health Connect scopes
const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.blood_pressure.read',
  'https://www.googleapis.com/auth/fitness.blood_glucose.read',
  'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
  'https://www.googleapis.com/auth/fitness.body_temperature.read',
]

export async function GET() {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GOOGLE_CLIENT_ID is not configured' },
      { status: 500 }
    )
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return NextResponse.redirect(authUrl)
}
