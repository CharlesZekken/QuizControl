'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { supabase } from '@/lib/supabase'

interface Quiz {
  id: string
  title: string
  description: string
  question_count: number
  created_at: string
}

interface GameSession {
  id: string
  join_code: string
  status: string
  created_at: string
  time_limit: number
  player_count: number
}

export default function TeacherDashboard() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [activeGames, setActiveGames] = useState<GameSession[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingGame, setCreatingGame] = useState(false)
  const [selectedQuiz, setSelectedQuiz] = useState<string>('')

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      // Load quizzes
      const { data: quizzesData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('teacher_id', user?.id)
        .order('created_at', { ascending: false })

      // Load active games
      const { data: gamesData } = await supabase
        .from('game_sessions')
        .select(`
          *,
          players(count)
        `)
        .eq('teacher_id', user?.id)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })

      setQuizzes(quizzesData || [])
      setActiveGames(
        (gamesData || []).map(game => ({
          ...game,
          player_count: (game.players?.[0] as any)?.count || 0
        }))
      )
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createNewGame = async (quizId: string) => {
    if (!quizId) {
      alert('Please select a quiz first')
      return
    }

    setCreatingGame(true)
    try {
      // Redirect to the new use page for game setup
      router.push(`/teacher/quizzes/use/${quizId}`)
    } catch (error) {
      alert('Failed to create game')
      console.error(error)
    } finally {
      setCreatingGame(false)
      setSelectedQuiz('')
    }
  }
  
  const endGame = async (gameId: string) => {
    if (!confirm('Are you sure you want to end this game? This will delete all player data.')) return

    try {
      // Delete players first
      await supabase
        .from('players')
        .delete()
        .eq('game_id', gameId)

      // Then update game status
      await supabase
        .from('game_sessions')
        .update({ status: 'finished' })
        .eq('id', gameId)

      alert('Game ended and player data cleared!')
      loadData()
    } catch (error) {
      alert('Failed to end game')
      console.error(error)
    }
  }

  const deleteQuiz = async (quizId: string, quizTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${quizTitle}"? This will also delete all questions in this quiz. This action cannot be undone.`)) {
      return
    }

    try {
      // Delete questions first (due to foreign key constraint)
      const { error: questionsError } = await supabase
        .from('questions')
        .delete()
        .eq('quiz_id', quizId)

      if (questionsError) throw questionsError

      // Then delete the quiz
      const { error: quizError } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId)

      if (quizError) throw quizError

      alert('Quiz deleted successfully!')
      // Refresh the quizzes list
      loadData()
    } catch (error: any) {
      console.error('Delete quiz error:', error)
      alert(`Failed to delete quiz: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
                <p className="text-gray-600">Welcome back, {user?.email}</p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/teacher/quizzes/new"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  + New Quiz
                </Link>
                <button
                  onClick={() => useAuthStore.getState().signOut()}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Total Quizzes</p>
                  <p className="text-2xl font-bold text-gray-900">{quizzes.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-100 text-green-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Active Games</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {activeGames.filter(g => g.status === 'active').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Waiting Games</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {activeGames.filter(g => g.status === 'waiting').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Create New Game Section */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Start Game</h2>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Quiz
                </label>
                <select
                  value={selectedQuiz}
                  onChange={(e) => setSelectedQuiz(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="">-- Choose a quiz --</option>
                  {quizzes.map(quiz => (
                    <option key={quiz.id} value={quiz.id}>
                      {quiz.title} ({quiz.question_count} questions)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => createNewGame(selectedQuiz)}
                  disabled={creatingGame || !selectedQuiz}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingGame ? 'Redirecting...' : 'Quick Start'}
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Or use the "Use" button next to each quiz for more options
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Active Games Section */}
            <div className="bg-white rounded-xl shadow-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Active Games</h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {activeGames.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-2">No active games</p>
                  </div>
                ) : (
                  activeGames.map(game => (
                    <div key={game.id} className="p-6 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              game.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {game.status.toUpperCase()}
                            </span>
                            <span className="font-mono text-lg font-bold text-gray-800">
                              {game.join_code}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Created: {new Date(game.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-600">
                            Players: {game.player_count} • Time: {game.time_limit / 60} min
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/teacher/game/${game.id}`}
                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                          >
                            Manage
                          </Link>
                          <button
                            onClick={() => endGame(game.id)}
                            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                          >
                            End
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quizzes Section */}
            <div className="bg-white rounded-xl shadow-lg">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Your Quizzes</h2>
                <Link
                  href="/teacher/quizzes/new"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  + New Quiz
                </Link>
              </div>
              
              <div className="divide-y divide-gray-200">
                {quizzes.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2">No quizzes yet</p>
                    <Link
                      href="/teacher/quizzes/new"
                      className="mt-3 inline-block px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Create your first quiz
                    </Link>
                  </div>
                ) : (
                  quizzes.map(quiz => (
                    <div key={quiz.id} className="p-6 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900">{quiz.title}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {quiz.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span>{quiz.question_count} questions</span>
                            <span>•</span>
                            <span>Created {new Date(quiz.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/teacher/quizzes/${quiz.id}/edit`}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/teacher/quizzes/use/${quiz.id}`}
                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            Use
                          </Link>
                          <button
                            onClick={() => deleteQuiz(quiz.id, quiz.title)}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}