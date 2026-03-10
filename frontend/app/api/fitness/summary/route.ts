import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('google_fit_access_token')?.value
  if (!accessToken) return NextResponse.json({ fitSummary: null })

  try {
    const endTime = Date.now();
    const startTime = endTime - (24 * 60 * 60 * 1000); // Last 24h

    // Parallel fetch for Heart Rate and Steps
    const [hrRes, stepsRes] = await Promise.all([
      fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: startTime, endTimeMillis: endTime
        })
      }),
      fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: startTime, endTimeMillis: endTime
        })
      })
    ]);

    const hrData = await hrRes.json();
    const stepsData = await stepsRes.json();

    const avgHR = hrData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || null;
    const totalSteps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;

    // Hardened Response Structure (Text for Speech, JSON for Logic)
    return NextResponse.json({
      fitSummary: {
        summaryText: `User's heart rate is ${avgHR ? Math.round(avgHR) + ' bpm' : 'unknown'} and they have taken ${totalSteps} steps today.`,
        summaryJson: {
          heartRate: avgHR ? Math.round(avgHR) : null,
          steps: totalSteps,
          hrStatus: avgHR && avgHR > 100 ? "HIGH" : "NORMAL",
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (e) {
    return NextResponse.json({ fitSummary: null });
  }
}