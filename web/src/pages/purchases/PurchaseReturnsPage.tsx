import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, RotateCcw, X, Loader2, ChevronLeft, ChevronRight,
  PackageX, IndianRupee, Building2, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { purchaseReturnApi, purchaseOrderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'

const CREDIT_METHODS = [
  { value: 'CASH',          label: 'Cash Refund' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'VENDOR_CREDIT', label: 'Vendor Credit' },
]

const CREDIT_COLORS: Record<string, string> = {
  CASH:          'bg-green-50 text-green-700',
  BANK_TRANSFER: 'bg-blue-50 text-blue-700',
  VENDOR_CREDIT: 'bg-purple-50 text-purple-700',
}

// ─── New Return Modal ──────────────────────────────────────────────────────────

function NewReturnModal({ outletId, onClose }: { outletId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [poNumber, setPoNumber]     = useState('')
  const [po, setPo]                 = useState<any>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reason, setReason]         = useState('')
  const [notes, setNotes]           = useState('')
  const [creditMethod, setCreditMethod] = useState('VENDOR_CREDIT')
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({})

  const lookupPO = async () => {
    if (!poNumber.trim()) return
    setLookupLoading(true)
    try {
      const res = await purchaseOrderApi.getByPoNumber(poNumber.trim())
      const data = res.data.data
      if (!data) { toast.error('Purchase order not found'); return }
      if (data.status === 'DRAFT' || data.status === 'SENT') {
        toast.error('Only received purchase orders can be returned')
        return
      }
      if (data.status === 'CANCELLED') {
        toast.error('Cannot return a cancelled purchase order')
        return
      }
      setPo(data)
      const init: Record<number, number> = {}
      data.items?.forEach((item: any) => { init[item.id] = 0 })
      setReturnQtys(init)
    } catch {
      toast.error('Purchase order not found')
    } finally {
      setLookupLoading(false)
    }
  }

  const totalReturn = po?.items
    ?.filter((item: any) => (returnQtys[item.id] ?? 0) > 0)
    .reduce((sum: number, item: any) => sum + (returnQtys[item.id] ?? 0) * Number(item.unitCost ?? 0), 0) ?? 0

  const handleSubmit = async () => {
    if (!po) return
    const items = po.items
      ?.filter((item: any) => (returnQtys[item.id] ?? 0) > 0)
      .map((item: any) => ({
        purchaseOrderItemId: item.id,
        productId:           item.product?.id,
        productName:         item.product?.name,
        returnedQuantity:    returnQtys[item.id],
        unitCost:            Number(item.unitCost ?? 0),
      }))

    if (!items || items.length === 0) { toast.error('Select at least one item to return'); return }
    if (!reason.trim()) { toast.error('Reason is required'); return }

    setSubmitting(true)
    try {
      await purchaseReturnApi.create({
        purchaseOrderId: po.id,
        outletId,
        reason,
        notes,
        creditMethod,
        items,
      })
      toast.success('Purchase return processed successfully')
      qc.invalidateQueries({ queryKey: ['purchase-returns'] })
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to process return')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Purchase Return</h2>
            <p className="text-xs text-gray-500 mt-0.5">Return items to supplier</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* PO Lookup */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
              Purchase Order Number
            </label>
            <div className="flex gap-2">
              <input
                value={poNumber}
                onChange={e => setPoNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupPO()}
                placeholder="e.g. PO-20240001"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
              <button onClick={lookupPO} disabled={lookupLoading || !poNumber.trim()}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                {lookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Look Up
              </button>
            </div>
          </div>

          {po && (
            <>
              {/* PO Info */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{po.poNumber}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                      <Building2 size={12} />
                      {po.supplier?.name ?? '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      ₹{Number(po.totalAmount ?? 0).toLocaleString('en-IN')}
                    </p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      po.status === 'RECEIVED' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {po.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Select Items to Return
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {po.items?.map((item: any) => {
                    const received = Number(item.receivedQuantity ?? item.orderedQuantity ?? 0)
                    const qty = returnQtys[item.id] ?? 0
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.product?.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Received: {received} &nbsp;·&nbsp; ₹{Number(item.unitCost ?? 0).toLocaleString('en-IN')} each
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setReturnQtys(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] ?? 0) - 1) }))}
                            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-base font-medium text-gray-700">
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-gray-900">{qty}</span>
                          <button
                            onClick={() => setReturnQtys(p => ({ ...p, [item.id]: Math.min(received, (p[item.id] ?? 0) + 1) }))}
                            disabled={(returnQtys[item.id] ?? 0) >= received}
                            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-base font-medium text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
                            +
                          </button>
                        </div>
                        {qty > 0 && (
                          <span className="text-xs font-semibold text-primary-600 w-20 text-right shrink-0">
                            ₹{(qty * Number(item.unitCost ?? 0)).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {totalReturn > 0 && (
                  <div className="mt-2 flex items-center justify-between px-3 py-2 bg-primary-50 rounded-lg border border-primary-100">
                    <span className="text-xs font-medium text-primary-700">Return Total</span>
                    <span className="text-sm font-bold text-primary-700">
                      ₹{totalReturn.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>

              {/* Credit Method */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                  Credit Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CREDIT_METHODS.map(m => (
                    <button key={m.value} onClick={() => setCreditMethod(m.value)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        creditMethod === m.value
                          ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white border-transparent'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Damaged goods, Wrong items received…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                  Additional Notes
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional notes…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {po && (
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0 rounded-b-2xl">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting || totalReturn === 0 || !reason.trim()}
              className="px-5 py-2 text-sm font-medium bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 flex items-center gap-2">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Process Return
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PurchaseReturnsPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [page, setPage]           = useState(0)
  const PAGE_SIZE = 15

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-returns', oid, page],
    queryFn: () => purchaseReturnApi.getByOutlet(oid, { page, size: PAGE_SIZE, sort: 'createdAt,desc' })
      .then(r => r.data.data),
    enabled: !!oid,
  })

  const returns: any[]  = data?.content ?? []
  const totalPages: number = data?.totalPages ?? 0
  const totalElements: number = data?.totalElements ?? 0

  const filtered = returns.filter(r =>
    !search ||
    r.returnNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.purchaseOrder?.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.purchaseOrder?.supplier?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Returns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Return purchased items back to suppliers</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={15} /> New Return
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg"><PackageX size={18} className="text-purple-600" /></div>
          <div>
            <p className="text-xl font-bold text-gray-900">{totalElements}</p>
            <p className="text-xs text-gray-500">Total Returns</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg"><IndianRupee size={18} className="text-emerald-600" /></div>
          <div>
            <p className="text-xl font-bold text-gray-900">
              ₹{returns.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-gray-500">Total Value (current page)</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><FileText size={18} className="text-blue-600" /></div>
          <div>
            <p className="text-xl font-bold text-gray-900">
              {new Set(returns.map(r => r.purchaseOrder?.supplier?.name).filter(Boolean)).size}
            </p>
            <p className="text-xs text-gray-500">Suppliers (current page)</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search return #, PO # or supplier…"
          className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Return #</th>
              <th className="px-4 py-3 text-left">PO Number</th>
              <th className="px-4 py-3 text-left">Supplier</th>
              <th className="px-4 py-3 text-center">Items</th>
              <th className="px-4 py-3 text-left">Credit Method</th>
              <th className="px-4 py-3 text-right">Return Value</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(8).fill(0).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <RotateCcw size={36} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">
                    {search ? 'No returns match your search' : 'No purchase returns yet'}
                  </p>
                  {!search && (
                    <button onClick={() => setShowModal(true)}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                      Process first return →
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono font-medium text-primary-600">{r.returnNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {r.purchaseOrder?.poNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-gray-900">{r.purchaseOrder?.supplier?.name ?? '—'}</p>
                      {r.purchaseOrder?.supplier?.phone && (
                        <p className="text-xs text-gray-400">{r.purchaseOrder.supplier.phone}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {r.items?.length ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${CREDIT_COLORS[r.creditMethod] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.creditMethod?.replace('_', ' ') ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                    ₹{Number(r.totalAmount ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 max-w-[160px]">
                    <p className="text-xs text-gray-500 truncate" title={r.reason}>{r.reason ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy') : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-xs text-gray-500">Page {page + 1} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`w-7 h-7 text-xs rounded-lg border transition-colors ${pg === page ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                    {pg + 1}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewReturnModal outletId={oid} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
