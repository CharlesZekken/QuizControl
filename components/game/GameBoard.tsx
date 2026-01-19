'use client'

import { useState, useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'
import { cn, formatTime } from '@/lib/game-engine'
import { QuestionBox } from './QuestionBox'

export function GameBoard() {
  const { gameState, currentPlayer, claimTile, answerQuestion } = useGameStore()
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null)
  const [answerLockout, setAnswerLockout] = useState(false)
  const [lockoutTimer, setLockoutTimer] = useState(0)

  // Initialize board from game state
  const board = gameState?.tiles || []

  // Lockout timer effect
  useEffect(() => {
    if (!answerLockout) return

    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          setAnswerLockout(false)
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [answerLockout])

  const handleTileClick = (x: number, y: number) => {
    if (!gameState || !currentPlayer || gameState.status !== 'active') return
    
    if (answerLockout) {
      alert(`Wait ${lockoutTimer}s before answering again!`)
      return
    }

    setSelectedTile({ x, y })
  }

  const handleAnswer = async (answerIndex: number) => {
    if (!selectedTile || answerLockout) return

    const { correct, points } = await answerQuestion(answerIndex)
    
    if (correct) {
      // Claim the tile
      claimTile(selectedTile.x, selectedTile.y)
      alert(`Correct! +${points} points. Tile claimed!`)
      setSelectedTile(null)
    } else {
      // 5-second lockout
      setAnswerLockout(true)
      setLockoutTimer(5)
      alert('Wrong answer! 5-second lockout.')
    }
  }

  if (!gameState) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Waiting to join a game...</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Game Header */}
      <div className="mb-6 p-4 bg-white rounded-xl shadow">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Game: {gameState.joinCode}
            </h2>
            <p className="text-gray-600">
              Status: <span className={cn(
                'font-semibold',
                gameState.status === 'waiting' && 'text-yellow-600',
                gameState.status === 'active' && 'text-green-600',
                gameState.status === 'finished' && 'text-red-600'
              )}>
                {gameState.status.toUpperCase()}
              </span>
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-800">
              {formatTime(gameState.timer)}
            </div>
            <div className="text-sm text-gray-500">Time Remaining</div>
          </div>
          
          <div className="text-right">
            <div className="text-xl font-bold text-gray-800">
              {currentPlayer?.score || 0} pts
            </div>
            <div className="text-sm text-gray-500">Your Score</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Game Board */}
        <div className="lg:col-span-2">
          <div className="bg-white p-4 rounded-xl shadow-lg">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Territory Map</h3>
              {answerLockout && (
                <div className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  Lockout: {lockoutTimer}s
                </div>
              )}
            </div>
            
            <div className="inline-grid gap-1 p-2 bg-gray-100 rounded-lg">
              {board.map((row, x) => (
                <div key={x} className="flex gap-1">
                  {row.map((tile, y) => {
                    const isSelected = selectedTile?.x === x && selectedTile?.y === y
                    const isOwned = tile.ownerId !== null
                    const isCurrentPlayerTile = tile.ownerId === currentPlayer?.id
                    
                    return (
                      <button
                        key={`${x}-${y}`}
                        onClick={() => handleTileClick(x, y)}
                        disabled={gameState.status !== 'active' || isOwned}
                        className={cn(
                          'w-10 h-10 md:w-12 md:h-12 border-2 rounded-md transition-all',
                          'disabled:cursor-not-allowed hover:scale-105 hover:shadow-md',
                          isSelected && 'ring-2 ring-offset-1 ring-blue-500 border-blue-500',
                          isOwned ? 'border-white' : 'border-gray-300',
                          isCurrentPlayerTile ? 'ring-2 ring-white' : '',
                          tile.color || 'bg-gray-100'
                        )}
                        title={
                          isOwned 
                            ? `Owned by ${tile.ownerName}` 
                            : `Tile (${x}, ${y}) - Click to claim`
                        }
                      >
                        {isOwned && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div 
                              className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm"
                              style={{ backgroundColor: tile.color }}
                            >
                              {tile.ownerName?.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Selected Tile Info */}
            {selectedTile && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-800">
                  Selected Tile: ({selectedTile.x}, {selectedTile.y})
                </p>
                {board[selectedTile.x]?.[selectedTile.y]?.ownerName && (
                  <p className="text-sm text-blue-600">
                    Currently owned by: {board[selectedTile.x][selectedTile.y].ownerName}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Game Info & Questions */}
        <div className="space-y-6">
          {/* Question Box */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <QuestionBox
              question={gameState.currentQuestion}
              onAnswer={handleAnswer}
              disabled={answerLockout || !selectedTile}
            />
          </div>

          {/* Players List */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Players</h3>
            <div className="space-y-3">
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    player.id === currentPlayer?.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium">
                        {player.name}
                        {player.id === currentPlayer?.id && ' (You)'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.tilesOwned || 0} territories
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">{player.score} pts</div>
                    <div className={cn(
                      'text-xs',
                      player.connected ? 'text-green-600' : 'text-red-600'
                    )}>
                      {player.connected ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Game Instructions */}
          <div className="bg-blue-50 rounded-xl shadow p-6 border border-blue-100">
            <h4 className="font-bold text-blue-800 mb-2">🎮 How to Play</h4>
            <ul className="space-y-2 text-sm text-blue-700">
              <li className="flex items-start">
                <span className="mr-2">1.</span>
                Click an unclaimed adjacent tile
              </li>
              <li className="flex items-start">
                <span className="mr-2">2.</span>
                Answer the question correctly
              </li>
              <li className="flex items-start">
                <span className="mr-2">3.</span>
                Claim the tile and earn points!
              </li>
              <li className="flex items-start">
                <span className="mr-2">4.</span>
                Wrong answer = 5s lockout
              </li>
              <li className="flex items-start">
                <span className="mr-2">5.</span>
                Most territories when time runs out wins!
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}