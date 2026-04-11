import { useState, useRef, useEffect } from 'react'
import { Calendar, Check, X, ChevronDown } from 'lucide-react'

interface Props {
  label: string
  value: string
  onChange: (val: string) => void
  min?: string
  max?: string
  placeholder?: string
}

export default function DateTimePicker({ label, value, onChange, min, max, placeholder = 'Not set' }: Props) {
  const [open, setOpen] = useState(false)
  const [staged, setStaged] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  // Keep staged in sync when value changes externally (e.g. on form reset)
  useEffect(() => { setStaged(value) }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setStaged(value) // discard unsaved changes
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, value])

  const formatted = value
    ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    : placeholder

  const handleApply = () => {
    onChange(staged)
    setOpen(false)
  }

  const handleClear = () => {
    setStaged('')
    onChange('')
    setOpen(false)
  }

  const isInvalid = staged && min && staged <= min
  const isInvalidMax = staged && max && staged >= max

  return (
    <div className="relative" ref={ref}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

      {/* Display trigger */}
      <button
        type="button"
        onClick={() => { setStaged(value); setOpen(o => !o) }}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm transition-colors text-left
          ${value ? 'border-gray-300 text-gray-800' : 'border-gray-200 text-gray-400'}
          ${open ? 'ring-2 ring-sky-500 border-sky-500' : 'hover:border-gray-400'}`}
      >
        <span className="flex items-center gap-2">
          <Calendar size={14} className={value ? 'text-sky-500' : 'text-gray-300'} />
          {formatted}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
            <input
              type="datetime-local"
              value={staged}
              min={min}
              max={max}
              onChange={(e) => setStaged(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none bg-gray-50"
            />
            {(isInvalid || isInvalidMax) && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <X size={11} />
                {isInvalid ? 'Must be after start date' : 'Must be before end date'}
              </p>
            )}
          </div>

          <div className="flex gap-2 px-4 pb-4 pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 font-medium transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!!(isInvalid || isInvalidMax)}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:from-sky-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Check size={14} /> Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
