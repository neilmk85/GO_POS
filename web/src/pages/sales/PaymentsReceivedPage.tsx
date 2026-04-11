import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, CreditCard, DollarSign, Smartphone, Wallet, IndianRupee, Banknote, TrendingUp } from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { orderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const METHOD_ICONS: Record<string, React.ReactNode> = {
  CASH:        <DollarSign  size={18} />,
  CARD:        <CreditCard  size={18} />,
  UPI:         <Smartphone  size={18} />,
  WALLET:      <Wallet      size={18} />,
  NET_BANKING: <Banknote    size={18} />,
  CREDIT_NOTE: <IndianRupee size={18} />,
}

const METHOD_COLORS: Record<string, string> = {
  CASH:        'bg-green-100  text-green-700',
  CARD:        'bg-blue-100   text-blue-700',
  UPI:         'bg-purple-100 text-purple-700',
  WALLET:      'bg-orange-100 text-orange-700',
  NET_BANKING: 'bg-indigo-100 text-indigo-700',
  CREDIT_NOTE: 'bg-yellow-100 text-yellow-700',
}

const METHOD_GRADIENTS: Record<string, string> = {
  CASH:        'from-green-500 to-emerald-600',
  CARD:        'from-blue-500 to-indigo-600',
  UPI:         'from-purple-500 to-violet-600',
  WALLET:      'from-orange-400 to-amber-500',
  NET_BANKING: 'from-indigo-500 to-blue-600',
  CREDIT_NOTE: 'from-yellow-400 to-orange-500',
}

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4']
const RADIAN = Math.PI / 180

const today = new Date()
const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

const DATE_PRESETS = [
  { label: 'Today',        from: fmt(today),                                                        to: fmt(today) },
  { label: 'Yesterday',    from: fmt(subDays(today, 1)),                                            to: fmt(subDays(today, 1)) },
  { label: 'This Week',    from: fmt(startOfWeek(today, { weekStartsOn: 1 })),                     to: fmt(endOfWeek(today, { weekStartsOn: 1 })) },
  { label: 'Last Week',    from: fmt(startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })),        to: fmt(endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })) },
  { label: 'This Month',   from: fmt(startOfMonth(today)),                                          to: fmt(endOfMonth(today)) },
  { label: 'Last Month',   from: fmt(startOfMonth(subMonths(today, 1))),                           to: fmt(endOfMonth(subMonths(today, 1))) },
  { label: 'Last 30 Days', from: fmt(subDays(today, 29)),                                          to: fmt(today) },
  { label: 'Last 90 Days', from: fmt(subDays(today, 89)),                                          to: fmt(today) },
  { label: 'This Quarter', from: fmt(startOfQuarter(today)),                                        to: fmt(endOfQuarter(today)) },
  { label: 'Last Quarter', from: fmt(startOfQuarter(subQuarters(today, 1))),                       to: fmt(endOfQuarter(subQuarters(today, 1))) },
]

function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null
  const r = innerRadius + (outerRadius - innerRadius) * 1.4
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>{`${(percent * 100).toFixed(0)}%`}</text>
}

export default function PaymentsReceivedPage() {
  const { outletId } = useAuthStore()
  const [tab, setTab]                   = useState<'summary' | 'transactions'>('summary')
  const [search, setSearch]             = useState('')
  const [from, setFrom]                 = useState(fmt(subDays(today, 29)))
  const [to,   setTo]                   = useState(fmt(today))
  const [activePreset, setActivePreset] = useState('Last 30 Days')

  function applyPreset(preset: typeof DATE_PRESETS[0]) {
    setFrom(preset.from)
    setTo(preset.to)
    setActivePreset(preset.label)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['orders-payments', outletId, from, to],
    queryFn: () => orderApi.getByOutlet(outletId!, { page: 0, size: 500, from, to }).then(r => r.data.data),
    enabled: !!outletId,
  })

  const orders = data?.content ?? []

  const rows = orders.flatMap((o: any) =>
    (o.payments ?? []).map((p: any) => ({
      ...p,
      amount:      parseFloat(String(p.amount ?? 0)),
      orderNumber: o.orderNumber,
      orderId:     o.id,
      customer:    o.customer,
      orderDate:   o.createdAt,
    }))
  )

  const filtered = rows.filter((r: any) =>
    !search ||
    r.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.paymentMethod?.toLowerCase().includes(search.toLowerCase())
  )

  const total = filtered.reduce((s: number, r: any) => s + r.amount, 0)

  const byMethod: Record<string, number> = {}
  filtered.forEach((r: any) => {
    byMethod[r.paymentMethod] = (byMethod[r.paymentMethod] ?? 0) + r.amount
  })

  const pieData   = Object.entries(byMethod).map(([name, value]) => ({ name, value }))
  const chartData = Object.entries(byMethod).map(([method, amount]) => ({ method: method.replace('_', ' '), amount }))

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Payments Received</h1>
            <p className="text-sm text-gray-500 mt-0.5">All payments collected from customers</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="date" value={from}
              onChange={e => { setFrom(e.target.value); setActivePreset('') }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={to}
              onChange={e => { setTo(e.target.value); setActivePreset('') }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
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

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
          {(['summary', 'transactions'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t
                  ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Summary Tab ── */}
        {tab === 'summary' && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <IndianRupee size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Total Received</p>
                  <p className="text-xl font-bold text-gray-900">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-[11px] text-gray-400">{filtered.length} transactions</p>
                </div>
              </div>
              {Object.entries(byMethod).map(([method, amt]) => (
                <div key={method} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${METHOD_GRADIENTS[method] ?? 'from-gray-400 to-gray-500'} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                    {METHOD_ICONS[method] ?? <CreditCard size={18} />}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">{method.replace('_', ' ')}</p>
                    <p className="text-xl font-bold text-gray-900">₹{(amt as number).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Pie chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Payment Mix</h3>
                <p className="text-xs text-gray-400 mb-3">Share by method</p>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={90} labelLine={false} label={renderPieLabel}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }} className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                  {pieData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-gray-600">{entry.name.replace('_', ' ')}</span>
                      <span className="text-xs font-semibold text-gray-800">
                        {total > 0 ? `${((entry.value / total) * 100).toFixed(0)}%` : '0%'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Amount by Method</h3>
                <p className="text-xs text-gray-400 mb-3">Revenue breakdown</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <defs>
                      <linearGradient id="payBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="method" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Amount']} />
                    <Bar dataKey="amount" fill="url(#payBarGrad)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* ── Transactions Tab ── */}
        {tab === 'transactions' && (
          <>
            <div className="relative mb-4 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search order, customer, method…"
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none bg-white" />
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Order #</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Method</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Reference</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16">
                        <TrendingUp size={36} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-sm text-gray-400">No payments found</p>
                      </td>
                    </tr>
                  ) : filtered.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-violet-600">{r.orderNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.customer?.name ?? 'Walk-in'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${METHOD_COLORS[r.paymentMethod] ?? 'bg-gray-100 text-gray-700'}`}>
                          {r.paymentMethod?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">
                        ₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{r.referenceNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(r.orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
