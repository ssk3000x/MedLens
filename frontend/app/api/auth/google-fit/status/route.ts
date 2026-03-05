import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('google_fit_access_token')?.value
  return NextResponse.json({ connected: !!accessToken })
}

export async function DELETE(request: NextRequest) {
  // Disconnect: clear the tokens
  const response = NextResponse.json({ connected: false, message: 'Disconnected from Google Fit' })
  response.cookies.delete('google_fit_access_token')
  response.cookies.delete('google_fit_refresh_token')
  return response
}
