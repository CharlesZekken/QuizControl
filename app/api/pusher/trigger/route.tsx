import { NextRequest, NextResponse } from 'next/server'
import { pusherServer } from '@/lib/pusher-server'
import { getErrorMessage } from '@/lib/error-handler'

export async function POST(request: NextRequest) {
  try {
    const { channel, event, data } = await request.json()

    if (!channel || !event) {
      return NextResponse.json(
        { success: false, error: 'Missing channel or event' },
        { status: 400 }
      )
    }

    await pusherServer.trigger(channel, event, data)

    return NextResponse.json({
      success: true,
      message: `Event ${event} triggered on channel ${channel}`
    })
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}