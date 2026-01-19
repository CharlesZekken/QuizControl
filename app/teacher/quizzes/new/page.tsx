import { QuizCreator } from '@/components/teacher/QuizCreator'
import { AuthGuard } from '@/components/auth/AuthGuard'

export default function NewQuizPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <QuizCreator />
      </div>
    </AuthGuard>
  )
}