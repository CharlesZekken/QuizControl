'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { supabase } from '@/lib/supabase'

interface Quiz {
  id: string
  title: string
  description: string
  question_count: number
  created_at: string
}

export default function QuizUsePage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingGame, setCreatingGame] = useState(false)
  const [timeLimit, setTimeLimit] = useState(300) // 5 minutes
  const [boardSize, setBoardSize] = useState(10)

  useEffect(() => {
    if (quizId) {
      loadQuiz()
    }
  }, [quizId])

  const loadQuiz = async () => {
    try {
      const { data: quizData, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single()

      if (error) throw error
      setQuiz(quizData)
    } catch (error) {
      console.error('Error loading quiz:', error)
    } finally {
      setLoading(false)
    }
  }

  const createGame = async () => {
    if (!quiz) return

    setCreatingGame(true)
    try {
      // Generate a random join code
      const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      const { data: gameData, error } = await supabase
        .from('game_sessions')
        .insert({
          quiz_id: quizId,
          join_code: joinCode,
          status: 'waiting',
          time_limit: timeLimit,
          board_size: boardSize,
          teacher_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single()

      if (error) throw error

      alert(`Game created! Join Code: ${joinCode}`)
      router.push(`/teacher/game/${gameData.id}`)
    } catch (error) {
      console.error('Error creating game:', error)
      alert('Failed to create game')
    } finally {
      setCreatingGame(false)
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading quiz...</p>
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (!quiz) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Quiz not found</p>
            <Link
              href="/teacher/dashboard"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Use Quiz</h1>
                <p className="text-gray-600">Create a game with this quiz</p>
              </div>
              <Link
                href="/teacher/dashboard"
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{quiz.title}</h2>
            <p className="text-gray-600 mb-4">{quiz.description || 'No description'}</p>
            <div className="text-sm text-gray-500">
              {quiz.question_count} questions • Created {new Date(quiz.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Game Settings</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Limit (minutes)
                </label>
                <div className="flex gap-2">
                  {[5, 10, 15, 20, 30].map(minutes => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setTimeLimit(minutes * 60)}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        timeLimit === minutes * 60
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Selected: {timeLimit / 60} minutes ({timeLimit} seconds)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Board Size
                </label>
                <div className="flex gap-2">
                  {[8, 10, 12].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setBoardSize(size)}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        boardSize === size
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {size}×{size}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {boardSize}×{boardSize} grid ({boardSize * boardSize} total tiles)
                </p>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <h3 className="font-bold text-blue-800 mb-2">📋 How it works:</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Students join at <strong>quizcontrol.com/play</strong></li>
                    <li>• They'll enter a game code to join</li>
                    <li>• Players claim tiles by answering questions correctly</li>
                    <li>• Goal: Control the most territory by game end</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => router.back()}
                    className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createGame}
                    disabled={creatingGame}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {creatingGame ? 'Creating Game...' : 'Create Game'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
} 