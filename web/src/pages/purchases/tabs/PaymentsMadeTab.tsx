import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, CreditCard, Plus, Loader2 } from 'lucide-react'
import { vendorPaymentApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const METHOD_COLORS: Record<string, string> = {
  BANK_TRANSFER: 'bg-blue-100 text-blue-700',
  CHEQUE:        'bg-purple-100 text-purple-700',
  CASH:          'bg-green-100 text-green-700',
  UPI:           'bg-orange-100 text-orange-700',
  OTHER:         'bg-gray-100 text-gray-600',
}

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  UPI: 'UPI',
  OTHER: 'Other',
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PaymentsMadeTab() {
  const { outletId } = useAuthStore()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-payments', outletId],
    queryFn: () => vendorPaymentApi.getAll({ outletId: outletId ?? undefined, size: 200 })
      .then(r => r.data.data?.content ?? r.data.data ?? []),
    enabled: true,
  })

  const payments: any[] = Array.isArray(data) ? data : (data as any)?.content ?? []

  const filtered = payments.filter(p =>
    (p.supplier?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.referenceNumber ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div />
        <button className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Record Payment
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search payments..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'No payments match your search' : 'No payments recorded yet'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Reference</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Vendor</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Method</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-violet-700">
                    {p.referenceNumber || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{p.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${METHOD_COLORS[p.paymentMethod] ?? 'bg-gray-100 text-gray-600'}`}>
                      {METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">₹{fmt(parseFloat(p.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
