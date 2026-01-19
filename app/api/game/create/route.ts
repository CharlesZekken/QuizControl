import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateGameCode } from '@/lib/game-engine'
import { getErrorMessage } from '@/lib/error-handler'
import { pusherServer } from '@/lib/pusher-server'

export async function POST(request: NextRequest) {
  try {
    const { quizId, teacherId, boardSize = 10, timeLimit = 300 } = await request.json()
    
    // Verify teacher
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single()
    
    if (teacherError || !teacher) {
      throw new Error('Teacher not found')
    }
    
    // Generate unique join code
    let joinCode: string
    let isUnique = false
    
    while (!isUnique) {
      joinCode = generateGameCode()
      const { data: existing } = await supabase
        .from('game_sessions')
        .select('id')
        .eq('join_code', joinCode)
        .eq('status', 'waiting')
        .single()
      
      if (!existing) {
        isUnique = true
      }
    }
    
    // Create game session
    const { data: game, error: gameError } = await supabase
      .from('game_sessions')
      .insert({
        quiz_id: quizId,
        teacher_id: teacherId,
        join_code: joinCode!,
        status: 'waiting',
        board_config: { size: boardSize },
        time_limit: timeLimit,
      })
      .select()
      .single()
    
    if (gameError) throw gameError
    
    return NextResponse.json({
      success: true,
      gameId: game.id,
      joinCode: game.join_code,
      message: 'Game created successfully',
    })
    
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}