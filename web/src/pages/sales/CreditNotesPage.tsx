import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, FileX, Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { creditNoteApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import CustomerSearchInput from '@/components/CustomerSearchInput'

const statusColors: Record<string, string> = {
  ACTIVE:     'bg-green-100 text-green-700',
  FULLY_USED: 'bg-gray-100  text-gray-600',
  EXPIRED:    'bg-red-100   text-red-700',
  CANCELLED:  'bg-orange-100 text-orange-700',
}

// ─── Cancel Modal ──────────────────────────────────────────────────────────────

function CancelModal({ note, onClose, onDone }: { note: any; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    if (!reason.trim()) { toast.error('Please provide a reason'); return }
    setLoading(true)
    try {
      await creditNoteApi.cancel(note.id, reason)
      toast.success('Credit note cancelled')
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to cancel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Cancel Credit Note</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Cancel <span className="font-mono font-medium">{note.creditNoteNumber}</span> of ₹{parseFloat(String(note.totalAmount ?? 0)).toFixed(2)}?
        </p>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          rows={3} placeholder="Reason for cancellation…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Back</button>
          <button onClick={handleCancel} disabled={loading}
            className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading && <Loader2 size={13} className="animate-spin" />}
            Confirm Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CreditNotesPage() {
  const { outletId } = useAuthStore()
  const qc = useQueryClient()

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [cancelTarget, setCancelTarget]         = useState<any>(null)
  const [statusFilter, setStatusFilter]         = useState('ALL')

  // ── All credit notes (React Query — always fresh on navigation) ─────────────
  const { data: allNotes = [], isFetching, refetch } = useQuery({
    queryKey: ['credit-notes', outletId],
    queryFn: () => creditNoteApi.getAll(outletId!, 0, 200).then(r => r.data.data?.content ?? []),
    enabled: !!outletId,
    staleTime: 0,           // always considered stale → refetch on every mount/focus
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // ── Customer-filtered notes (fetched on demand) ─────────────────────────────
  const { data: customerNotes, isFetching: customerFetching, refetch: refetchCustomer } = useQuery({
    queryKey: ['credit-notes-customer', selectedCustomer?.id],
    queryFn: () => creditNoteApi.getByCustomer(selectedCustomer!.id).then(r => r.data.data ?? []),
    enabled: !!selectedCustomer,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  const notes: any[] = selectedCustomer ? (customerNotes ?? []) : allNotes
  const notesLoading  = selectedCustomer ? customerFetching : isFetching

  const filtered = notes.filter(n => statusFilter === 'ALL' || n.status === statusFilter)

  const totalActive = notes
    .filter(n => n.status === 'ACTIVE')
    .reduce((s, n) => s + parseFloat(String(n.remainingAmount ?? 0)), 0)

  function handleRefresh() {
    if (selectedCustomer) refetchCustomer()
    else refetch()
  }

  return (
    <div className="p-6">
      {/* Hero Header */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] mb-6">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
        </div>
        {/* Top row */}
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <FileX size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Sales</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Credit Notes</h1>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={notesLoading}
            className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={notesLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{notes.length}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{notes.filter(n => n.status === 'ACTIVE').length}</p>
            <p className="text-violet-200 text-xs mt-0.5">Active</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">₹{totalActive.toFixed(2)}</p>
            <p className="text-violet-200 text-xs mt-0.5">Available Credit</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{notes.filter(n => n.status === 'EXPIRED').length}</p>
            <p className="text-violet-200 text-xs mt-0.5">Expired</p>
          </div>
        </div>
      </div>

      {/* Customer search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filter by Customer</p>
        <div className="max-w-md">
          <CustomerSearchInput
            value={selectedCustomer}
            onSelect={c => { setSelectedCustomer(c) }}
            onClear={() => setSelectedCustomer(null)}
          />
        </div>
        {selectedCustomer && totalActive > 0 && (
          <p className="mt-2 text-xs text-green-700 font-medium">₹{totalActive.toFixed(2)} available credit</p>
        )}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['ALL', 'ACTIVE', 'FULLY_USED', 'EXPIRED', 'CANCELLED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {s === 'ALL' ? 'All' : s === 'FULLY_USED' ? 'Fully Used' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Credit Note #</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Original Amount</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Used</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Remaining</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Reason</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Expiry</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {notesLoading ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16">
                  <FileX size={36} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">No credit notes found</p>
                </td>
              </tr>
            ) : filtered.map((n: any) => {
              const total     = parseFloat(String(n.totalAmount    ?? 0))
              const used      = parseFloat(String(n.usedAmount     ?? 0))
              const remaining = parseFloat(String(n.remainingAmount ?? 0))
              return (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm text-primary-600">{n.creditNoteNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{n.customer?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">₹{total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500">
                    {used > 0 ? <span className="text-orange-600">−₹{used.toFixed(2)}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-green-700">
                    ₹{remaining.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{n.reason ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {n.expiryDate ? new Date(n.expiryDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[n.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {n.status === 'FULLY_USED' ? 'Fully Used' : n.status.charAt(0) + n.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {n.status === 'ACTIVE' && (
                      <button onClick={() => setCancelTarget(n)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {cancelTarget && (
        <CancelModal
          note={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['credit-notes'] })
            qc.invalidateQueries({ queryKey: ['credit-notes-customer'] })
            setCancelTarget(null)
          }}
        />
      )}
    </div>
  )
}
