'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { supabase } from '@/lib/supabase'

interface GameSession {
  id: string
  join_code: string
  status: string
  created_at: string
  time_limit: number
  board_size: number
  quiz: {
    title: string
  }
}

interface Player {
  id: string
  name: string
  score: number
  color: string
}

export default function GameManagementPage() {
  const params = useParams()
  const router = useRouter()
  const gameId = params.id as string

  const [game, setGame] = useState<GameSession | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (gameId) {
      loadGame()
      // Poll for updates
      const interval = setInterval(() => {
        loadGame()
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [gameId])

  const loadGame = async () => {
    try {
      const { data: gameData, error } = await supabase
        .from('game_sessions')
        .select(`
          *,
          quizzes(title)
        `)
        .eq('id', gameId)
        .single()

      if (error) throw error

      setGame(gameData)

      // Load players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .order('score', { ascending: false })

      setPlayers(playersData || [])
    } catch (error) {
      console.error('Error loading game:', error)
    } finally {
      setLoading(false)
    }
  }

  const startGame = async () => {
    if (!confirm('Start the game now? Players can begin claiming territories.')) return

    try {
      await supabase
        .from('game_sessions')
        .update({ status: 'active' })
        .eq('id', gameId)

      alert('Game started! Players can now claim tiles.')
      loadGame()
      
    } catch (error) {
      alert('Failed to start game')
      console.error(error)
    }
  }

  const endGame = async () => {
    if (!confirm('End the game now? This will delete all player data.')) return

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
      router.push('/teacher/dashboard')
    } catch (error) {
      alert('Failed to end game')
      console.error(error)
    }
  }

  const copyJoinCode = () => {
    if (game) {
      navigator.clipboard.writeText(game.join_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const removePlayer = async (playerId: string) => {
    if (!confirm('Remove this player from the game?')) return

    try {
      await supabase
        .from('players')
        .delete()
        .eq('id', playerId)

      setPlayers(prev => prev.filter(p => p.id !== playerId))
      alert('Player removed')
    } catch (error) {
      alert('Failed to remove player')
      console.error(error)
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading game...</p>
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (!game) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Game not found</p>
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
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Game Management</h1>
                <p className="text-gray-600">
                  {game.quiz?.title} • {game.status.toUpperCase()}
                </p>
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

        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {/* Game Info Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Game Code</h3>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-gray-900 font-mono">
                    {game.join_code}
                  </div>
                  <button
                    onClick={copyJoinCode}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Share this code with students
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Status</h3>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  game.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                  game.status === 'active' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {game.status.toUpperCase()}
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Created: {new Date(game.created_at).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">
                  Board: {game.board_size}×{game.board_size} • Time: {game.time_limit / 60} min
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Quick Actions</h3>
                <div className="flex gap-2">
                  {game.status === 'waiting' && (
                    <button
                      onClick={startGame}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                    >
                      Start Game
                    </button>
                  )}
                  {game.status !== 'finished' && (
                    <button
                      onClick={endGame}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                    >
                      End Game
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Players List */}
            <div className="bg-white rounded-xl shadow-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Players ({players.length})</h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {players.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p>No players have joined yet</p>
                    <p className="text-sm mt-2">Students join at: territoryquiz.com/play</p>
                  </div>
                ) : (
                  players.map(player => (
                    <div key={player.id} className="p-6 hover:bg-gray-50">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: player.color || '#3B82F6' }}
                          >
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{player.name}</div>
                            <div className="text-sm text-gray-500">
                              Score: {player.score || 0} • Tiles: {/* Add tiles_owned if you have it */}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removePlayer(player.id)}
                          className="px-3 py-1 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Game Info */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Game Statistics</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Total Players</p>
                    <p className="text-2xl font-bold text-gray-900">{players.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Board Size</p>
                    <p className="text-2xl font-bold text-gray-900">{game.board_size}×{game.board_size}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Time Limit</p>
                    <p className="text-2xl font-bold text-gray-900">{game.time_limit / 60} minutes</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl shadow p-6 border border-blue-100">
                <h3 className="font-bold text-blue-800 mb-3">📋 Student Instructions</h3>
                <div className="space-y-2 text-sm text-blue-700">
                  <p>1. Students go to: <strong>territoryquiz.com/play</strong></p>
                  <p>2. Enter game code: <strong>{game.join_code}</strong></p>
                  <p>3. Enter their name and join</p>
                  <p>4. Wait for game to start (refresh automatically)</p>
                  <p>5. Click adjacent tiles to answer questions</p>
                  <p>6. Claim territories by answering correctly</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}