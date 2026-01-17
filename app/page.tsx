export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">
        Territory Quiz Game
      </h1>
      <p className="text-center text-gray-600 mb-8">
        Battle for knowledge, claim territories, become the champion!
      </p>
      
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Teacher Section */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-blue-700 mb-4">For Teachers</h2>
          <p className="mb-4">Create quizzes, host games, track student progress.</p>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
            Teacher Login
          </button>
        </div>
        
        {/* Student Section */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-green-700 mb-4">For Students</h2>
          <p className="mb-4">Join games, answer questions, conquer territories!</p>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Enter Game Code" 
              className="w-full p-3 border rounded-lg"
            />
            <input 
              type="text" 
              placeholder="Your Name" 
              className="w-full p-3 border rounded-lg"
            />
            <button className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition w-full">
              Join Game
            </button>
          </div>
        </div>
      </div>
      
      {/* Game Board Preview */}
      <div className="mt-12 max-w-2xl mx-auto">
        <h3 className="text-xl font-bold text-center mb-4">How It Works</h3>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 25 }).map((_, i) => (
            <div 
              key={i}
              className={`aspect-square rounded-lg border-2 ${
                i % 5 === 0 ? 'bg-blue-200 border-blue-400' : 
                i % 3 === 0 ? 'bg-green-200 border-green-400' : 
                'bg-gray-100 border-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}