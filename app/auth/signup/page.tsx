import { SignupForm } from '@/components/auth/SignupForm'
import { AuthGuard } from '@/components/auth/AuthGuard'

export default function SignupPage() {
  return (
    <AuthGuard requireAuth={false}>
      <SignupForm />
    </AuthGuard>
  )
}