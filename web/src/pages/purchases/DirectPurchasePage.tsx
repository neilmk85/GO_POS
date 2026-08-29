import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus, Search, Package, ChevronLeft, ChevronRight,
  X, History, Pencil,
} from 'lucide-react'
import { purchaseOrderApi, outletApi } from '@/services/api'
import { DateRangePicker } from '@/components/DateRangePicker'
import { useAuthStore } from '@/store/authStore'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '₹0'
  return '₹' + Math.round(v).toLocaleString('en-IN')
}
function fmtNum(n: any, d = 2) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v) || v === 0) return '0'
  return v % 1 === 0 ? v.toLocaleString() : parseFloat(v.toFixed(d)).toLocaleString()
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CHEQUE: 'Cheque', BANK_TRANSFER: 'Bank Transfer', CARD: 'Card', OTHER: 'Other',
}
function paymentBadge(po: any) {
  const bill = po.sourceBills?.[0]
  if (!bill) return { label: 'Cash', color: 'text-emerald-600' }
  const method = bill.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[bill.paymentMethod] ?? bill.paymentMethod}` : ''
  if (bill.status === 'PAID')    return { label: `Paid${method}`, color: 'text-emerald-600' }
  if (bill.status === 'PARTIAL') return { label: `Partial${method}`, color: 'text-amber-600' }
  return { label: 'Unpaid', color: 'text-red-600' }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DirectPurchasePage() {
  const navigate = useNavigate()
  const { outletId } = useAuthStore()

  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(outletId)
  const effectiveOutletId = selectedOutletId

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletApi.getAll().then(r => r.data.data ?? []),
  })
  useEffect(() => {
    if (selectedOutletId || (outlets as any[]).length === 0) return
    const main = (outlets as any[]).find((o: any) => o.name.toLowerCase().includes('main store')) ?? (outlets as any[])[0]
    if (main) setSelectedOutletId((main as any).id)
  }, [outlets])

  // Date filter
  const [from, setFrom] = useState('')
  const [to, setTo]     = useState('')
  function handleDateChange(f: string, t: string) { setFrom(f); setTo(t); setHistPage(0) }

  // Search
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput); setHistPage(0) }, 300); return () => clearTimeout(t) }, [searchInput])

  // History
  const [histPage, setHistPage] = useState(0)
  const { data: histData } = useQuery({
    queryKey: ['purchase-orders', effectiveOutletId, histPage, from, to, search],
    queryFn: () => purchaseOrderApi.getByOutlet(effectiveOutletId!, {
      page: histPage, size: 10,
      ...(from   && { from }),
      ...(to     && { to }),
      ...(search && { q: search }),
    }).then(r => r.data.data),
    enabled: !!effectiveOutletId,
  })
  const history: any[]       = histData?.content ?? []
  const totalHistPages: number = histData?.totalPages ?? 1

  // PO Detail Modal
  const [selectedPO, setSelectedPO] = useState<any>(null)


  return (
    <div className="min-h-full bg-gray-50">

      {/* Hero Header */}
      <div className="p-6 pb-0">
        <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] mb-6">
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
            <div className="absolute inset-0 opacity-[0.15]"
              style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
          </div>
          <div className="relative flex items-center justify-between px-8 py-6">
            <div className="flex items-center gap-4">
              <Package size={26} className="text-amber-300" />
              <div>
                <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Purchases</p>
                <h1 className="text-white text-2xl font-bold tracking-tight">Direct Purchase</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300 pointer-events-none" />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search supplier or PO#..."
                  className="pl-8 pr-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-violet-300 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
              <DateRangePicker fromDate={from} toDate={to} onChange={handleDateChange} />
              <button
                onClick={() => navigate('/purchases/direct/new')}
                className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 transition-all px-4 py-2 rounded-xl text-sm font-bold shadow-md active:scale-95"
              >
                <Plus size={16} /> Add Direct Purchase
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── PO Detail Modal ── */}
      {selectedPO && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) setSelectedPO(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Package size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Purchase Order</p>
                  <p className="font-mono text-sm font-bold text-indigo-700">{selectedPO.poNumber}</p>
                </div>
                <span className={`ml-2 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  selectedPO.status === 'RECEIVED'  ? 'bg-emerald-100 text-emerald-700' :
                  selectedPO.status === 'PARTIAL'   ? 'bg-amber-100 text-amber-700' :
                  selectedPO.status === 'SENT'      ? 'bg-blue-100 text-blue-700' :
                  selectedPO.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{selectedPO.status}</span>
              </div>
              <button onClick={() => setSelectedPO(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-700 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Supplier</p>
                  <p className="text-sm font-bold text-gray-800">{selectedPO.supplier?.name ?? '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Date</p>
                  <p className="text-sm font-bold text-gray-800">{selectedPO.receivedDate ? fmtDate(selectedPO.receivedDate) : fmtDate(selectedPO.createdAt)}</p>
                </div>
              </div>

              {/* Payment status */}
              {(() => {
                const bill = selectedPO.sourceBills?.[0]
                const badge = paymentBadge(selectedPO)
                return (
                  <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Payment</p>
                      <span className={`text-sm font-semibold ${badge.color}`}>{badge.label}</span>
                    </div>
                    {bill && (
                      <div className="text-right">
                        {parseFloat(bill.paidAmount) > 0 && (
                          <p className="text-xs text-gray-500">Paid: <span className="font-semibold text-gray-800">{fmtCur(bill.paidAmount)}</span></p>
                        )}
                        {bill.status !== 'PAID' && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Balance: <span className="font-semibold text-red-600">{fmtCur(parseFloat(bill.totalAmount) - parseFloat(bill.paidAmount))}</span>
                          </p>
                        )}
                        {bill.billNumber && (
                          <p className="text-[10px] text-gray-400 mt-1 font-mono">Bill #{bill.billNumber}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Items</p>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100">
                        <th className="px-4 py-2.5 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Product</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Qty</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Unit Cost</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Tax %</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(selectedPO.items ?? []).map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-800">{item.product?.name ?? `Product #${item.productId}`}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{fmtNum(item.receivedQuantity || item.orderedQuantity)} {item.product?.unitOfMeasure ?? ''}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{fmtCur(item.unitCost)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{parseFloat(item.taxRate) > 0 ? `${item.taxRate}%` : '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtCur(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>{fmtCur(selectedPO.subtotal)}</span>
                </div>
                {parseFloat(selectedPO.taxAmount) > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Tax</span><span>{fmtCur(selectedPO.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                  <span>Total</span><span>{fmtCur(selectedPO.totalAmount)}</span>
                </div>
              </div>

              {selectedPO.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{selectedPO.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="p-6">

        {/* ── Purchase History ── */}
        <div className="bg-white rounded-2xl border border-violet-100 shadow-[0_4px_24px_rgba(109,40,217,0.10)] overflow-hidden">
          <div className="w-full px-5 py-4 flex items-center border-b border-gray-100">
            <div className="flex items-center gap-2">
              <History size={16} className="text-indigo-500" />
              <span className="font-bold text-gray-900">Purchase History</span>
              {histData?.totalElements != null && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {histData.totalElements} records
                </span>
              )}
            </div>
          </div>

          <>
            <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">PO #</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Supplier</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Items</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Total</th>
                      <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Payment</th>
                      <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                          No purchase history yet
                        </td>
                      </tr>
                    ) : history.map((po: any) => (
                      <tr key={po.id} onClick={() => setSelectedPO(po)} className="border-b border-gray-50 hover:bg-violet-50/50 cursor-pointer transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-gray-900">{po.poNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{po.receivedDate ? fmtDate(po.receivedDate) : fmtDate(po.createdAt)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{po.supplier?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{po.items?.length ?? 0}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtCur(po.totalAmount)}</td>
                        <td className="px-4 py-3 text-center">
                          {(() => { const b = paymentBadge(po); return <span className={`text-xs font-semibold ${b.color}`}>{b.label}</span> })()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            po.status === 'RECEIVED'  ? 'bg-emerald-100 text-emerald-700' :
                            po.status === 'PARTIAL'   ? 'bg-amber-100 text-amber-700' :
                            po.status === 'SENT'      ? 'bg-blue-100 text-blue-700' :
                            po.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{po.status}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/purchases/direct/edit/${po.poNumber}`) }}
                            className="p-1.5 rounded-lg hover:bg-violet-100 text-gray-400 hover:text-violet-600 transition-colors"
                            title="Edit purchase"
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalHistPages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                  <button disabled={histPage === 0} onClick={() => setHistPage(p => p - 1)}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span className="text-xs text-gray-400">Page {histPage + 1} of {totalHistPages}</span>
                  <button disabled={histPage >= totalHistPages - 1} onClick={() => setHistPage(p => p + 1)}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed">
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
          </>
        </div>

      </div>
    </div>
  )
}
