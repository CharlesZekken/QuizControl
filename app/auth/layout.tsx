export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <a href="/" className="inline-block">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              🏰 QuizControl
            </h1>
          </a>
          <p className="text-gray-600">
            Game-based learning for classrooms
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}