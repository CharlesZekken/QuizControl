// Game Board Types
export interface Tile {
  x: number
  y: number
  ownerId: string | null
  ownerName: string | null
  color: string
  claimedAt: Date | null
}

export interface Player {
  id: string
  name: string
  color: string
  score: number
  position: { x: number; y: number }
  connected: boolean
  lastActive: Date
  tilesOwned: number
}

export interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: number // 0-3 index
  points: number
  category?: string
}

export interface GameState {
  id: string
  joinCode: string
  status: 'waiting' | 'active' | 'finished'
  players: Player[]
  tiles: Tile[][]
  currentQuestion: Question | null
  timer: number // seconds remaining
  timeLimit: number // total game time in seconds
  boardSize: number
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
}

export interface GameAction {
  type: 'tile_claimed' | 'player_joined' | 'player_left' | 'question_answered' | 'game_started' | 'game_ended'
  playerId: string
  data: any
  timestamp: Date
}

// Real-time event types
export type GameEvent = 
  | { type: 'player_joined'; player: Player }
  | { type: 'player_left'; playerId: string }
  | { type: 'tile_claimed'; playerId: string; tile: { x: number; y: number } }
  | { type: 'question_asked'; question: Question }
  | { type: 'question_answered'; playerId: string; correct: boolean; tile: { x: number; y: number } }
  | { type: 'timer_update'; seconds: number }
  | { type: 'game_started' }
  | { type: 'game_ended'; winner: Player }
  | { type: 'error'; message: string }