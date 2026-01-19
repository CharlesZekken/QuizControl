'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface Question {
  id?: string
  question: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: 'A' | 'B' | 'C' | 'D'
  points: number
  category: string
}

interface QuizCreatorProps {
  quizId?: string
  initialData?: {
    title: string
    description: string
    questions: Question[]
  }
}

export function QuizCreator({ quizId, initialData }: QuizCreatorProps) {
  const router = useRouter()
  const { user } = useAuthStore()
  
  const [quizTitle, setQuizTitle] = useState(initialData?.title || '')
  const [quizDescription, setQuizDescription] = useState(initialData?.description || '')
  const [questions, setQuestions] = useState<Question[]>(
    initialData?.questions || [
      {
        question: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: 'A',
        points: 100,
        category: 'General'
      }
    ]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: 'A',
        points: 100,
        category: 'General'
      }
    ])
  }

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index))
    }
  }

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updatedQuestions = [...questions]
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value
    }
    setQuestions(updatedQuestions)
  }

  const validateQuiz = (): boolean => {
    if (!quizTitle.trim()) {
      setError('Quiz title is required')
      return false
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question.trim()) {
        setError(`Question ${i + 1}: Question text is required`)
        return false
      }
      if (!q.optionA.trim() || !q.optionB.trim()) {
        setError(`Question ${i + 1}: At least options A and B are required`)
        return false
      }
      if (q.points < 10 || q.points > 1000) {
        setError(`Question ${i + 1}: Points must be between 10 and 1000`)
        return false
      }
    }

    setError('')
    return true
  }

const saveQuiz = async () => {
  if (!user) {
    setError('You must be logged in to save a quiz')
    return
  }

  if (!validateQuiz()) return

  setSaving(true)
  setError('')

  try {
    console.log('User ID:', user.id)
    console.log('Quiz data to save:', {
      title: quizTitle,
      description: quizDescription,
      questionsCount: questions.length
    })
    
    let quiz
    
    if (quizId) {
      console.log('Updating quiz:', quizId)
      const { data, error } = await supabase
        .from('quizzes')
        .update({
          title: quizTitle,
          description: quizDescription
        })
        .eq('id', quizId)
        .select()
        .single()

      console.log('Update response:', { data, error })
      if (error) throw error
      quiz = data
    } else {
      console.log('Creating new quiz')
      const { data, error } = await supabase
        .from('quizzes')
        .insert({
          title: quizTitle,
          description: quizDescription,
          teacher_id: user.id
        })
        .select()
        .single()

      console.log('Create response:', { data, error })
      if (error) throw error
      quiz = data
    }

    console.log('Quiz saved, ID:', quiz.id)
    
    // Save questions
    console.log('Saving', questions.length, 'questions')
    for (const [index, question] of questions.entries()) {
      if (question.id) {
        console.log(`Updating question ${index + 1}:`, question.id)
        const { error } = await supabase
          .from('questions')
          .update({
            question_text: question.question,
            option_a: question.optionA,
            option_b: question.optionB,
            option_c: question.optionC,
            option_d: question.optionD,
            correct_answer: question.correctAnswer,
            points: question.points,
            category: question.category
          })
          .eq('id', question.id)
        
        if (error) {
          console.error(`Error updating question ${index + 1}:`, error)
          throw error
        }
      } else {
        console.log(`Creating question ${index + 1}`)
        const { error } = await supabase
          .from('questions')
          .insert({
            quiz_id: quiz.id,
            question_text: question.question,
            option_a: question.optionA,
            option_b: question.optionB,
            option_c: question.optionC,
            option_d: question.optionD,
            correct_answer: question.correctAnswer,
            points: question.points,
            category: question.category
          })
        
        if (error) {
          console.error(`Error creating question ${index + 1}:`, error)
          throw error
        }
      }
    }

    console.log('All questions saved successfully')
    alert(quizId ? 'Quiz updated successfully!' : 'Quiz created successfully!')
    router.push('/teacher/dashboard')
    router.refresh()

  } catch (error: any) {
    console.error('Save error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    setError(error.message || 'Failed to save quiz')
  } finally {
    setSaving(false)
  }
}

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {quizId ? 'Edit Quiz' : 'Create New Quiz'}
        </h1>
        <p className="text-gray-600">
          Build your Quiz Control quiz. Add questions with multiple choice answers.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Quiz Info */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Quiz Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quiz Title *
            </label>
            <input
              type="text"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="e.g., Math Basics Quiz"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={quizDescription}
              onChange={(e) => setQuizDescription(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Describe what this quiz covers..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Questions ({questions.length})</h2>
          <button
            onClick={addQuestion}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
          >
            + Add Question
          </button>
        </div>

        {questions.map((question, index) => (
          <div key={index} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-gray-900">Question {index + 1}</h3>
              {questions.length > 1 && (
                <button
                  onClick={() => removeQuestion(index)}
                  className="px-3 py-1 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Question Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question Text *
                </label>
                <textarea
                  value={question.question}
                  onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Enter your question here..."
                  rows={2}
                  required
                />
              </div>

              {/* Category and Points */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={question.category}
                    onChange={(e) => updateQuestion(index, 'category', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="General">General</option>
                    <option value="Math">Math</option>
                    <option value="Science">Science</option>
                    <option value="History">History</option>
                    <option value="Geography">Geography</option>
                    <option value="English">English</option>
                    <option value="Technology">Technology</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points
                  </label>
                  <input
                    type="number"
                    value={question.points}
                    onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 100)}
                    min="10"
                    max="1000"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['A', 'B', 'C', 'D'] as const).map((option) => (
                  <div key={option}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Option {option} {option === 'A' || option === 'B' ? '*' : ''}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={question[`option${option}` as keyof Question] as string}
                        onChange={(e) => updateQuestion(index, `option${option}` as keyof Question, e.target.value)}
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        placeholder={`Option ${option}`}
                        required={option === 'A' || option === 'B'}
                      />
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`correct-${index}`}
                          checked={question.correctAnswer === option}
                          onChange={() => updateQuestion(index, 'correctAnswer', option)}
                          className="w-5 h-5 text-blue-600"
                        />
                        <span className="ml-2 text-sm text-gray-700">Correct</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save Actions */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <div className="flex justify-end gap-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={saveQuiz}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : quizId ? 'Update Quiz' : 'Create Quiz'}
          </button>
        </div>
        <p className="mt-4 text-sm text-gray-500 text-center">
          * Required fields. At least 2 options (A and B) are required per question.
        </p>
      </div>
    </div>
  )
}