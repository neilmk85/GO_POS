import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, RotateCcw, X, Loader2, Plus } from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns'
import toast from 'react-hot-toast'
import { orderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ─── Return Modal ──────────────────────────────────────────────────────────────

function ProcessReturnModal({ onClose, outletId }: { onClose: () => void; outletId: number }) {
  const qc = useQueryClient()
  const [orderNumber, setOrderNumber] = useState('')
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [returnItems, setReturnItems] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState('CASH')

  async function lookupOrder() {
    if (!orderNumber.trim()) return
    setLoading(true)
    try {
      const res = await orderApi.getByOrderNumber(orderNumber.trim())
      const o = res.data.data
      if (!o) { toast.error('Order not found'); return }
      if (o.status === 'REFUNDED') { toast.error('Order already fully refunded'); return }
      if (o.status !== 'COMPLETED') { toast.error('Only completed orders can be returned'); return }
      setOrder(o)
      const init: Record<number, number> = {}
      o.items?.forEach((item: any) => { init[item.id] = 0 })
      setReturnItems(init)
    } catch {
      toast.error('Order not found')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    const items = Object.entries(returnItems)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ orderItemId: parseInt(id), returnQuantity: qty }))
    if (items.length === 0) { toast.error('Select at least one item to return'); return }
    if (!reason.trim()) { toast.error('Please provide a reason'); return }
    setSubmitting(true)
    try {
      await orderApi.processReturn({ originalOrderId: order.id, items, reason, returnMethod: refundMethod })
      toast.success('Return processed successfully')
      qc.invalidateQueries({ queryKey: ['orders-returns'] })
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to process return')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">Process Return</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Order lookup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
            <div className="flex gap-2">
              <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupOrder()}
                placeholder="e.g. ORD-20240001"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
              <button onClick={lookupOrder} disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                Look Up
              </button>
            </div>
          </div>

          {order && (
            <>
              {/* Customer */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900">{order.customer?.name ?? 'Walk-in'}</p>
                <p className="text-gray-500">Order Total: ₹{parseFloat(String(order.totalAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>

              {/* Items */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Select items to return</p>
                <div className="space-y-2 max-h-48 overflow-auto">
                  {order.items?.map((item: any) => {
                    const alreadyReturned = parseFloat(String(item.returnedQuantity ?? 0))
                    const available = item.quantity - alreadyReturned
                    return (
                      <div key={item.id} className="flex items-center justify-between p-2.5 border border-gray-200 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                          <p className="text-xs text-gray-500">
                            Ordered: {item.quantity} · Available: {available} · ₹{parseFloat(String(item.unitPrice)).toFixed(2)} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setReturnItems(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1) }))}
                            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm">−</button>
                          <span className="w-6 text-center text-sm font-medium">{returnItems[item.id] ?? 0}</span>
                          <button onClick={() => setReturnItems(prev => ({ ...prev, [item.id]: Math.min(available, (prev[item.id] ?? 0) + 1) }))}
                            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm">+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  rows={2} placeholder="Reason for return…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none" />
              </div>

              {/* Refund method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refund Method</label>
                <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none">
                  {['CASH', 'CARD', 'UPI', 'CREDIT_NOTE'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>

              <button onClick={handleSubmit} disabled={submitting}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2">
                {submitting && <Loader2 size={15} className="animate-spin" />}
                Confirm Return
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', CARD: 'Card', UPI: 'UPI',
  NET_BANKING: 'Net Banking', CREDIT_NOTE: 'Credit Note',
  LOYALTY_POINTS: 'Loyalty Points', CREDIT_SALE: 'Credit Sale',
}

const METHOD_COLORS: Record<string, string> = {
  CASH: 'bg-green-100 text-green-700',
  CARD: 'bg-blue-100 text-blue-700',
  UPI: 'bg-purple-100 text-purple-700',
  NET_BANKING: 'bg-indigo-100 text-indigo-700',
  CREDIT_NOTE: 'bg-orange-100 text-orange-700',
  LOYALTY_POINTS: 'bg-yellow-100 text-yellow-700',
  CREDIT_SALE: 'bg-red-100 text-red-700',
}

function fmtMethod(method: string | undefined) {
  if (!method) return null
  const key = method.toUpperCase()
  return { label: METHOD_LABELS[key] ?? method, color: METHOD_COLORS[key] ?? 'bg-gray-100 text-gray-700' }
}

const today = new Date()
const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

const DATE_PRESETS = [
  { label: 'Today',        from: fmt(today),                            to: fmt(today) },
  { label: 'Yesterday',    from: fmt(subDays(today, 1)),                to: fmt(subDays(today, 1)) },
  { label: 'This Week',    from: fmt(startOfWeek(today, { weekStartsOn: 1 })), to: fmt(endOfWeek(today, { weekStartsOn: 1 })) },
  { label: 'Last Week',    from: fmt(startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })), to: fmt(endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })) },
  { label: 'This Month',   from: fmt(startOfMonth(today)),              to: fmt(endOfMonth(today)) },
  { label: 'Last Month',   from: fmt(startOfMonth(subMonths(today, 1))), to: fmt(endOfMonth(subMonths(today, 1))) },
  { label: 'Last 30 Days', from: fmt(subDays(today, 29)),               to: fmt(today) },
  { label: 'Last 90 Days', from: fmt(subDays(today, 89)),               to: fmt(today) },
  { label: 'This Quarter', from: fmt(startOfQuarter(today)),            to: fmt(endOfQuarter(today)) },
  { label: 'Last Quarter', from: fmt(startOfQuarter(subQuarters(today, 1))), to: fmt(endOfQuarter(subQuarters(today, 1))) },
]

export default function ReturnsPage() {
  const { outletId } = useAuthStore()
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [from, setFrom] = useState(fmt(subDays(today, 29)))
  const [to,   setTo]   = useState(fmt(today))
  const [activePreset, setActivePreset] = useState('Last 30 Days')

  function applyPreset(preset: typeof DATE_PRESETS[0]) {
    setFrom(preset.from)
    setTo(preset.to)
    setActivePreset(preset.label)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['orders-returns', outletId, from, to],
    queryFn: () => orderApi.getReturns(outletId!, { from, to }).then(r => r.data.data),
    enabled: !!outletId,
  })

  const returns: any[] = data?.content ?? []

  const filtered = returns.filter((o: any) =>
    !search ||
    o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
            <p className="text-sm text-gray-500 mt-0.5">Process and track order returns & refunds</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus size={15} /> Process Return
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activePreset === p.label
                  ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    <div className="p-6">
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search order or customer…"
          className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Return #</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Items Returned</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Refund Amount</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Refund Method</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <RotateCcw size={36} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">No returns found</p>
                </td>
              </tr>
            ) : filtered.map((o: any) => {
              const method = fmtMethod(o.payments?.[0]?.paymentMethod ?? o.notes)
              return (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm text-violet-600">{o.orderNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{o.customer?.name ?? 'Walk-in'}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-600">
                  {o.items?.reduce((s: number, i: any) => s + parseFloat(String(i.quantity ?? 0)), 0)}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-right text-red-600">
                  ₹{Math.abs(parseFloat(String(o.totalAmount ?? 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  {method
                    ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${method.color}`}>{method.label}</span>
                    : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                  {o.items?.[0]?.notes ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(o.createdAt)}</td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {showModal && outletId && (
        <ProcessReturnModal onClose={() => setShowModal(false)} outletId={outletId} />
      )}
    </div>
    </div>
  )
}
