import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, PackageCheck, Loader2, X, Truck, Calendar, FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { purchaseOrderApi, outletApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  return isNaN(v) ? '₹0.00' : '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
function ReceivedPODrawer({ po, onClose }: { po: any; onClose: () => void }) {
  const { data: fullPo, isLoading } = useQuery({
    queryKey: ['po-detail', po.poNumber],
    queryFn: () => purchaseOrderApi.getByPoNumber(po.poNumber).then((r: any) => r.data.data),
  })

  const items: any[] = fullPo?.items ?? []

  return createPortal(
    <div className="fixed top-0 bottom-0 right-0 z-[9000] flex" style={{ left: 220 }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-white h-full flex flex-col shadow-2xl animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold font-mono text-gray-900">{po.poNumber}</h2>
              <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-green-100 text-green-700">
                RECEIVED
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Received Purchase Details</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-green-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Meta */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Truck size={10} /> Supplier
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{fullPo?.supplier?.name ?? po.supplier?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={10} /> Received Date
                </p>
                <p className="text-sm text-gray-700 mt-1">{fullPo?.receivedDate ?? po.receivedDate ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={10} /> Expected Date
                </p>
                <p className="text-sm text-gray-700 mt-1">{fullPo?.expectedDate ?? po.expectedDate ?? '—'}</p>
              </div>
            </div>

            {fullPo?.notes && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                  <FileText size={10} /> Notes
                </p>
                <p className="text-sm text-amber-900 mt-1">{fullPo.notes}</p>
              </div>
            )}

            {/* Items */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Items Received ({items.length})</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Product</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Ordered</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Received</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Unit Cost</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Tax %</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No items on this PO</td></tr>
                  ) : items.map((item: any, i: number) => (
                    <tr key={item.id ?? i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800">{item.product?.name ?? '—'}</p>
                        <p className="text-[10px] text-gray-400">{item.product?.sku} · {item.product?.unitOfMeasure}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">{parseFloat(item.orderedQuantity)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-green-700">{parseFloat(item.receivedQuantity ?? item.orderedQuantity)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{fmtCur(item.unitCost)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">{parseFloat(item.taxRate)}%</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtCur(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal (excl. tax)</span>
                <span className="font-semibold">{fmtCur(fullPo?.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-semibold">{fmtCur(fullPo?.taxAmount ?? 0)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-900">Grand Total</span>
                <span className="text-green-700">{fmtCur(fullPo?.totalAmount ?? po.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main Tab ──────────────────────────────────────────────────────────────────
export default function PurchaseReceivesTab() {
  const { outletId } = useAuthStore()
  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(outletId)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [viewPo, setViewPo] = useState<any | null>(null)

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletApi.getAll().then((r: any) => r.data.data ?? []),
  })
  useEffect(() => {
    if (selectedOutletId || (outlets as any[]).length === 0) return
    const main = (outlets as any[]).find((o: any) => o.name.toLowerCase().includes('main store')) ?? (outlets as any[])[0]
    if (main) setSelectedOutletId((main as any).id)
  }, [outlets])

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['purchase-received', selectedOutletId, page],
    queryFn: () => purchaseOrderApi.getByOutlet(selectedOutletId!, { page, size: 20 }).then((r: any) => r.data.data),
    enabled: !!selectedOutletId,
  })

  const allOrders: any[] = ordersData?.content ?? []
  const totalPages: number = ordersData?.totalPages ?? 1

  // Filter to RECEIVED only, then apply search
  const received = allOrders.filter((o: any) => o.status === 'RECEIVED')
  const filtered = received.filter((o: any) =>
    o.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
    o.supplier?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div />
        <div>
          {(outlets as any[]).length > 1 && (
            <select value={selectedOutletId ?? ''}
              onChange={e => { setSelectedOutletId(e.target.value ? Number(e.target.value) : null); setPage(0) }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {(outlets as any[]).map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by PO number or vendor…"
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {!selectedOutletId ? (
        <div className="text-center py-16 text-gray-400">
          <PackageCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>Select an outlet to view received purchases.</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <PackageCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'No received purchases match your search' : 'No received purchases yet.'}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">PO Number</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Vendor</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Received Date</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Expected Date</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Total Amount</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r: any) => (
                  <tr key={r.id}
                    onClick={() => setViewPo(r)}
                    className="hover:bg-green-50/50 cursor-pointer transition-colors">
                    <td className="py-3 font-mono font-medium text-primary-700">{r.poNumber}</td>
                    <td className="py-3 text-gray-800">{r.supplier?.name ?? '—'}</td>
                    <td className="py-3 text-gray-600 font-medium">{r.receivedDate ?? '—'}</td>
                    <td className="py-3 text-gray-500">{r.expectedDate ?? '—'}</td>
                    <td className="py-3 text-right font-semibold">{fmtCur(r.totalAmount)}</td>
                    <td className="py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
                        RECEIVED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                ← Prev
              </button>
              <span className="text-gray-500">Page {page + 1} of {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {viewPo && <ReceivedPODrawer po={viewPo} onClose={() => setViewPo(null)} />}
    </div>
  )
}
