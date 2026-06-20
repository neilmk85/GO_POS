import { Clock } from 'lucide-react'

export default function ShiftTemplatesPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <Clock size={28} className="text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Shift Templates is Being Set Up</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          This section is currently unavailable while we configure shift templates for your production schedule.
          Please check back soon.
        </p>
        <p className="mt-4 text-xs text-gray-400">Contact your system administrator if you need immediate access.</p>
      </div>
    </div>
  )
}
