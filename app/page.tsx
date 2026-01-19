'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [gameCode, setGameCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  const handleTeacherLogin = () => {
    router.push('/auth/login')
  }

  const handleJoinGame = async () => {
    if (!gameCode.trim()) {
      setJoinError('Please enter a game code')
      return
    }
    
    if (!playerName.trim()) {
      setJoinError('Please enter your name')
      return
    }

    setJoining(true)
    setJoinError('')

    try {
      // Check if game exists
      const { data: game, error: gameError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('join_code', gameCode.toUpperCase())
        .eq('status', 'waiting')
        .single()

      if (gameError || !game) {
        setJoinError('Game not found or already started. Check the code and try again.')
        return
      }

      // Redirect to player game page with player name as query parameter
      router.push(`/play/${game.id}?player=${encodeURIComponent(playerName.trim())}`)
      
    } catch (error) {
      console.error('Error joining game:', error)
      setJoinError('Failed to join game. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoinGame()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 md:p-8">
      {/* Header */}
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">
          QuizControl
        </h1>
        <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto">
          Battle for knowledge, claim territories, become the champion!
        </p>
      </div>
      
      <div className="max-w-6xl mx-auto">
        {/* Main Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-12">
          {/* Teacher Section */}
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-100">
            <div className="flex flex-col h-full">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3">For Teachers</h2>
                <p className="text-gray-600">
                  Create interactive quizzes, host live games, track student progress in real-time, and make learning fun!
                </p>
              </div>
              
              <div className="space-y-4 mt-auto">
                <button
                  onClick={handleTeacherLogin}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-lg font-semibold hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Teacher Login / Sign Up
                </button>
                <div className="text-sm text-gray-500 text-center">
                  <Link href="/auth/login" className="text-blue-600 hover:text-blue-800 hover:underline">
                    Already have an account?
                  </Link>
                </div>
              </div>
            </div>
          </div>
          
          {/* Student Section */}
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-100">
            <div className="flex flex-col h-full">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3">For Students</h2>
                <p className="text-gray-600">
                  Join exciting quiz battles, answer questions to claim territory, compete with classmates, and become the champion!
                </p>
              </div>
              
              <div className="space-y-4 mt-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Game Code
                    </label>
                    <input 
                      type="text" 
                      placeholder="Enter 6-letter code (e.g., ABC123)" 
                      className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      value={gameCode}
                      onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                      onKeyPress={handleKeyPress}
                      maxLength={6}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name
                    </label>
                    <input 
                      type="text" 
                      placeholder="Enter your display name" 
                      className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      onKeyPress={handleKeyPress}
                      maxLength={20}
                    />
                  </div>

                  {joinError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 text-sm">{joinError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleJoinGame}
                    disabled={joining}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    {joining ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Joining Game...
                      </span>
                    ) : (
                      'Join Game'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-gray-100">
          <h3 className="text-2xl font-bold text-center text-gray-800 mb-8">How It Works</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h4 className="font-bold text-gray-800 mb-2">Teacher Creates Game</h4>
              <p className="text-gray-600 text-sm">
                Teacher creates a quiz and starts a game with a unique code
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h4 className="font-bold text-gray-800 mb-2">Students Join</h4>
              <p className="text-gray-600 text-sm">
                Students enter the game code and their name to join the battle
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">3</span>
              </div>
              <h4 className="font-bold text-gray-800 mb-2">Conquer Territory</h4>
              <p className="text-gray-600 text-sm">
                Answer questions correctly to claim tiles and dominate the board!
              </p>
            </div>
          </div>

          {/* Game Board Preview */}
          <div className="mt-8">
            <h4 className="text-lg font-bold text-center mb-4 text-gray-700">Game Board Preview</h4>
            <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1 md:gap-2 max-w-2xl mx-auto">
              {Array.from({ length: 50 }).map((_, i) => (
                <div 
                  key={i}
                  className={`aspect-square rounded border ${
                    i % 10 === 0 ? 'bg-blue-300 border-blue-500' : 
                    i % 7 === 0 ? 'bg-green-300 border-green-500' : 
                    i % 4 === 0 ? 'bg-purple-300 border-purple-500' : 
                    'bg-gray-100 border-gray-300'
                  }`}
                  title={`Tile ${i + 1}`}
                />
              ))}
            </div>
            <p className="text-center text-gray-500 text-sm mt-4">
              Each tile represents a question. Claim them by answering correctly!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Need help? <Link href="/contact" className="text-blue-600 hover:underline">Contact support</Link></p>
          <p className="mt-1">© {new Date().getFullYear()} QuizControl. Battle for knowledge!</p>
        </div>
      </div>
    </div>
  )
}