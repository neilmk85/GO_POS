import { useState } from 'react'
import { X, Search, UserPlus, Loader2 } from 'lucide-react'
import { customerApi } from '@/services/api'
import { Customer } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  onClose: () => void
  onSelect: (customer: Customer) => void
}

export default function CustomerSearchModal({ onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', gstin: '' })

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await customerApi.search(q)
      setResults(res.data.data || [])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error('Name and phone are required')
      return
    }
    try {
      const res = await customerApi.create(newCustomer)
      onSelect(res.data.data)
      toast.success('Customer created')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create customer')
    }
  }

  const segmentColors: Record<string, string> = {
    REGULAR: 'bg-gray-100 text-gray-700',
    SILVER: 'bg-gray-200 text-gray-800',
    GOLD: 'bg-yellow-100 text-yellow-800',
    VIP: 'bg-purple-100 text-purple-800',
    WHOLESALE: 'bg-blue-100 text-blue-800',
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Find Customer</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, phone or email..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
          {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-auto space-y-1 mb-4">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 text-left"
            >
              <div>
                <p className="font-medium text-gray-900">{c.name}</p>
                <p className="text-sm text-gray-500">{c.phone} · {c.email}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${segmentColors[c.segment] || ''}`}>
                  {c.segment}
                </span>
                <p className="text-xs text-primary-600 mt-1">{c.loyaltyPoints} pts</p>
              </div>
            </button>
          ))}
          {query && results.length === 0 && !loading && (
            <p className="text-center text-gray-400 py-4 text-sm">No customers found</p>
          )}
        </div>

        {/* Quick Create */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-3 text-gray-500 hover:border-primary-500 hover:text-primary-600 text-sm"
          >
            <UserPlus size={16} />
            Create New Customer
          </button>
        ) : (
          <div className="space-y-3 border rounded-xl p-4">
            <h3 className="font-medium text-gray-900 text-sm">New Customer</h3>
            {[
              { field: 'name', placeholder: 'Name *' },
              { field: 'phone', placeholder: 'Phone *' },
              { field: 'email', placeholder: 'Email (optional)' },
              { field: 'gstin', placeholder: 'GST Number (optional)' },
            ].map(({ field, placeholder }) => (
              <input
                key={field}
                placeholder={placeholder}
                value={(newCustomer as any)[field]}
                onChange={(e) => setNewCustomer({ ...newCustomer, [field]: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white py-2 rounded-lg text-sm font-medium"
              >
                Create & Select
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
