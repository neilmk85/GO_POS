import { useState } from 'react'
import { Search, CreditCard, Plus } from 'lucide-react'

const MOCK_PAYMENTS = [
  { id: 1, ref: 'PMT-001', vendor: 'ABC Suppliers', date: '2026-03-05', method: 'Bank Transfer', amount: 15000, bills: 'BILL-001' },
  { id: 2, ref: 'PMT-002', vendor: 'Global Goods',  date: '2026-03-18', method: 'Cheque',        amount: 5000,  bills: 'BILL-003' },
]

const METHOD_COLORS: Record<string, string> = {
  'Bank Transfer': 'bg-blue-100 text-blue-700',
  'Cheque':        'bg-purple-100 text-purple-700',
  'Cash':          'bg-green-100 text-green-700',
  'UPI':           'bg-orange-100 text-orange-700',
}

export default function PaymentsMadeTab() {
  const [search, setSearch] = useState('')
  const filtered = MOCK_PAYMENTS.filter(p =>
    p.ref.toLowerCase().includes(search.toLowerCase()) ||
    p.vendor.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Payments Made</h2>
          <p className="text-sm text-gray-500 mt-0.5">Payments sent to vendors against bills</p>
        </div>
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

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p>No payments recorded yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-3 font-semibold">Reference</th>
                <th className="pb-3 font-semibold">Vendor</th>
                <th className="pb-3 font-semibold">Date</th>
                <th className="pb-3 font-semibold">Method</th>
                <th className="pb-3 font-semibold">Applied to</th>
                <th className="pb-3 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-3 font-mono font-medium text-primary-700">{p.ref}</td>
                  <td className="py-3 text-gray-800">{p.vendor}</td>
                  <td className="py-3 text-gray-500">{p.date}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${METHOD_COLORS[p.method] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.method}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500 font-mono text-xs">{p.bills}</td>
                  <td className="py-3 text-right font-semibold text-green-700">₹{p.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
