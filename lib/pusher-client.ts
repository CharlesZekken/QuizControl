import Pusher from 'pusher-js'

export const pusherClient = new Pusher(
  process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  {
    cluster: process.env.PUSHER_CLUSTER!,
    forceTLS: true
  }
)