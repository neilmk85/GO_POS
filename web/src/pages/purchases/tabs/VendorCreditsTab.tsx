import { useState } from 'react'
import { Search, FileX, Plus } from 'lucide-react'

const MOCK_CREDITS = [
  { id: 1, ref: 'VC-001', vendor: 'ABC Suppliers', date: '2026-03-08', reason: 'Damaged goods returned', amount: 3500, used: 3500, status: 'USED' },
  { id: 2, ref: 'VC-002', vendor: 'XYZ Traders',   date: '2026-03-14', reason: 'Price adjustment',        amount: 1200, used: 0,    status: 'OPEN' },
]

const STATUS_COLORS: Record<string, string> = {
  OPEN:   'bg-blue-100 text-blue-700',
  USED:   'bg-gray-100 text-gray-500',
  PARTIAL:'bg-yellow-100 text-yellow-700',
}

export default function VendorCreditsTab() {
  const [search, setSearch] = useState('')
  const filtered = MOCK_CREDITS.filter(c =>
    c.ref.toLowerCase().includes(search.toLowerCase()) ||
    c.vendor.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Vendor Credits</h2>
          <p className="text-sm text-gray-500 mt-0.5">Credits received from vendors for returns or adjustments</p>
        </div>
        <button className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> New Credit
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vendor credits..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileX size={40} className="mx-auto mb-3 opacity-30" />
          <p>No vendor credits yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-3 font-semibold">Reference</th>
                <th className="pb-3 font-semibold">Vendor</th>
                <th className="pb-3 font-semibold">Date</th>
                <th className="pb-3 font-semibold">Reason</th>
                <th className="pb-3 font-semibold text-right">Credit Amount</th>
                <th className="pb-3 font-semibold text-right">Balance</th>
                <th className="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="py-3 font-mono font-medium text-primary-700">{c.ref}</td>
                  <td className="py-3 text-gray-800">{c.vendor}</td>
                  <td className="py-3 text-gray-500">{c.date}</td>
                  <td className="py-3 text-gray-600 text-xs max-w-[200px] truncate">{c.reason}</td>
                  <td className="py-3 text-right font-semibold">₹{c.amount.toLocaleString()}</td>
                  <td className="py-3 text-right font-semibold text-blue-700">₹{(c.amount - c.used).toLocaleString()}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
