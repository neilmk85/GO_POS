import { useState } from 'react'
import { Search, Receipt, Plus, Loader2, CreditCard, Eye, Trash2, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { purchaseBillApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '₹0.00'
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:   'bg-gray-100 text-gray-600',
  UNPAID:  'bg-red-100 text-red-600',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  PAID:    'bg-green-100 text-green-700',
}

export default function BillsTab() {
  const { user } = useAuthStore()
  const outletId = user?.outletId ?? 1
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [viewBill, setViewBill] = useState<any>(null)
  const [payBill, setPayBill] = useState<any>(null)
  const [payAmount, setPayAmount] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-bills', outletId],
    queryFn: async () => {
      const res = await purchaseBillApi.getByOutlet(outletId, { size: 200 })
      return res.data.data
    },
  })

  const { data: summary } = useQuery({
    queryKey: ['purchase-bills-summary', outletId],
    queryFn: async () => {
      const res = await purchaseBillApi.getSummary(outletId)
      return res.data.data
    },
  })

  const payMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      purchaseBillApi.recordPayment(id, amount),
    onSuccess: () => {
      toast.success('Payment recorded')
      qc.invalidateQueries({ queryKey: ['purchase-bills', outletId] })
      qc.invalidateQueries({ queryKey: ['purchase-bills-summary', outletId] })
      setPayBill(null)
      setPayAmount('')
    },
    onError: () => toast.error('Failed to record payment'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => purchaseBillApi.delete(id),
    onSuccess: () => {
      toast.success('Bill deleted')
      qc.invalidateQueries({ queryKey: ['purchase-bills', outletId] })
      qc.invalidateQueries({ queryKey: ['purchase-bills-summary', outletId] })
    },
    onError: () => toast.error('Failed to delete bill'),
  })

  const bills: any[] = data?.content ?? []
  const filtered = bills.filter(b =>
    b.billNumber?.toLowerCase().includes(search.toLowerCase()) ||
    b.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.vendorBillNumber?.toLowerCase().includes(search.toLowerCase())
  )

  function handlePay() {
    const amt = parseFloat(payAmount)
    if (!payBill || isNaN(amt) || amt <= 0) return
    const balance = parseFloat(payBill.balanceDue ?? payBill.totalAmount) - parseFloat(payBill.paidAmount ?? 0)
    if (amt > balance + 0.01) {
      toast.error('Amount exceeds balance due')
      return
    }
    payMutation.mutate({ id: payBill.id, amount: amt })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Bills</h2>
          <p className="text-sm text-gray-500 mt-0.5">Vendor invoices and bills payable</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Total Outstanding</p>
          <p className="text-xl font-bold text-red-600">{fmtCur(summary?.totalOutstanding ?? 0)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Unpaid Bills</p>
          <p className="text-xl font-bold text-orange-600">{summary?.unpaidCount ?? 0}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Total Paid</p>
          <p className="text-xl font-bold text-green-600">{fmtCur(summary?.totalPaid ?? 0)}</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search bills..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-primary-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Receipt size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No bills yet — convert a Purchase Order to create a bill</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-3 font-semibold">Bill #</th>
                <th className="pb-3 font-semibold">Vendor Bill #</th>
                <th className="pb-3 font-semibold">Vendor</th>
                <th className="pb-3 font-semibold">Date</th>
                <th className="pb-3 font-semibold">Due Date</th>
                <th className="pb-3 font-semibold text-right">Amount</th>
                <th className="pb-3 font-semibold text-right">Balance Due</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(b => {
                const balance = parseFloat(b.totalAmount ?? 0) - parseFloat(b.paidAmount ?? 0)
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="py-3 font-mono font-medium text-primary-700">{b.billNumber}</td>
                    <td className="py-3 text-gray-500">{b.vendorBillNumber || '—'}</td>
                    <td className="py-3 text-gray-800">{b.supplier?.name}</td>
                    <td className="py-3 text-gray-500">{b.billDate}</td>
                    <td className="py-3 text-gray-500">{b.dueDate || '—'}</td>
                    <td className="py-3 text-right font-semibold">{fmtCur(b.totalAmount)}</td>
                    <td className="py-3 text-right font-semibold text-red-600">{fmtCur(balance)}</td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setViewBill(b)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50" title="View">
                          <Eye size={14} />
                        </button>
                        {b.status !== 'PAID' && (
                          <button onClick={() => { setPayBill(b); setPayAmount(String(balance.toFixed(2))) }}
                            className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50" title="Record Payment">
                            <CreditCard size={14} />
                          </button>
                        )}
                        <button onClick={() => {
                          if (confirm(`Delete bill ${b.billNumber}?`)) deleteMutation.mutate(b.id)
                        }} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* View Bill Modal */}
      {viewBill && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">{viewBill.billNumber}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{viewBill.supplier?.name}</p>
              </div>
              <button onClick={() => setViewBill(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Bill Date', viewBill.billDate],
                  ['Due Date', viewBill.dueDate || '—'],
                  ['Vendor Bill #', viewBill.vendorBillNumber || '—'],
                  ['Status', viewBill.status],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-medium text-gray-800">{val}</p>
                  </div>
                ))}
              </div>

              {viewBill.items?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b">
                        <th className="pb-2 text-left font-medium">Product</th>
                        <th className="pb-2 text-right font-medium">Qty</th>
                        <th className="pb-2 text-right font-medium">Unit Cost</th>
                        <th className="pb-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {viewBill.items.map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="py-2">{item.product?.name}</td>
                          <td className="py-2 text-right">{item.quantity}</td>
                          <td className="py-2 text-right">{fmtCur(item.unitCost)}</td>
                          <td className="py-2 text-right font-medium">{fmtCur(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{fmtCur(viewBill.subtotal)}</span>
                </div>
                {parseFloat(viewBill.cgstAmount ?? 0) > 0 || parseFloat(viewBill.sgstAmount ?? 0) > 0 || parseFloat(viewBill.igstAmount ?? 0) > 0 ? (
                  <>
                    {parseFloat(viewBill.cgstAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-blue-600">
                        <span>CGST</span>
                        <span>{fmtCur(viewBill.cgstAmount)}</span>
                      </div>
                    )}
                    {parseFloat(viewBill.sgstAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>SGST</span>
                        <span>{fmtCur(viewBill.sgstAmount)}</span>
                      </div>
                    )}
                    {parseFloat(viewBill.igstAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-purple-600">
                        <span>IGST</span>
                        <span>{fmtCur(viewBill.igstAmount)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax</span>
                    <span>{fmtCur(viewBill.taxAmount)}</span>
                  </div>
                )}
                {viewBill.supplyType && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Supply Type</span>
                    <span>{viewBill.supplyType === 'INTRA_STATE' ? 'Intra-State' : 'Inter-State'}</span>
                  </div>
                )}
                {viewBill.vendorGstin && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Vendor GSTIN</span>
                    <span className="font-mono">{viewBill.vendorGstin}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base border-t pt-1">
                  <span>Total</span>
                  <span>{fmtCur(viewBill.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Paid</span>
                  <span>{fmtCur(viewBill.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-red-600">
                  <span>Balance Due</span>
                  <span>{fmtCur(parseFloat(viewBill.totalAmount) - parseFloat(viewBill.paidAmount))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payBill && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-semibold text-gray-900">Record Payment</h3>
              <button onClick={() => setPayBill(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Bill: <span className="font-medium">{payBill.billNumber}</span><br />
                Balance Due: <span className="font-semibold text-red-600">
                  {fmtCur(parseFloat(payBill.totalAmount) - parseFloat(payBill.paidAmount))}
                </span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPayBill(null)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handlePay} disabled={payMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {payMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
