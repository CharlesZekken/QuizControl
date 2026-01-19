'use client'

import { Question } from '@/types/game.types'

interface QuestionBoxProps {
  question: Question | null
  onAnswer: (answerIndex: number) => void
  disabled?: boolean
}

export function QuestionBox({ question, onAnswer, disabled = false }: QuestionBoxProps) {
  if (!question) {
    return (
      <div className="text-center p-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Waiting for Question</h3>
        <p className="text-gray-500">Select a tile to get a question!</p>
      </div>
    )
  }

  const optionLabels = ['A', 'B', 'C', 'D']

  return (
    <div>
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-1">Question</div>
        <h3 className="text-lg font-semibold text-gray-800">{question.question}</h3>
        <div className="mt-2 text-sm text-gray-600">
          Category: <span className="font-medium">{question.category || 'General'}</span>
          <span className="mx-2">•</span>
          Points: <span className="font-medium">{question.points}</span>
        </div>
      </div>

      <div className="space-y-3">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => onAnswer(index)}
            disabled={disabled}
            className={cn(
              'w-full p-4 text-left rounded-lg border transition-all',
              'hover:bg-gray-50 hover:border-gray-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center gap-3'
            )}
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 font-bold text-gray-700">
              {optionLabels[index]}
            </div>
            <span className="font-medium text-gray-800">{option}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500 text-center">
          Select an answer to claim the tile
        </p>
      </div>
    </div>
  )
}

// Helper function
function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}