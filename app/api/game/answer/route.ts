import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/error-handler'
import { pusherServer } from '@/lib/pusher-server'

export async function POST(request: NextRequest) {
  try {
    const { gameId, playerId, questionId, answerIndex } = await request.json()
    
    // Get question
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()
    
    if (questionError) throw questionError
    
    // Check answer
    const correct = answerIndex === question.correct_answer
    const points = correct ? question.points || 100 : 0
    
    // Record answer
    await supabase.from('game_answers').insert({
      session_id: gameId,
      player_id: playerId,
      question_id: questionId,
      answer_index: answerIndex,
      correct,
      points_earned: points,
    })
    
    // Update player score if correct
    if (correct) {
      const { data: player } = await supabase
        .from('players')
        .select('score')
        .eq('id', playerId)
        .single()
      
      await supabase
        .from('players')
        .update({ score: (player?.score || 0) + points })
        .eq('id', playerId)
    }
    
    // Notify via Pusher
    await pusherServer.trigger(`game-${gameId}`, 'question_answered', {
      playerId,
      correct,
      points,
    })
    
    return NextResponse.json({
      success: true,
      correct,
      points,
      correctAnswer: question.correct_answer,
    })
    
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}