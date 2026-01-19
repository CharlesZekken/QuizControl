import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPlayerColor, calculateBorderPositions } from '@/lib/game-engine'
import { getErrorMessage } from '@/lib/error-handler'
import { pusherServer } from '@/lib/pusher-server'

export async function POST(request: NextRequest) {
  try {
    const { joinCode, playerName } = await request.json()
    
    // Find game session
    const { data: game, error: gameError } = await supabase
      .from('game_sessions')
      .select('*, quizzes(*)')
      .eq('join_code', joinCode)
      .eq('status', 'waiting')
      .single()
    
    if (gameError || !game) {
      throw new Error('Game not found or already started')
    }
    
    // Get existing players
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', game.id)
    
    const playerCount = existingPlayers?.length || 0
    
    // Create player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        session_id: game.id,
        name: playerName,
        color: getPlayerColor(playerCount),
        score: 0,
        position_x: 0,
        position_y: 0,
      })
      .select()
      .single()
    
    if (playerError) throw playerError
    
    // Calculate starting position
    const positions = calculateBorderPositions(playerCount + 1, game.board_config?.size || 10)
    const position = positions[playerCount]
    
    // Update player position
    await supabase
      .from('players')
      .update({
        position_x: position.x,
        position_y: position.y,
      })
      .eq('id', player.id)
    
    // Notify other players via Pusher
    await pusherServer.trigger(`game-${game.id}`, 'player_joined', {
      player: {
        id: player.id,
        name: player.name,
        color: player.color,
        score: 0,
        position,
        connected: true,
        lastActive: new Date(),
        tilesOwned: 0,
      },
    })
    
    return NextResponse.json({
      success: true,
      gameState: {
        id: game.id,
        joinCode: game.join_code,
        status: game.status,
        players: [...(existingPlayers || []), player].map(p => ({
          ...p,
          position: { x: p.position_x, y: p.position_y },
        })),
        timer: game.time_limit,
        timeLimit: game.time_limit,
        boardSize: game.board_config?.size || 10,
        createdAt: game.created_at,
      },
      player: {
        id: player.id,
        name: player.name,
        color: player.color,
        score: 0,
        position,
        connected: true,
        lastActive: new Date(),
        tilesOwned: 0,
      },
    })
    
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    )
  }
}