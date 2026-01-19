import { Tile, Player, GameState } from '@/types/game.types'

// Initialize game board
export function initializeBoard(size: number): Tile[][] {
  const board: Tile[][] = []
  
  for (let x = 0; x < size; x++) {
    const row: Tile[] = []
    for (let y = 0; y < size; y++) {
      row.push({
        x,
        y,
        ownerId: null,
        ownerName: null,
        color: '#f3f4f6', // gray-100
        claimedAt: null,
      })
    }
    board.push(row)
  }
  
  return board
}

// Generate player colors
const PLAYER_COLORS = [
  '#3B82F6', // blue-500
  '#EF4444', // red-500
  '#10B981', // green-500
  '#F59E0B', // yellow-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
]

export function getPlayerColor(playerIndex: number): string {
  return PLAYER_COLORS[playerIndex % PLAYER_COLORS.length]
}

// Calculate border positions for players
export function calculateBorderPositions(playerCount: number, boardSize: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = []
  const totalBorderCells = (boardSize * 4) - 4
  
  for (let i = 0; i < playerCount; i++) {
    const positionIndex = Math.floor((totalBorderCells / playerCount) * i)
    
    if (positionIndex < boardSize) {
      // Top border
      positions.push({ x: positionIndex, y: 0 })
    } else if (positionIndex < boardSize * 2 - 1) {
      // Right border
      positions.push({ x: boardSize - 1, y: positionIndex - boardSize + 1 })
    } else if (positionIndex < boardSize * 3 - 2) {
      // Bottom border
      positions.push({ x: boardSize * 3 - 3 - positionIndex, y: boardSize - 1 })
    } else {
      // Left border
      positions.push({ x: 0, y: totalBorderCells - positionIndex })
    }
  }
  
  return positions
}

// Check if tile is adjacent to player's territory
export function isTileAdjacentToPlayer(
  tile: { x: number; y: number },
  playerId: string,
  board: Tile[][]
): boolean {
  const directions = [
    { dx: 0, dy: 1 },   // down
    { dx: 0, dy: -1 },  // up
    { dx: 1, dy: 0 },   // right
    { dx: -1, dy: 0 },  // left
  ]
  
  for (const dir of directions) {
    const newX = tile.x + dir.dx
    const newY = tile.y + dir.dy
    
    if (
      newX >= 0 && newX < board.length &&
      newY >= 0 && newY < board[0].length
    ) {
      if (board[newX][newY].ownerId === playerId) {
        return true
      }
    }
  }
  
  return false
}

// Calculate score
export function calculatePlayerScore(playerId: string, board: Tile[][]): number {
  let score = 0
  const basePoints = 100
  
  for (const row of board) {
    for (const tile of row) {
      if (tile.ownerId === playerId) {
        score += basePoints
      }
    }
  }
  
  return score
}

// Format time (MM:SS)
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Generate a random game code
export function generateGameCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Find winner
export function findWinner(players: Player[]): Player | null {
  if (players.length === 0) return null
  
  return players.reduce((prev, current) => 
    prev.score > current.score ? prev : current
  )
}

export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}