import { useState, useEffect, useRef } from 'react'
import { X, UserPlus, Loader2, Users } from 'lucide-react'
import { customerApi } from '@/services/api'
import toast from 'react-hot-toast'

interface Customer {
  id: number
  name: string
  phone?: string
  email?: string
}

interface Props {
  value: Customer | null
  onSelect: (customer: Customer) => void
  onClear: () => void
  placeholder?: string
  label?: string
}

export default function CustomerSearchInput({
  value,
  onSelect,
  onClear,
  placeholder = 'Search customer by name or phone…',
  label,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', gstin: '' })
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropOpen(false)
        setShowCreate(false)
        setQuery('')
        setResults([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await customerApi.search(query)
        setResults(res.data.data ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const handleSelect = (c: Customer) => {
    onSelect(c)
    setQuery('')
    setResults([])
    setDropOpen(false)
    setShowCreate(false)
  }

  const handleCreate = async () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast.error('Name and phone are required')
      return
    }
    setCreating(true)
    try {
      const res = await customerApi.create(newCustomer)
      toast.success('Customer created')
      handleSelect(res.data.data)
      setNewCustomer({ name: '', phone: '', email: '', gstin: '' })
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to create customer')
    } finally {
      setCreating(false)
    }
  }

  // Show dropdown when focused and query is long enough
  const showDropdown = dropOpen && query.trim().length >= 2

  // ── Selected chip ──────────────────────────────────────────────────────────
  if (value) {
    return (
      <div>
        {label && (
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
        )}
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-primary-50">
          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary-600">{value.name[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{value.name}</p>
            {value.phone && <p className="text-xs text-gray-500 truncate">{value.phone}</p>}
          </div>
          <button type="button" onClick={onClear} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  // ── Search + inline create form ────────────────────────────────────────────
  return (
    <div ref={ref}>
      {label && (
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:border-primary-400">
          <Users size={13} className="text-gray-400 shrink-0" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setDropOpen(true) }}
            onFocus={() => { if (query.trim().length >= 2) setDropOpen(true) }}
            placeholder={placeholder}
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent focus:outline-none"
          />
          {loading && <Loader2 size={13} className="animate-spin text-gray-400 shrink-0" />}
        </div>

        {/* Dropdown: results + "Add new customer" button at the bottom */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[200] overflow-hidden">
            {results.length > 0 && (
              <div className="max-h-40 overflow-y-auto">
                {results.map(c => (
                  <button key={c.id} type="button"
                    onMouseDown={e => { e.preventDefault(); handleSelect(c) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone ?? c.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loading && results.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">No customers found</p>
            )}

            {/* Add new customer — always at bottom of dropdown */}
            <div className="border-t border-gray-100">
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDropOpen(false)
                  setShowCreate(true)
                  setQuery('')
                  setResults([])
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
              >
                <UserPlus size={14} />
                Add new customer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inline "Add new customer" link when dropdown isn't open */}
      {!showDropdown && !showCreate && (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          <UserPlus size={12} /> Add new customer
        </button>
      )}

      {/* Inline create form */}
      {showCreate && (
        <div className="mt-2 border border-primary-200 rounded-xl p-3 space-y-2 bg-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">New Customer</p>
            <button type="button"
              onMouseDown={e => { e.preventDefault(); setShowCreate(false) }}
              className="text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          </div>
          <input
            placeholder="Name *"
            value={newCustomer.name}
            onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
          />
          <input
            placeholder="Phone *"
            value={newCustomer.phone}
            onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
          />
          <input
            placeholder="Email (optional)"
            value={newCustomer.email}
            onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
          />
          <input
            placeholder="GST Number (optional)"
            value={newCustomer.gstin}
            onChange={e => setNewCustomer(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-1.5 text-xs font-medium bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {creating ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />}
            Create & Select
          </button>
        </div>
      )}
    </div>
  )
}
