import { ArrowLeftRight, Clock } from 'lucide-react'

export default function TransfersPage() {
  return (
    <>
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <ArrowLeftRight size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Site Stock Transfers</h1>
            <p className="text-xs text-white/70">Move stock between outlets</p>
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-violet-50 flex items-center justify-center mb-6">
          <Clock size={36} className="text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Coming Soon</h2>
        <p className="text-gray-400 max-w-sm leading-relaxed">
          Site stock transfers are currently under development. This feature will let you move inventory between outlets seamlessly.
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs text-violet-500 font-medium bg-violet-50 px-4 py-2 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          We're working on it
        </div>
      </div>
    </>
  )
}
