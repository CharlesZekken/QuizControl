'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { QuizCreator } from '@/components/teacher/QuizCreator'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { supabase } from '@/lib/supabase'

export default function EditQuizPage() {
  const params = useParams()
  const quizId = params.id as string
  const [loading, setLoading] = useState(true)
  const [quizData, setQuizData] = useState<any>(null)

  useEffect(() => {
    loadQuiz()
  }, [quizId])

  const loadQuiz = async () => {
    try {
      // Load quiz info
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single()

      if (quizError) throw quizError

      // Load questions
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('created_at')

      if (questionsError) throw questionsError

      setQuizData({
        title: quiz.title,
        description: quiz.description || '',
        questions: questions.map(q => ({
          id: q.id,
          question: q.question_text,
          optionA: q.option_a,
          optionB: q.option_b,
          optionC: q.option_c || '',
          optionD: q.option_d || '',
          correctAnswer: q.correct_answer,
          points: q.points || 100,
          category: q.category || 'General'
        }))
      })
    } catch (error) {
      console.error('Error loading quiz:', error)
    } finally {
      setLoading(false)
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

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <QuizCreator quizId={quizId} initialData={quizData} />
      </div>
    </AuthGuard>
  )
}