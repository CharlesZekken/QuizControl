import { create } from 'zustand'
import { GameState, Player, Tile, Question } from '@/types/game.types'
import { pusherClient } from '@/lib/pusher-client'

interface GameStore {
  // Game State
  gameState: GameState | null
  currentPlayer: Player | null
  joinCode: string | null
  
  // UI State
  loading: boolean
  error: string | null
  connected: boolean
  
  // Actions
  joinGame: (joinCode: string, playerName: string) => Promise<{ success: boolean; error?: string }>
  leaveGame: () => void
  answerQuestion: (answerIndex: number) => Promise<{ correct: boolean; points: number }>
  claimTile: (x: number, y: number) => void
  startGame: (quizId: string) => Promise<void> // Teacher only
  endGame: () => void // Teacher only
  
  // Real-time
  subscribeToGame: (gameId: string) => void
  unsubscribeFromGame: () => void
  
  // Initialize
  initialize: (joinCode?: string) => void
}

const initialGameState: GameState = {
  id: '',
  joinCode: '',
  status: 'waiting',
  players: [],
  tiles: [],
  currentQuestion: null,
  timer: 300,
  timeLimit: 300,
  boardSize: 10,
  createdAt: new Date(),
  startedAt: null,
  endedAt: null,
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  currentPlayer: null,
  joinCode: null,
  loading: false,
  error: null,
  connected: false,

  joinGame: async (joinCode: string, playerName: string) => {
    set({ loading: true, error: null })
    
    try {
      const response = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode, playerName }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join game')
      }
      
      set({
        gameState: data.gameState,
        currentPlayer: data.player,
        joinCode,
        loading: false,
        connected: true,
      })
      
      // Subscribe to real-time updates
      get().subscribeToGame(data.gameState.id)
      
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Join failed'
      set({ error: errorMessage, loading: false })
      return { success: false, error: errorMessage }
    }
  },

  leaveGame: () => {
    const { gameState, currentPlayer } = get()
    
    if (gameState && currentPlayer) {
      // Notify server
      fetch('/api/game/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gameId: gameState.id, 
          playerId: currentPlayer.id 
        }),
      }).catch(console.error)
    }
    
    get().unsubscribeFromGame()
    set({
      gameState: null,
      currentPlayer: null,
      joinCode: null,
      connected: false,
      error: null,
    })
  },

  answerQuestion: async (answerIndex: number) => {
    const { gameState, currentPlayer } = get()
    
    if (!gameState || !currentPlayer || !gameState.currentQuestion) {
      return { correct: false, points: 0 }
    }
    
    try {
      const response = await fetch('/api/game/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameState.id,
          playerId: currentPlayer.id,
          answerIndex,
          questionId: gameState.currentQuestion.id,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Answer failed')
      }
      
      return { correct: data.correct, points: data.points }
    } catch (error) {
      console.error('Answer error:', error)
      return { correct: false, points: 0 }
    }
  },

  claimTile: async (x: number, y: number) => {
    const { gameState, currentPlayer } = get()
    
    if (!gameState || !currentPlayer) return
    
    try {
      await fetch('/api/game/claim-tile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameState.id,
          playerId: currentPlayer.id,
          tile: { x, y },
        }),
      })
    } catch (error) {
      console.error('Claim tile error:', error)
    }
  },

  startGame: async (quizId: string) => {
    const { gameState } = get()
    
    if (!gameState) return
    
    try {
      await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameState.id,
          quizId,
        }),
      })
    } catch (error) {
      console.error('Start game error:', error)
    }
  },

  endGame: async () => {
    const { gameState } = get()
    
    if (!gameState) return
    
    try {
      await fetch('/api/game/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameState.id,
        }),
      })
    } catch (error) {
      console.error('End game error:', error)
    }
  },

  subscribeToGame: (gameId: string) => {
    const pusher = pusherClient
    if (!pusher) return
    
    const channel = pusher.subscribe(`game-${gameId}`)
    
    channel.bind('player_joined', (data: any) => {
      set((state) => ({
        gameState: state.gameState ? {
          ...state.gameState,
          players: [...state.gameState.players, data.player],
        } : null,
      }))
    })
    
    channel.bind('player_left', (data: any) => {
      set((state) => ({
        gameState: state.gameState ? {
          ...state.gameState,
          players: state.gameState.players.filter(p => p.id !== data.playerId),
        } : null,
      }))
    })
    
    channel.bind('tile_claimed', (data: any) => {
      set((state) => {
        if (!state.gameState) return state
        
        const newTiles = [...state.gameState.tiles]
        if (newTiles[data.tile.x] && newTiles[data.tile.x][data.tile.y]) {
          newTiles[data.tile.x][data.tile.y] = {
            ...newTiles[data.tile.x][data.tile.y],
            ownerId: data.playerId,
            ownerName: data.playerName,
            color: data.color,
            claimedAt: new Date(),
          }
        }
        
        // Update player scores
        const updatedPlayers = state.gameState.players.map(player => {
          if (player.id === data.playerId) {
            return {
              ...player,
              score: player.score + data.points,
              tilesOwned: player.tilesOwned + 1,
            }
          }
          return player
        })
        
        return {
          gameState: {
            ...state.gameState,
            tiles: newTiles,
            players: updatedPlayers,
          },
        }
      })
    })
    
    channel.bind('question_asked', (data: any) => {
      set((state) => ({
        gameState: state.gameState ? {
          ...state.gameState,
          currentQuestion: data.question,
        } : null,
      }))
    })
    
    channel.bind('timer_update', (data: any) => {
      set((state) => ({
        gameState: state.gameState ? {
          ...state.gameState,
          timer: data.seconds,
        } : null,
      }))
    })
    
    channel.bind('game_started', () => {
      set((state) => ({
        gameState: state.gameState ? {
          ...state.gameState,
          status: 'active',
          startedAt: new Date(),
        } : null,
      }))
    })
    
    channel.bind('game_ended', (data: any) => {
      set((state) => ({
        gameState: state.gameState ? {
          ...state.gameState,
          status: 'finished',
          endedAt: new Date(),
        } : null,
      }))
    })
  },

  unsubscribeFromGame: () => {
    const pusher = pusherClient
    if (!pusher) return
    
    const { gameState } = get()
    if (gameState) {
      pusher.unsubscribe(`game-${gameState.id}`)
    }
  },

  initialize: (joinCode?: string) => {
    set({ joinCode })
    
    // Cleanup on unmount
    return () => {
      get().unsubscribeFromGame()
    }
  },
}))