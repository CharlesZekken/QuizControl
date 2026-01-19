'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { pusherClient } from '@/lib/pusher-client'

interface GameSession {
  id: string
  join_code: string
  status: string
  board_size: number
  quiz_id: string
}

interface Player {
  id: string
  name: string
  score: number
  color: string
  game_id: string
  start_x?: number
  start_y?: number
  tiles_owned: number
  last_active?: string
  is_active?: boolean
}

interface Tile {
  id: string
  x: number
  y: number
  player_id: string | null
  player_color?: string
  player_name?: string
  is_adjacent: boolean
  claimed_at?: string
}

interface Question {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  points: number
}

export default function PlayGamePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const gameId = params.id as string

  const [game, setGame] = useState<GameSession | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [selectedTile, setSelectedTile] = useState<{x: number, y: number} | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [adjacentTiles, setAdjacentTiles] = useState<Tile[]>([])
  const [hasNotifiedGameStart, setHasNotifiedGameStart] = useState(false)
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<string>>(new Set())
  const [recentlyClaimed, setRecentlyClaimed] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ==================== REAL-TIME UPDATES ====================

  // Subscribe to game updates
  useEffect(() => {
    if (!gameId || !player?.id) return

    const channelName = `game-${gameId}`
    const channel = pusherClient.subscribe(channelName)

    console.log('Subscribed to channel:', channelName)

    // Listen for tile claims
    channel.bind('tile_claimed', (data: any) => {
      console.log('Tile claimed by another player:', data)
      
      // Update local tiles state
      setTiles(prevTiles => {
        return prevTiles.map(tile => {
          if (tile.x === data.x && tile.y === data.y) {
            return {
              ...tile,
              player_id: data.player_id,
              player_color: data.player_color,
              player_name: data.player_name,
              claimed_at: data.claimed_at
            }
          }
          return tile
        })
      })

      // Add animation for claimed tile
      const tileKey = `${data.x},${data.y}`
      setRecentlyClaimed(prev => new Set(prev).add(tileKey))
      setTimeout(() => {
        setRecentlyClaimed(prev => {
          const newSet = new Set(prev)
          newSet.delete(tileKey)
          return newSet
        })
      }, 600)

      // Update players list
      setAllPlayers(prevPlayers => {
        return prevPlayers.map(p => {
          if (p.id === data.player_id) {
            return {
              ...p,
              score: (p.score || 0) + data.points,
              tiles_owned: (p.tiles_owned || 0) + 1
            }
          }
          return p
        })
      })

      // Recalculate adjacent tiles
      loadGameBoard()
    })

    // Listen for player joins
    channel.bind('player_joined', (data: any) => {
      console.log('New player joined:', data)
      if (!allPlayers.some(p => p.id === data.player.id)) {
        setAllPlayers(prev => [...prev, data.player])
      }
    })

    // Listen for player leaves
    channel.bind('player_left', (data: any) => {
      console.log('Player left:', data)
      setAllPlayers(prev => prev.filter(p => p.id !== data.player_id))
    })

    // Listen for game status changes
    channel.bind('game_status_changed', (data: any) => {
      console.log('Game status changed:', data.status)
      setGame(prev => prev ? { ...prev, status: data.status } : null)
      
      if (data.status === 'active' && !hasNotifiedGameStart) {
        setHasNotifiedGameStart(true)
        setTimeout(() => {
          alert('🎮 Game has started! You can now claim tiles.')
        }, 500)
      }
    })

    // Listen for player activity updates
    channel.bind('player_activity', (data: any) => {
      setAllPlayers(prev => prev.map(p => {
        if (p.id === data.player_id) {
          return {
            ...p,
            last_active: data.last_active,
            is_active: data.is_active
          }
        }
        return p
      }))
    })

    // Cleanup on unmount
    return () => {
      channel.unbind_all()
      channel.unsubscribe()
      console.log('Unsubscribed from channel:', channelName)
    }
  }, [gameId, player?.id, hasNotifiedGameStart])

  // Broadcast tile claim to all players
  const broadcastTileClaim = async (tileData: any) => {
    try {
      await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: `game-${gameId}`,
          event: 'tile_claimed',
          data: tileData
        })
      })
    } catch (error) {
      console.error('Failed to broadcast tile claim:', error)
    }
  }

  // ==================== INITIAL LOAD ====================

  useEffect(() => {
    const playerName = searchParams.get('player')
    if (!playerName || !gameId) {
      router.push('/')
      return
    }
    checkPlayerStatus(playerName)
  }, [gameId, router, searchParams])

  // ==================== POLLING ====================

  useEffect(() => {
    if (!gameId || !player?.id) return

    let isMounted = true
    let pollCount = 0

    const pollGameStatus = async () => {
      if (!isMounted) return
      
      try {
        pollCount++
        
        // Fetch latest game data
        const { data: currentGame, error } = await supabase
          .from('game_sessions')
          .select('status, quiz_id, board_size')
          .eq('id', gameId)
          .single()

        if (error || !currentGame) return

        // Update game state if changed
        if (isMounted && (!game || currentGame.status !== game.status)) {
          console.log('Game status changed to:', currentGame.status)
          
          setGame(prev => {
            if (!prev) return null
            return { 
              ...prev, 
              status: currentGame.status,
              quiz_id: currentGame.quiz_id || prev.quiz_id,
              board_size: currentGame.board_size || prev.board_size
            }
          })

          // Game just started
          if (currentGame.status === 'active' && game?.status === 'waiting') {
            console.log('Game just started!')
            loadGameBoard()
            loadPlayers()
            
            // Only show alert if we haven't already notified
            if (!hasNotifiedGameStart) {
              setHasNotifiedGameStart(true)
              // Show notification after a short delay
              setTimeout(() => {
                if (isMounted) {
                  alert('🎮 Game has started! You can now claim tiles.')
                }
              }, 500)
            }
          }
          
          // Reset notification flag if game goes back to waiting
          if (currentGame.status === 'waiting') {
            setHasNotifiedGameStart(false)
          }
          
          // Always refresh players when status changes
          loadPlayers()
        }
        
        // Refresh board every 10 seconds
        if (pollCount % 5 === 0) {
          loadGameBoard()
        }
        
      } catch (error) {
        console.error('Polling failed:', error)
      } finally {
        // Schedule next poll
        if (isMounted) {
          setTimeout(pollGameStatus, 2000)
        }
      }
    }

    // Start polling
    pollGameStatus()

    // Cleanup
    return () => {
      isMounted = false
    }
  }, [gameId, player?.id, game?.status, hasNotifiedGameStart])

  // Load players periodically
  useEffect(() => {
    if (!gameId || !player?.id) return

    const loadPlayersInterval = setInterval(() => {
      loadPlayers()
    }, 3000)

    return () => clearInterval(loadPlayersInterval)
  }, [gameId, player?.id])

  // Send heartbeat for activity tracking
  useEffect(() => {
    if (!gameId || !player?.id) return

    const sendHeartbeat = async () => {
      try {
        await supabase
          .from('players')
          .update({ 
            last_active: new Date().toISOString(),
            is_active: true
          })
          .eq('id', player.id)
      } catch (error) {
        console.error('Failed to send heartbeat:', error)
      }
    }

    // Send heartbeat every 10 seconds
    const heartbeatInterval = setInterval(() => {
      sendHeartbeat()
    }, 10000)

    // Initial heartbeat
    sendHeartbeat()

    return () => clearInterval(heartbeatInterval)
  }, [gameId, player?.id])

  // Check for inactive players
  useEffect(() => {
    const checkInactivePlayers = () => {
      const now = new Date()
      const inactiveThreshold = 30000 // 30 seconds
      
      setAllPlayers(prev => prev.map(p => {
        const lastActive = p.last_active ? new Date(p.last_active) : null
        const isInactive = lastActive ? (now.getTime() - lastActive.getTime()) > inactiveThreshold : false
        
        return {
          ...p,
          is_active: !isInactive
        }
      }))
    }

    const interval = setInterval(checkInactivePlayers, 10000)
    return () => clearInterval(interval)
  }, [])

  // ==================== GAME FUNCTIONS ====================

  const checkPlayerStatus = async (playerName: string) => {
    try {
      const { data: gameData } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', gameId)
        .single()

      if (!gameData) {
        alert('Game not found')
        router.push('/')
        return
      }

      setGame(gameData)

      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .eq('name', playerName)
        .maybeSingle()

      if (existingPlayer) {
        setPlayer(existingPlayer)
        await assignStartingPosition(existingPlayer)
      } else {
        setPlayer({
          id: '',
          name: playerName,
          score: 0,
          color: getRandomColor(),
          game_id: gameId,
          tiles_owned: 0
        })
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load game')
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const getRandomColor = () => {
    const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  const assignStartingPosition = async (currentPlayer: Player) => {
    if (currentPlayer.start_x !== null && currentPlayer.start_x !== undefined && 
        currentPlayer.start_y !== null && currentPlayer.start_y !== undefined) {
      console.log('Player already has starting position')
      return
    }

    const { data: players } = await supabase
      .from('players')
      .select('start_x, start_y')
      .eq('game_id', gameId)
      .not('start_x', 'is', null)
      .not('start_y', 'is', null)

    const boardSize = game?.board_size || 10
    const takenPositions = players?.filter(p => p.start_x !== null && p.start_y !== null)
      .map(p => `${p.start_x},${p.start_y}`) || []

    let startX, startY
    let attempts = 0
    let foundPosition = false
    
    while (!foundPosition && attempts < 50) {
      const side = Math.floor(Math.random() * 4)
      switch(side) {
        case 0: // Top edge
          startX = Math.floor(Math.random() * boardSize)
          startY = 0
          break
        case 1: // Right edge
          startX = boardSize - 1
          startY = Math.floor(Math.random() * boardSize)
          break
        case 2: // Bottom edge
          startX = Math.floor(Math.random() * boardSize)
          startY = boardSize - 1
          break
        case 3: // Left edge
          startX = 0
          startY = Math.floor(Math.random() * boardSize)
          break
      }

      if (!takenPositions.includes(`${startX},${startY}`)) {
        foundPosition = true
      }
      attempts++
    }

    if (!foundPosition) {
      startX = Math.floor(boardSize / 2)
      startY = Math.floor(boardSize / 2)
    }

    // Claim starting tile
    await supabase
      .from('tiles')
      .update({ 
        player_id: currentPlayer.id,
        claimed_at: new Date().toISOString()
      })
      .eq('game_id', gameId)
      .eq('x', startX)
      .eq('y', startY)

    // Update player with starting position
    const { data: updatedPlayer } = await supabase
      .from('players')
      .update({ 
        start_x: startX,
        start_y: startY,
        tiles_owned: 1
      })
      .eq('id', currentPlayer.id)
      .select()
      .single()

    if (updatedPlayer) {
      setPlayer(updatedPlayer)
    }
  }

  const loadGameBoard = async () => {
    if (!game?.id || !player?.id) return

    const { data: allTiles, error } = await supabase
      .from('tiles')
      .select(`
        *,
        players(color, name)
      `)
      .eq('game_id', game.id)

    if (error) {
      console.error('Error loading tiles:', error)
      return
    }

    if (!allTiles || allTiles.length === 0) {
      return
    }

    // Get player's owned tiles
    const playerTiles = allTiles.filter(t => t.player_id === player.id)
    
    // Calculate adjacent tiles
    let adjacent = []
    if (playerTiles.length > 0) {
      adjacent = allTiles.filter(tile => {
        if (tile.player_id) return false
        
        return playerTiles.some(playerTile => {
          const dx = Math.abs(tile.x - playerTile.x)
          const dy = Math.abs(tile.y - playerTile.y)
          return (dx === 1 && dy === 0) || (dx === 0 && dy === 1)
        })
      })
    }

    setAdjacentTiles(adjacent)
    
    // Mark tiles as adjacent for visual display
    const processedTiles = allTiles.map(tile => ({
      ...tile,
      player_color: tile.players?.[0]?.color,
      player_name: tile.players?.[0]?.name,
      is_adjacent: adjacent.some(at => at.x === tile.x && at.y === tile.y)
    }))

    setTiles(processedTiles)
  }

  const loadPlayers = async () => {
    if (!gameId) return
    
    const { data: players } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .order('score', { ascending: false })

    if (players) {
      setAllPlayers(players)
    }
  }

  const joinGame = async () => {
    if (!player || !game) return

    try {
      const { data: newPlayer, error } = await supabase
        .from('players')
        .insert({
          game_id: gameId,
          name: player.name,
          color: player.color,
          score: 0,
          tiles_owned: 0,
          last_active: new Date().toISOString(),
          is_active: true
        })
        .select()
        .single()

      if (error) throw error
      
      setPlayer(newPlayer)
      await assignStartingPosition(newPlayer)
      
    } catch (error) {
      console.error('Error joining:', error)
      alert('Failed to join')
    }
  }

  const handleTileClick = async (x: number, y: number) => {
    if (!player?.id || game?.status !== 'active') {
      alert(game?.status === 'waiting' ? 'Game has not started yet!' : 'Game is not active')
      return
    }

    const isAdjacent = adjacentTiles.some(t => t.x === x && t.y === y)
    
    if (!isAdjacent) {
      alert('You can only claim tiles adjacent to your territory!')
      return
    }

    const isAlreadyClaimed = tiles.some(t => t.x === x && t.y === y && t.player_id)
    if (isAlreadyClaimed) {
      alert('This tile is already claimed!')
      return
    }

    setSelectedTile({ x, y })
    
    // Load a RANDOM question for this tile
    if (game.quiz_id) {
      try {
        // Get all questions
        const { data: allQuestions, error } = await supabase
          .from('questions')
          .select('*')
          .eq('quiz_id', game.quiz_id)

        if (error) throw error
        
        if (!allQuestions || allQuestions.length === 0) {
          alert('No questions found for this quiz')
          setSelectedTile(null)
          return
        }

        // Filter out questions the player has already seen
        const availableQuestions = allQuestions.filter(q => !usedQuestionIds.has(q.id))
        
        // If all questions have been used, reset the used set
        let selectedQuestion
        if (availableQuestions.length === 0) {
          // Reset used questions and pick any random one
          setUsedQuestionIds(new Set())
          const randomIndex = Math.floor(Math.random() * allQuestions.length)
          selectedQuestion = allQuestions[randomIndex]
        } else {
          // Pick a random question from available ones
          const randomIndex = Math.floor(Math.random() * availableQuestions.length)
          selectedQuestion = availableQuestions[randomIndex]
        }
        
        // Mark this question as used
        setUsedQuestionIds(prev => new Set(prev).add(selectedQuestion.id))
        setCurrentQuestion(selectedQuestion)
        
      } catch (error) {
        console.error('Error loading questions:', error)
        alert('Failed to load question')
        setSelectedTile(null)
      }
    } else {
      alert('Game configuration error - no quiz assigned')
      setSelectedTile(null)
    }
  }

  const submitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion || !selectedTile || !player?.id) return

    if (isSubmitting) return
    setIsSubmitting(true)

    const isCorrect = selectedAnswer === currentQuestion.correct_answer
    
    if (isCorrect) {
      // Create tile data
      const tileData = {
        x: selectedTile.x,
        y: selectedTile.y,
        player_id: player.id,
        player_name: player.name,
        player_color: player.color,
        points: currentQuestion.points,
        question_id: currentQuestion.id,
        claimed_at: new Date().toISOString()
      }

      // Update local state immediately for instant feedback
      setTiles(prev => prev.map(tile => {
        if (tile.x === selectedTile.x && tile.y === selectedTile.y) {
          return {
            ...tile,
            player_id: player.id,
            player_color: player.color,
            player_name: player.name,
            claimed_at: new Date().toISOString()
          }
        }
        return tile
      }))

      // Update player score locally
      const newScore = player.score + currentQuestion.points
      const newTilesOwned = player.tiles_owned + 1
      
      setPlayer(prev => prev ? {
        ...prev,
        score: newScore,
        tiles_owned: newTilesOwned
      } : null)

      // Update all players list
      setAllPlayers(prev => prev.map(p => {
        if (p.id === player.id) {
          return { ...p, score: newScore, tiles_owned: newTilesOwned }
        }
        return p
      }))

      // Add animation
      const tileKey = `${selectedTile.x},${selectedTile.y}`
      setRecentlyClaimed(prev => new Set(prev).add(tileKey))

      // Broadcast to all other players
      await broadcastTileClaim(tileData)

      // Save to database (async, doesn't block UI)
      await saveTileToDatabase(tileData)

      alert(`Correct! +${currentQuestion.points} points! Tile claimed!`)
      
      // Refresh board
      loadGameBoard()
      loadPlayers()
    } else {
      alert('Wrong answer! Try again on your next turn.')
    }

    // Reset for next turn
    setSelectedTile(null)
    setCurrentQuestion(null)
    setSelectedAnswer(null)
    setIsSubmitting(false)
  }

  const saveTileToDatabase = async (tileData: any) => {
    try {
      await supabase
        .from('tiles')
        .update({
          player_id: tileData.player_id,
          claimed_at: tileData.claimed_at,
          question_id: tileData.question_id
        })
        .eq('game_id', gameId)
        .eq('x', tileData.x)
        .eq('y', tileData.y)

      await supabase
        .from('players')
        .update({
          score: tileData.points + (player?.score || 0),
          tiles_owned: (player?.tiles_owned || 0) + 1
        })
        .eq('id', player?.id)
    } catch (error) {
      console.error('Failed to save tile to database:', error)
    }
  }

  // ==================== RENDERING ====================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading game...</p>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Game not found</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (!player?.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Join Game</h1>
          <p className="text-gray-600 mb-6">
            Ready to conquer territory in <span className="font-semibold">{game.join_code}</span>?
          </p>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Your Name</div>
            <div className="text-lg font-semibold text-gray-900">{player?.name}</div>
          </div>

          <button
            onClick={joinGame}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors mb-4"
          >
            Join Game Now
          </button>

          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              You'll start on the edge of the board and expand by answering questions correctly!
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Calculate game statistics
  const claimedTiles = tiles.filter(t => t.player_id).length
  const totalTiles = tiles.length
  const claimedPercentage = totalTiles > 0 ? Math.round((claimedTiles / totalTiles) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <header className="bg-white shadow rounded-xl p-4 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Territory Conquest</h1>
            <p className="text-gray-600">Game: <span className="font-mono font-bold">{game.join_code}</span></p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: player.color }}
              />
              <div>
                <div className="text-sm text-gray-500">Player</div>
                <div className="font-bold text-gray-800">{player.name}</div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-sm text-gray-500">Score</div>
              <div className="font-bold text-2xl text-green-600">{player.score}</div>
            </div>
            
            <div className="text-center">
              <div className="text-sm text-gray-500">Tiles</div>
              <div className="font-bold text-2xl text-blue-600">{player.tiles_owned}</div>
            </div>
            
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              game.status === 'waiting' ? 'bg-yellow-100 text-yellow-800 animate-pulse' :
              game.status === 'active' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {game.status.toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Board */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Game Board {game.board_size}×{game.board_size}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  {adjacentTiles.length} adjacent tiles available
                </span>
              </h2>
              
              <div className="relative">
                <div 
                  className="grid gap-1 mx-auto"
                  style={{
                    gridTemplateColumns: `repeat(${game.board_size}, minmax(0, 1fr))`,
                    maxWidth: 'min(600px, 100%)'
                  }}
                >
                  {tiles.map((tile) => {
                    const tileKey = `${tile.x},${tile.y}`
                    const isPlayerTile = tile.player_id === player.id
                    const isOtherTile = tile.player_id && tile.player_id !== player.id
                    const isAdjacent = tile.is_adjacent && game.status === 'active'
                    const wasRecentlyClaimed = recentlyClaimed.has(tileKey)
                    
                    return (
                      <button
                        key={tileKey}
                        onClick={() => handleTileClick(tile.x, tile.y)}
                        disabled={!isAdjacent || !!tile.player_id}
                        className={`aspect-square rounded border-2 transition-all duration-200 relative ${
                          wasRecentlyClaimed ? 'tile-claimed' : ''
                        } ${
                          isPlayerTile
                            ? 'ring-2 ring-offset-1 ring-white shadow-lg'
                            : isOtherTile
                            ? 'opacity-90 shadow-md'
                            : isAdjacent
                            ? 'hover:scale-105 hover:shadow-md cursor-pointer border-dashed'
                            : 'cursor-default'
                        } ${
                          isPlayerTile ? 'border-white scale-105' :
                          isOtherTile ? 'border-gray-300' :
                          isAdjacent ? 'border-green-500 bg-green-50' :
                          'border-gray-200 bg-gray-50'
                        }`}
                        style={{
                          backgroundColor: tile.player_color || (isAdjacent ? '#F0FDF4' : '#F9FAFB'),
                          borderColor: tile.player_color || undefined
                        }}
                        title={
                          isPlayerTile ? `Your territory` :
                          isOtherTile ? `${tile.player_name}'s territory` :
                          isAdjacent ? 'Click to claim!' :
                          'Not adjacent to your territory'
                        }
                      >
                        {/* Show player initial on tile */}
                        {tile.player_id && (
                          <div 
                            className="absolute inset-0 flex items-center justify-center rounded"
                            style={{ 
                              backgroundColor: tile.player_color || '#3B82F6',
                              opacity: isPlayerTile ? 0.9 : 0.7
                            }}
                          >
                            <span className="text-white font-bold text-lg">
                              {tile.player_name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                        
                        {/* Tile coordinates (small text) */}
                        <div className="absolute bottom-1 right-1 text-xs text-gray-500 bg-white bg-opacity-70 px-1 rounded">
                          {tile.x},{tile.y}
                        </div>
                        
                        {/* Adjacent indicator */}
                        {isAdjacent && !tile.player_id && (
                          <div className="absolute top-1 left-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Question Card */}
            {currentQuestion && (
              <div className="bg-white rounded-xl shadow-lg p-6 animate-fadeIn">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-800">Claim Tile ({selectedTile?.x}, {selectedTile?.y})</h3>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded">
                    {currentQuestion.points} pts
                  </span>
                </div>
                <p className="text-gray-900 mb-6 bg-white p-3 rounded border">{currentQuestion.question_text}</p>
                
                <div className="space-y-3">
                  {['A', 'B', 'C', 'D'].map((option) => {
                    const optionText = currentQuestion[`option_${option.toLowerCase()}` as keyof Question] as string
                    if (!optionText) return null
                    
                    return (
                      <button
                        key={option}
                        onClick={() => setSelectedAnswer(option)}
                        className={`w-full p-3 text-left rounded-lg border transition ${
                          selectedAnswer === option
                            ? 'bg-blue-50 border-blue-500'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 flex items-center justify-center rounded ${
                            selectedAnswer === option
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                            {option}
                          </div>
                          <span className="text-gray-900 bg-white">{optionText}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
                
                <button
                  onClick={submitAnswer}
                  disabled={!selectedAnswer || isSubmitting}
                  className="w-full mt-4 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                </button>
                
                <button
                  onClick={() => {
                    setSelectedTile(null)
                    setCurrentQuestion(null)
                    setSelectedAnswer(null)
                  }}
                  className="w-full mt-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Game Statistics */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4">Game Statistics</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{claimedTiles}</div>
                  <div className="text-sm text-blue-600">Tiles Claimed</div>
                </div>
                
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{totalTiles - claimedTiles}</div>
                  <div className="text-sm text-green-600">Tiles Remaining</div>
                </div>
                
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">{claimedPercentage}%</div>
                  <div className="text-sm text-purple-600">Board Coverage</div>
                </div>
                
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">
                    {allPlayers.filter(p => p.is_active !== false).length}
                  </div>
                  <div className="text-sm text-yellow-600">Active Players</div>
                </div>
              </div>
              
              {/* Territory Distribution */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Territory Distribution</h4>
                <div className="space-y-2">
                  {allPlayers.map(p => {
                    const playerTiles = tiles.filter(t => t.player_id === p.id).length
                    const percentage = totalTiles > 0 ? (playerTiles / totalTiles) * 100 : 0
                    
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div 
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-sm">{p.name} {p.id === player.id && '(You)'}</span>
                        </div>
                        <div className="flex-1">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: p.color
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium w-10 text-right">
                          {playerTiles}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Players */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4">
                Players ({allPlayers.length}) 
                <span className="text-sm font-normal text-gray-500 ml-2">
                  • Real-time updates
                </span>
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {allPlayers.map((p, index) => (
                  <div 
                    key={p.id} 
                    className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                      p.id === player.id 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {/* Position indicator */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-200 text-gray-800' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        
                        {/* Player color and name */}
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow"
                            style={{ backgroundColor: p.color }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className={`font-medium ${p.id === player.id ? 'text-blue-700' : 'text-gray-700'}`}>
                              {p.name}
                              {p.id === player.id && ' (You)'}
                            </span>
                            <div className="text-xs text-gray-500">
                              {p.tiles_owned || 0} territories
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Score and status */}
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-gray-900 text-lg">{p.score || 0} pts</span>
                      <div className="flex items-center gap-2">
                        {/* Active indicator */}
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${p.is_active !== false ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                          <span className="text-xs text-gray-500">
                            {p.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Game Status */}
            <div className={`rounded-xl shadow-lg p-6 border-2 ${
              game.status === 'waiting' ? 'bg-yellow-50 border-yellow-300 animate-pulse' :
              game.status === 'active' ? 'bg-green-50 border-green-400' :
              'bg-gray-50 border-gray-300'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-bold text-lg ${
                    game.status === 'waiting' ? 'text-yellow-800' :
                    game.status === 'active' ? 'text-green-800' :
                    'text-gray-800'
                  }`}>
                    {game.status === 'waiting' ? '⏳ Waiting for Start' :
                     game.status === 'active' ? '🎮 Game Active!' :
                     '🏁 Game Ended'}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    game.status === 'waiting' ? 'text-yellow-700' :
                    game.status === 'active' ? 'text-green-700' :
                    'text-gray-700'
                  }`}>
                    {game.status === 'waiting' 
                      ? 'Teacher needs to start the game...' 
                      : game.status === 'active'
                      ? 'Claim tiles by answering questions!'
                      : 'Game has finished. Thanks for playing!'}
                  </p>
                </div>
                
                {game.status === 'waiting' && (
                  <div className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                    Auto-refreshing...
                  </div>
                )}
              </div>
              
              <button
                onClick={() => {
                  loadGameBoard()
                  loadPlayers()
                  // Force check game status
                  supabase
                    .from('game_sessions')
                    .select('status')
                    .eq('id', gameId)
                    .single()
                    .then(({ data }) => {
                      if (data && data.status !== game?.status) {
                        setGame(prev => prev ? { ...prev, status: data.status } : null)
                      }
                    })
                }}
                className="w-full mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                ↻ Refresh Game Status
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-8 text-center">
        <button
          onClick={() => {
            if (confirm('Are you sure you want to leave the game?')) {
              router.push('/')
            }
          }}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Leave Game
        </button>
      </footer>

      {/* Add CSS for animations */}
      <style jsx global>{`
        @keyframes tileClaim {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            transform: scale(1.1);
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
        .tile-claimed {
          animation: tileClaim 0.6s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}