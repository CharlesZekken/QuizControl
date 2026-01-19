import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/error-handler'
import { pusherServer } from '@/lib/pusher-server'

export async function POST(request: NextRequest) {
  try {
    const { gameId, playerId, tile } = await request.json()
    
    // Get player info
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('name, color, score')
      .eq('id', playerId)
      .single()
    
    if (playerError) throw playerError
    
    // Record tile claim
    const { error: claimError } = await supabase
      .from('game_actions')
      .insert({
        session_id: gameId,
        player_id: playerId,
        action_type: 'tile_claimed',
        tile_x: tile.x,
        tile_y: tile.y,
        points_earned: 100, // Base points per tile
      })
    
    if (claimError) throw claimError
    
    // Update player score
    await supabase
      .from('players')
      .update({ score: (player?.score || 0) + 100 })
      .eq('id', playerId)
    
    // Notify all players
    await pusherServer.trigger(`game-${gameId}`, 'tile_claimed', {
      playerId,
      playerName: player.name,
      tile,
      color: player.color,
      points: 100,
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}