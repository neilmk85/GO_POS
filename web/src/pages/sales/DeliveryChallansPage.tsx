import { useState } from 'react'
import { Search, Truck, Package, FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { loadingRecordApi } from '@/services/api'
import { format, subDays } from 'date-fns'

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }

function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

export default function DeliveryChallansPage() {
  const today = new Date()
  const [from, setFrom] = useState(fmtDate(subDays(today, 30)))
  const [to,   setTo]   = useState(fmtDate(today))
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['loading-records', from, to],
    queryFn: () => loadingRecordApi.getAll({ from: from || undefined, to: to || undefined })
      .then(r => r.data.data ?? []),
  })

  const records: any[] = data ?? []

  const filtered = records.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (r.customerPoNo  ?? '').toLowerCase().includes(q) ||
      (r.pipeName      ?? '').toLowerCase().includes(q) ||
      (r.customerName  ?? '').toLowerCase().includes(q) ||
      (r.vehicleNo     ?? '').toLowerCase().includes(q) ||
      (r.driverName    ?? '').toLowerCase().includes(q) ||
      (r.siteAddress   ?? '').toLowerCase().includes(q)
    )
  })

  const totalPipes    = records.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const uniqueCustomers = new Set(records.map(r => r.customerName).filter(Boolean)).size

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
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <Truck size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Sales</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Delivery Challans</h1>
            </div>
          </div>
          {/* Date range */}
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 [color-scheme:dark]" />
            <span className="text-violet-300 text-sm">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 [color-scheme:dark]" />
          </div>
        </div>
        {/* Stats strip */}
        <div className="relative border-t border-white/10 grid grid-cols-3 divide-x divide-white/10">
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{records.length}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Dispatches</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{totalPipes}</p>
            <p className="text-violet-200 text-xs mt-0.5">Pipes Loaded</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{uniqueCustomers}</p>
            <p className="text-violet-200 text-xs mt-0.5">Unique Customers</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by CH.NO, pipe, customer, vehicle or driver…"
          className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-violet-300 focus:outline-none" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">CH.NO</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Pipe</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Qty</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Site Address</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Vehicle</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Driver</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <Truck size={40} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">No delivery challans found</p>
                </td>
              </tr>
            ) : filtered.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm text-violet-600">
                  {r.customerPoNo ? (
                    <span className="flex items-center gap-1">
                      <FileText size={12} className="text-violet-400" />
                      {r.customerPoNo}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-800 font-medium">{r.pipeName ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center">{r.quantity ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <p>{r.customerName || '—'}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{r.siteAddress || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 font-mono">{r.vehicleNo || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <p>{r.driverName || '—'}</p>
                  {r.driverContact && <p className="text-xs text-gray-400">{r.driverContact}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.date ? dmy(r.date) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
