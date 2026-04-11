import { useState } from 'react'
import { Search, Plus, Eye, Truck, Package, X, Loader2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { orderApi, customerApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      'bg-gray-100   text-gray-700',
  DISPATCHED: 'bg-blue-100   text-blue-700',
  DELIVERED:  'bg-green-100  text-green-700',
  CANCELLED:  'bg-red-100    text-red-700',
}

// ─── Create Challan Modal ──────────────────────────────────────────────────────

function CreateChallanModal({ onClose, outletId }: { onClose: () => void; outletId: number }) {
  const qc = useQueryClient()
  const [step, setStep] = useState<'order' | 'details'>('order')
  const [orderNumber, setOrderNumber] = useState('')
  const [order, setOrder]  = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  const [form, setForm] = useState({
    deliveryAddress: '',
    contactPerson: '',
    contactPhone: '',
    vehicleNo: '',
    notes: '',
  })

  async function lookupOrder() {
    if (!orderNumber.trim()) return
    setLoading(true)
    try {
      const res = await orderApi.getByOrderNumber(orderNumber.trim())
      if (!res.data.data) { toast.error('Order not found'); return }
      setOrder(res.data.data)
      setForm(f => ({ ...f, deliveryAddress: res.data.data.customer?.address ?? '' }))
      setStep('details')
    } catch {
      toast.error('Order not found')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.deliveryAddress.trim()) { toast.error('Delivery address is required'); return }
    setSaving(true)
    try {
      await api.post('/delivery-challans', {
        orderId: order.id,
        outletId,
        ...form,
      })
      toast.success('Delivery challan created')
      qc.invalidateQueries({ queryKey: ['delivery-challans'] })
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to create challan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">New Delivery Challan</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          {step === 'order' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
                <div className="flex gap-2">
                  <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lookupOrder()}
                    placeholder="e.g. ORD-20240001"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                  <button onClick={lookupOrder} disabled={loading}
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                    {loading && <Loader2 size={13} className="animate-spin" />}
                    Look Up
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900">{order.orderNumber}</p>
                <p className="text-gray-500">{order.customer?.name ?? 'Walk-in'} · {order.items?.length} item(s)</p>
              </div>

              {[
                { key: 'deliveryAddress', label: 'Delivery Address *', type: 'textarea' },
                { key: 'contactPerson',   label: 'Contact Person' },
                { key: 'contactPhone',    label: 'Contact Phone' },
                { key: 'vehicleNo',       label: 'Vehicle Number' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  {type === 'textarea' ? (
                    <textarea value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none" />
                  ) : (
                    <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                  )}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep('order')} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Back</button>
                <button onClick={handleCreate} disabled={saving}
                  className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Create Challan
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DeliveryChallansPage() {
  const { outletId } = useAuthStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-challans', outletId],
    queryFn: () => api.get(`/delivery-challans/outlet/${outletId}`).then(r => (r.data as any).data ?? []),
    enabled: !!outletId,
  })

  const challans: any[] = data ?? []

  const filtered = challans.filter((c: any) => {
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter
    const matchSearch = !search ||
      c.challanNumber?.toLowerCase().includes(search.toLowerCase()) ||
      c.order?.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      c.order?.customer?.name?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Challans</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track outgoing deliveries</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={15} /> New Challan
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search challan, order or customer…"
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          {['ALL', 'DRAFT', 'DISPATCHED', 'DELIVERED', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Challan #</th>
              <th className="px-4 py-3 text-left">Order #</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Delivery Address</th>
              <th className="px-4 py-3 text-left">Vehicle</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <Truck size={40} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">No delivery challans found</p>
                  <button onClick={() => setShowCreate(true)}
                    className="mt-3 text-sm text-primary-600 hover:underline font-medium">
                    Create your first challan
                  </button>
                </td>
              </tr>
            ) : filtered.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm text-primary-600">{c.challanNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-700 font-mono">{c.order?.orderNumber ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{c.order?.customer?.name ?? 'Walk-in'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{c.deliveryAddress}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.vehicleNo ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && outletId && (
        <CreateChallanModal onClose={() => setShowCreate(false)} outletId={outletId} />
      )}
    </div>
  )
}
