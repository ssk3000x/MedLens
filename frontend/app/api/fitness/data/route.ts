import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('google_fit_access_token')?.value

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not connected to Google Fit. Please authenticate first.' },
      { status: 401 }
    )
  }

  try {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    // Fetch multiple data sources in parallel
    const [heartRate, steps, bloodPressure, oxygenSaturation, bodyTemp, bloodGlucose, sleepData] =
      await Promise.allSettled([
        fetchFitnessData(accessToken, 'com.google.heart_rate.bpm', oneDayAgo, now),
        fetchFitnessData(accessToken, 'com.google.step_count.delta', oneDayAgo, now),
        fetchFitnessData(accessToken, 'com.google.blood_pressure', oneDayAgo, now),
        fetchFitnessData(accessToken, 'com.google.oxygen_saturation', oneDayAgo, now),
        fetchFitnessData(accessToken, 'com.google.body.temperature', oneDayAgo, now),
        fetchFitnessData(accessToken, 'com.google.blood_glucose', oneDayAgo, now),
        fetchSleepData(accessToken, oneDayAgo, now),
      ])

    const biometrics = {
      heartRate: extractResult(heartRate),
      steps: extractResult(steps),
      bloodPressure: extractResult(bloodPressure),
      oxygenSaturation: extractResult(oxygenSaturation),
      bodyTemperature: extractResult(bodyTemp),
      bloodGlucose: extractResult(bloodGlucose),
      sleep: extractResult(sleepData),
      fetchedAt: new Date().toISOString(),
    }

    console.log('✅ Google Fit biometrics fetched successfully:', JSON.stringify(biometrics, null, 2))

    return NextResponse.json(biometrics)
  } catch (err) {
    console.error('❌ Error fetching fitness data:', err)
    return NextResponse.json({ error: 'Failed to fetch fitness data' }, { status: 500 })
  }
}

function extractResult(result: PromiseSettledResult<any>) {
  if (result.status === 'fulfilled') return result.value
  return { error: result.reason?.message || 'Failed to fetch' }
}

async function fetchFitnessData(
  accessToken: string,
  dataTypeName: string,
  startTimeMillis: number,
  endTimeMillis: number
) {
  const response = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName }],
        bucketByTime: { durationMillis: 3600000 }, // 1-hour buckets
        startTimeMillis,
        endTimeMillis,
      }),
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`Fitness API error for ${dataTypeName}: ${response.status} ${JSON.stringify(err)}`)
  }

  const data = await response.json()

  // Extract data points from buckets
  const points: any[] = []
  for (const bucket of data.bucket || []) {
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        points.push({
          startTime: new Date(parseInt(point.startTimeNanos) / 1e6).toISOString(),
          endTime: new Date(parseInt(point.endTimeNanos) / 1e6).toISOString(),
          values: point.value?.map((v: any) => v.fpVal ?? v.intVal ?? v.mapVal) || [],
        })
      }
    }
  }

  return { dataType: dataTypeName, points, count: points.length }
}

async function fetchSleepData(
  accessToken: string,
  startTimeMillis: number,
  endTimeMillis: number
) {
  const response = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${new Date(startTimeMillis).toISOString()}&endTime=${new Date(endTimeMillis).toISOString()}&activityType=72`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`Sleep API error: ${response.status} ${JSON.stringify(err)}`)
  }

  const data = await response.json()

  const sessions = (data.session || []).map((s: any) => ({
    startTime: new Date(parseInt(s.startTimeMillis)).toISOString(),
    endTime: new Date(parseInt(s.endTimeMillis)).toISOString(),
    durationMinutes: (parseInt(s.endTimeMillis) - parseInt(s.startTimeMillis)) / 60000,
    name: s.name || 'Sleep session',
  }))

  return { dataType: 'sleep', sessions, count: sessions.length }
}
