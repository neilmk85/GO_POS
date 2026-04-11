import { useState, useEffect } from 'react'
import { format, subDays, startOfMonth } from 'date-fns'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Legend,
  ReferenceLine,
} from 'recharts'
import {
  IndianRupee, ShoppingCart, TrendingUp, TrendingDown, RotateCcw,
  Loader2, RefreshCw, Banknote, Smartphone, BadgePercent, Search,
  ChevronLeft, ChevronRight, Download, Users, Tag, Package,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { reportApi, orderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import OrderDetailModal from './OrderDetailModal'

const COLORS     = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']
const PIE_COLORS = ['#0d9488','#3b82f6','#f59e0b','#ef4444','#14b8a6','#60a5fa','#fbbf24','#f87171','#2dd4bf','#93c5fd']

const PRESETS = [
  { label: 'Today',      from: () => format(new Date(), 'yyyy-MM-dd'),             to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 7d',   from: () => format(subDays(new Date(), 6), 'yyyy-MM-dd'),  to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 30d',  from: () => format(subDays(new Date(), 29), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Month',from: () => format(startOfMonth(new Date()), 'yyyy-MM-dd'),to: () => format(new Date(), 'yyyy-MM-dd') },
]

const STATUS_COLORS: Record<string, string> = {
  COMPLETED:          'bg-green-50 text-green-700',
  PENDING:            'bg-yellow-50 text-yellow-700',
  CANCELLED:          'bg-red-50 text-red-600',
  REFUNDED:           'bg-orange-50 text-orange-600',
  PARTIALLY_REFUNDED: 'bg-orange-50 text-orange-500',
  HELD:               'bg-gray-100 text-gray-500',
  CONFIRMED:          'bg-blue-50 text-blue-600',
}

type Tab = 'summary' | 'transactions' | 'by-category' | 'by-product' | 'by-customer' | 'returns' | 'outstanding'
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary',      label: 'Summary' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'by-category',  label: 'By Category' },
  { key: 'by-product',   label: 'By Product' },
  { key: 'by-customer',  label: 'By Customer' },
  { key: 'returns',      label: 'Returns' },
  { key: 'outstanding',  label: 'Outstanding' },
]

export default function SalesReportPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1
  const [tab, setTab]   = useState<Tab>('summary')
  const [from, setFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [to, setTo]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading]     = useState(false)
  const [exporting, setExporting] = useState(false)

  const [summary, setSummary]           = useState<any>(null)
  const [dailyTrend, setDailyTrend]     = useState<any[]>([])
  const [topProducts, setTopProducts]   = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])

  const [orders, setOrders]             = useState<any[]>([])
  const [txPage, setTxPage]             = useState(0)
  const [txTotalPages, setTxTotalPages] = useState(0)
  const [txTotal, setTxTotal]           = useState(0)
  const [txSearch, setTxSearch]         = useState('')
  const [txLoading, setTxLoading]       = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const PAGE_SIZE = 10

  const [catData, setCatData]           = useState<any[]>([])
  const [prodData, setProdData]         = useState<any[]>([])
  const [prodSearch, setProdSearch]     = useState('')
  const [custData, setCustData]         = useState<any[]>([])
  const [custSearch, setCustSearch]     = useState('')
  const [returnData, setReturnData]     = useState<any[]>([])
  const [returnSearch, setReturnSearch] = useState('')
  const [outData, setOutData]           = useState<any[]>([])
  const [outSearch, setOutSearch]       = useState('')

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const fmtDate = (iso: string) => { const [y, m, d] = (iso ?? '').substring(0, 10).split('-'); return d && m && y ? `${d}/${m}/${y}` : iso }

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const [s, t, p, pm] = await Promise.all([
        reportApi.getSalesSummary(oid, from, to),
        reportApi.getDailyTrend(oid, from, to),
        reportApi.getTopProducts(oid, from, to, 10),
        reportApi.getPaymentMethods(oid, from, to),
      ])
      setSummary(s.data.data)
      setDailyTrend((t.data.data ?? []).map((d: any) => ({ ...d, date: fmtDate(d.date) })))
      setTopProducts(p.data.data ?? [])
      setPaymentMethods((pm.data.data ?? []).map((m: any) => ({ ...m, amount: parseFloat(String(m.amount ?? 0)) })))
    } catch { toast.error('Failed to load summary') }
    finally { setLoading(false) }
  }

  const fetchOrders = async (page = 0) => {
    setTxLoading(true)
    try {
      const res = await orderApi.getByOutlet(oid, { from, to, page, size: PAGE_SIZE, sort: 'createdAt,desc' })
      const d = res.data.data
      setOrders(d?.content ?? [])
      setTxTotalPages(d?.totalPages ?? 0)
      setTxTotal(d?.totalElements ?? 0)
    } catch { /* ignore */ }
    finally { setTxLoading(false) }
  }

  const fetchCategory = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getSalesByCategory(oid, from, to)
      setCatData(res.data.data ?? [])
    } catch { toast.error('Failed to load category report') }
    finally { setLoading(false) }
  }

  const fetchProduct = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getSalesByProduct(oid, from, to)
      setProdData(res.data.data ?? [])
    } catch { toast.error('Failed to load product report') }
    finally { setLoading(false) }
  }

  const fetchCustomer = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getSalesByCustomer(oid, from, to)
      setCustData(res.data.data ?? [])
    } catch { toast.error('Failed to load customer report') }
    finally { setLoading(false) }
  }

  const fetchReturns = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getSaleReturns(oid, from, to)
      setReturnData(res.data.data ?? [])
    } catch { toast.error('Failed to load returns') }
    finally { setLoading(false) }
  }

  const fetchOutstanding = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getOutstandingReceivable(oid)
      setOutData(res.data.data ?? [])
    } catch { toast.error('Failed to load outstanding receivable') }
    finally { setLoading(false) }
  }

  const load = () => {
    if (tab === 'summary')           fetchSummary()
    else if (tab === 'transactions') { fetchSummary(); setTxPage(0); fetchOrders(0) }
    else if (tab === 'by-category')  { fetchSummary(); fetchCategory() }
    else if (tab === 'by-product')   { fetchSummary(); fetchProduct() }
    else if (tab === 'by-customer')  { fetchSummary(); fetchCustomer() }
    else if (tab === 'returns')      { fetchSummary(); fetchReturns() }
    else if (tab === 'outstanding')  { fetchSummary(); fetchOutstanding() }
  }

  useEffect(() => { load() }, [from, to, oid, tab])
  useEffect(() => { if (tab === 'transactions') fetchOrders(txPage) }, [txPage])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await reportApi.exportSalesCsv(oid, from, to)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = `sales_${from}_${to}.csv`; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const cashTotal    = paymentMethods.filter(m => m.method?.toUpperCase() === 'CASH').reduce((s, m) => s + parseFloat(String(m.amount ?? 0)), 0)
  const digitalTotal = paymentMethods.filter(m => m.method?.toUpperCase() !== 'CASH').reduce((s, m) => s + parseFloat(String(m.amount ?? 0)), 0)
  const discountTotal = summary?.totalDiscount ?? 0

  const kpiCards = summary ? [
    { label: 'Total Revenue',    value: fmt(summary.totalRevenue ?? 0),          icon: <IndianRupee size={18} />, gradient: 'from-blue-500 to-indigo-600',    color: '#3b82f6' },
    { label: 'Total Orders',     value: (summary.totalOrders ?? 0).toString(),   icon: <ShoppingCart size={18} />,gradient: 'from-emerald-500 to-teal-600',   color: '#10b981' },
    { label: 'Avg Order Value',  value: fmt(summary.avgOrderValue ?? 0),         icon: <TrendingUp size={18} />,  gradient: 'from-amber-400 to-orange-500',   color: '#f59e0b' },
    { label: 'Total Returns',    value: (summary.returnedOrders ?? 0).toString(),icon: <RotateCcw size={18} />,   gradient: 'from-rose-500 to-red-600',        color: '#f43f5e' },
    { label: 'Gross Profit',     value: fmt(summary.grossProfit ?? 0),           icon: <TrendingUp size={18} />,  gradient: 'from-teal-500 to-emerald-600',   color: '#10b981' },
    { label: 'Cash Collections', value: fmt(cashTotal),                           icon: <Banknote size={18} />,   gradient: 'from-sky-500 to-blue-600',        color: '#0ea5e9' },
    { label: 'Digital Payments', value: fmt(digitalTotal),                        icon: <Smartphone size={18} />, gradient: 'from-violet-500 to-purple-600',  color: '#8b5cf6' },
    { label: 'Discount Given',   value: fmt(discountTotal),                       icon: <BadgePercent size={18} />,gradient: 'from-orange-400 to-amber-500',  color: '#f59e0b' },
  ] : []

  const catTotalRev = catData.reduce((s, r) => s + Number(r.totalRevenue ?? 0), 0)

  return (
    <>
    <div className="p-6">
      <div className="relative bg-white border border-gray-200 rounded-xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3">
        <button onClick={load} disabled={loading || txLoading}
          className="absolute top-2.5 right-3 p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 transition-colors">
          {loading || txLoading
            ? <Loader2 size={14} className="animate-spin text-green-500" />
            : <RefreshCw size={14} className="text-green-500" />}
        </button>
        <h1 className="text-lg font-bold text-gray-900 shrink-0">Sales Report</h1>

        <div className="flex gap-1 bg-gray-100 rounded-full p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                tab === t.key
                  ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => { setFrom(p.from()); setTo(p.to()) }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                from === p.from() && to === p.to()
                  ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white border-transparent'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}>
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 border border-gray-300 rounded-md px-2 py-1">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="text-xs text-gray-700 bg-transparent focus:outline-none" />
            <span className="text-gray-400 text-xs">–</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="text-xs text-gray-700 bg-transparent focus:outline-none" />
          </div>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors">
            <Download size={13} className="text-green-600" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {tab === 'summary' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {loading && !summary ? Array(8).fill(0).map((_, i) => (
              <div key={i} className="rounded-xl p-5 bg-gray-100 animate-pulse">
                <div className="h-8 w-8 bg-gray-200 rounded-lg mb-3" />
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            )) : kpiCards.map((c, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                  {c.icon}
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                  <p className="text-xl font-bold text-gray-900">{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Daily Revenue & Orders</h2>
              {dailyTrend.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-gray-200"><TrendingUp size={40} /></div>
              ) : (() => {
                const maxRev = Math.max(...dailyTrend.map((d: any) => d.revenue ?? 0), 1)
                const bestDay = [...dailyTrend].sort((a: any, b: any) => b.revenue - a.revenue)[0]
                const totalOrders = dailyTrend.reduce((s: number, d: any) => s + (d.orderCount ?? 0), 0)
                return (
                  <div>
                    {/* Summary pills */}
                    <div className="flex gap-3 mb-4 flex-wrap">
                      <div className="flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <span className="text-xs text-indigo-700 font-medium">Best day: <strong>{bestDay?.date}</strong> — ₹{Number(bestDay?.revenue ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-xs text-emerald-700 font-medium">Total orders: <strong>{totalOrders}</strong></span>
                      </div>
                    </div>
                    {/* Bar-per-day — 160px fixed chart area */}
                    <div className="flex items-end gap-1.5 overflow-x-auto" style={{ height: 160 }}>
                      {dailyTrend.map((d: any, i: number) => {
                        const BAR_MAX = 148 // leave 12px headroom
                        const barPx  = maxRev > 0 ? Math.max((d.revenue / maxRev) * BAR_MAX, 4) : 4
                        const isBest = d.revenue === bestDay?.revenue
                        return (
                          <div key={i} className="flex flex-col items-center justify-end gap-1 flex-1 min-w-[32px] h-full group relative">
                            {/* Hover tooltip */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-2.5 py-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                              <p className="font-semibold mb-0.5">{d.date}</p>
                              <p>₹{Number(d.revenue ?? 0).toLocaleString('en-IN')}</p>
                              <p className="text-emerald-400">{d.orderCount ?? 0} orders</p>
                            </div>
                            {/* Bar */}
                            <div
                              className="w-full rounded-t-md transition-all duration-500 group-hover:brightness-90"
                              style={{
                                height: barPx,
                                background: isBest
                                  ? 'linear-gradient(to top, #4f46e5, #818cf8)'
                                  : 'linear-gradient(to top, #a5b4fc, #c7d2fe)',
                              }}
                            />
                            {/* Date label */}
                            <span className="text-[9px] text-gray-400 leading-none truncate w-full text-center">
                              {d.date}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {/* Order counts below */}
                    <div className="flex gap-1.5 mt-1.5">
                      {dailyTrend.map((d: any, i: number) => (
                        <div key={i} className="flex-1 min-w-[32px] text-center text-[9px] text-emerald-600 font-semibold">
                          {d.orderCount > 0 ? d.orderCount : ''}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 text-center">↑ orders count per day</p>
                  </div>
                )
              })()}
            </div>

            <div className="bg-white rounded-xl shadow-lg p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Payment Methods
                {paymentMethods.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    Total: ₹{paymentMethods.reduce((s: number, m: any) => s + (m.amount ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                )}
              </h2>
              {paymentMethods.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-gray-200"><IndianRupee size={40} /></div>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie data={paymentMethods} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={90}
                      labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                      label={({ cx, cy, midAngle, method, percent }: any) => {
                        const RADIAN = Math.PI / 180
                        const radius = 90 + 48
                        const x = cx + radius * Math.cos(-midAngle * RADIAN)
                        const y = cy + radius * Math.sin(-midAngle * RADIAN)
                        return (
                          <text x={x} y={y} fill="#9ca3af" fontSize={11}
                            textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                            {`${method} ${(percent * 100).toFixed(0)}%`}
                          </text>
                        )
                      }}>
                      {paymentMethods.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
                    <Legend content={({ payload }) => {
                      const total = paymentMethods.reduce((s: number, m: any) => s + (m.amount ?? 0), 0)
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px', marginTop: 8, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                          {(payload ?? []).map((entry: any, i: number) => {
                            const pct = total > 0 ? ((entry.payload.amount / total) * 100).toFixed(0) : '0'
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0 }} />
                                <span style={{ color: '#6b7280', fontSize: 12 }}>{entry.value}</span>
                                <span style={{ color: '#374151', fontSize: 12, fontWeight: 600 }}>{pct}%</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Top Selling Products</h2>
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-300 gap-2">
                <TrendingDown size={36} /><p className="text-sm text-gray-400">No sales data for this period</p>
              </div>
            ) : (() => {
              const maxRevenue = Math.max(...topProducts.map((p: any) => parseFloat(String(p.totalRevenue ?? 0))))
              const barColors = ['#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b','#f97316','#ef4444','#8b5cf6','#ec4899','#14b8a6']
              return (
                <div className="space-y-3">
                  {topProducts.map((p: any, i: number) => {
                    const revenue = parseFloat(String(p.totalRevenue ?? 0))
                    const qty     = parseFloat(String(p.totalQuantity ?? p.quantitySold ?? 0))
                    const pct     = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0
                    return (
                      <div key={p.productId ?? i} className="flex items-center gap-3">
                        {/* Rank */}
                        <span className="w-5 text-xs font-bold text-gray-400 shrink-0 text-right">{i + 1}</span>
                        {/* Name + bar */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-800 truncate pr-2">{p.productName}</span>
                            <span className="text-xs text-gray-500 shrink-0">{qty > 0 ? `${qty % 1 === 0 ? qty : qty.toFixed(1)} sold` : ''}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: barColors[i % barColors.length] }}
                            />
                          </div>
                        </div>
                        {/* Revenue */}
                        <span className="text-sm font-semibold text-gray-900 shrink-0 w-24 text-right">
                          ₹{revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </>
      )}

      {tab === 'transactions' && (
        <div className="space-y-5">
        {dailyTrend.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Sales Trend</h2>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-indigo-500 rounded inline-block" /> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-emerald-400 rounded inline-block" /> Orders</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={dailyTrend}>
                <defs>
                  <linearGradient id="txRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="rev" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                  formatter={(v: any, name: string) =>
                    name === 'revenue' ? [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue'] : [v, 'Orders']
                  } />
                <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2}
                  fill="url(#txRevGrad)" dot={false} />
                <Line yAxisId="ord" type="monotone" dataKey="orderCount" stroke="#10b981" strokeWidth={2}
                  dot={false} strokeDasharray="4 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Transactions</h2>
              {txTotal > 0 && <p className="text-xs text-gray-400 mt-0.5">{txTotal} orders in this period</p>}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search order #..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Order #</th>
                  <th className="px-4 py-3 text-left">Date & Time</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {txLoading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(7).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                )) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No transactions found</td></tr>
                ) : orders
                    .filter(o => !txSearch || o.orderNumber?.toLowerCase().includes(txSearch.toLowerCase()))
                    .map((order: any) => {
                      const payMethod = order.payments?.[0]?.paymentMethod ?? '—'
                      return (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-mono font-semibold text-primary-600"
                              title={order.orderNumber}
                            >
                              {order.orderNumber
                                ? '#' + order.orderNumber.split('-').pop()
                                : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {order.customer
                              ? <div><p className="text-sm text-gray-900">{order.customer.name}</p><p className="text-xs text-gray-400">{order.customer.phone}</p></div>
                              : <span className="text-xs text-gray-400">Walk-in</span>}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700">{order.items?.length ?? 0}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{payMethod}</span></td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(Number(order.totalAmount ?? 0))}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                              {order.status?.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
          {txTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50">
              <p className="text-xs text-gray-500">Page {txPage + 1} of {txTotalPages}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
                {Array.from({ length: Math.min(5, txTotalPages) }, (_, i) => {
                  const page = txTotalPages <= 5 ? i : Math.max(0, Math.min(txPage - 2, txTotalPages - 5)) + i
                  return (
                    <button key={page} onClick={() => setTxPage(page)}
                      className={`w-7 h-7 text-xs rounded-lg border transition-colors ${page === txPage ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                      {page + 1}
                    </button>
                  )
                })}
                <button onClick={() => setTxPage(p => Math.min(txTotalPages - 1, p + 1))} disabled={txPage >= txTotalPages - 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {tab === 'by-category' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Categories',    value: catData.length.toString(),                                              icon: <Tag size={18} />,         color: '#3b82f6' },
              { label: 'Total Revenue', value: fmt(catTotalRev),                                                       icon: <IndianRupee size={18} />,  color: '#10b981' },
              { label: 'Top Category',  value: catData[0]?.category ?? '—',                                            icon: <TrendingUp size={18} />,  color: '#f59e0b' },
              { label: 'Top Revenue',   value: catData[0] ? fmt(Number(catData[0].totalRevenue ?? 0)) : '—',           icon: <IndianRupee size={18} />,  color: '#8b5cf6' },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${c.color}cc, ${c.color})` }}>
                  {c.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                  <p className="text-xl font-bold text-gray-900 truncate">{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {catData.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Category</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={catData.slice(0, 12)}>
                  <defs>
                    <linearGradient id="catBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                  <Bar dataKey="totalRevenue" fill="url(#catBarGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">Category Breakdown</h2>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : catData.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No data for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-right">Qty Sold</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Discount</th>
                      <th className="px-4 py-3 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {catData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.category}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{Number(row.totalQuantity ?? 0).toFixed(0)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(Number(row.totalRevenue ?? 0))}</td>
                        <td className="px-4 py-3 text-right text-sm text-orange-600">{fmt(Number(row.totalDiscount ?? 0))}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500">
                          {catTotalRev > 0 ? ((Number(row.totalRevenue ?? 0) / catTotalRev) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm">Total</td>
                      <td className="px-4 py-3 text-right text-sm">{catData.reduce((s, r) => s + Number(r.totalQuantity ?? 0), 0).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right text-sm">{fmt(catTotalRev)}</td>
                      <td className="px-4 py-3 text-right text-sm text-orange-600">{fmt(catData.reduce((s, r) => s + Number(r.totalDiscount ?? 0), 0))}</td>
                      <td className="px-4 py-3 text-right text-xs">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'by-product' && (() => {
        const prodTotalRev = prodData.reduce((s, r) => s + Number(r.totalRevenue ?? 0), 0)
        const filtered = prodData.filter(r =>
          !prodSearch ||
          r.productName?.toLowerCase().includes(prodSearch.toLowerCase()) ||
          r.sku?.toLowerCase().includes(prodSearch.toLowerCase()) ||
          r.category?.toLowerCase().includes(prodSearch.toLowerCase())
        )
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Products Sold',  value: prodData.length.toString(),                                          icon: <Package size={18} />,       color: '#3b82f6' },
                { label: 'Total Revenue',  value: fmt(prodTotalRev),                                                   icon: <IndianRupee size={18} />,   color: '#10b981' },
                { label: 'Top Product',    value: prodData[0]?.productName ?? '—',                                     icon: <TrendingUp size={18} />,    color: '#f59e0b' },
                { label: 'Top Revenue',    value: prodData[0] ? fmt(Number(prodData[0].totalRevenue ?? 0)) : '—',      icon: <IndianRupee size={18} />,   color: '#8b5cf6' },
              ].map((c, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${c.color}cc, ${c.color})` }}>
                    {c.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                    <p className="text-xl font-bold text-gray-900 truncate">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {prodData.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Top 15 Products by Revenue</h2>
                <ResponsiveContainer width="100%" height={Math.max(280, Math.min(prodData.length, 15) * 36)}>
                  <BarChart data={prodData.slice(0, 15)} layout="vertical">
                    <defs>
                      <linearGradient id="prodBarGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <YAxis dataKey="productName" type="category" width={180} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                    <Bar dataKey="totalRevenue" fill="url(#prodBarGrad)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Product Breakdown</h2>
                  {prodData.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{prodData.length} products in this period</p>}
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="Search product, SKU, category..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
                </div>
              </div>
              {loading ? (
                <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
              ) : prodData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                  <Package size={36} /><p className="text-sm text-gray-400">No product data for this period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">Product</th>
                        <th className="px-4 py-3 text-left">Category</th>
                        <th className="px-4 py-3 text-right">Qty Sold</th>
                        <th className="px-4 py-3 text-right">Revenue</th>
                        <th className="px-4 py-3 text-right">Discount</th>
                        <th className="px-4 py-3 text-right">Tax</th>
                        <th className="px-4 py-3 text-right">Cost</th>
                        <th className="px-4 py-3 text-right">Gross Profit</th>
                        <th className="px-4 py-3 text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((row, i) => {
                        const profit = Number(row.grossProfit ?? 0)
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900">{row.productName}</p>
                              {row.sku && <p className="text-xs text-gray-400">{row.sku}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{row.category}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700">{Number(row.totalQuantity ?? 0).toFixed(0)}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(Number(row.totalRevenue ?? 0))}</td>
                            <td className="px-4 py-3 text-right text-sm text-orange-600">{fmt(Number(row.totalDiscount ?? 0))}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-500">{fmt(Number(row.totalTax ?? 0))}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-500">{fmt(Number(row.totalCost ?? 0))}</td>
                            <td className={`px-4 py-3 text-right text-sm font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {fmt(profit)}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-500">
                              {prodTotalRev > 0 ? ((Number(row.totalRevenue ?? 0) / prodTotalRev) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-4 py-3 text-sm" colSpan={3}>Total</td>
                        <td className="px-4 py-3 text-right text-sm">{prodData.reduce((s, r) => s + Number(r.totalQuantity ?? 0), 0).toFixed(0)}</td>
                        <td className="px-4 py-3 text-right text-sm">{fmt(prodTotalRev)}</td>
                        <td className="px-4 py-3 text-right text-sm text-orange-600">{fmt(prodData.reduce((s, r) => s + Number(r.totalDiscount ?? 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-sm">{fmt(prodData.reduce((s, r) => s + Number(r.totalTax ?? 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-sm">{fmt(prodData.reduce((s, r) => s + Number(r.totalCost ?? 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-sm text-emerald-600">{fmt(prodData.reduce((s, r) => s + Number(r.grossProfit ?? 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-xs">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {tab === 'by-customer' && (
        <div className="space-y-5">
        {custData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl shadow-lg p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Top 10 Customers by Revenue</h2>
              <ResponsiveContainer width="100%" height={Math.max(200, Math.min(custData.length, 10) * 34)}>
                <BarChart data={custData.slice(0, 10)} layout="vertical">
                  <defs>
                    <linearGradient id="custBarGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="customerName" type="category" width={120} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                  <Bar dataKey="totalSpend" fill="url(#custBarGrad)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Revenue Share (Top 8)
                {custData.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    Total: ₹{custData.slice(0, 8).reduce((s: number, r: any) => s + Number(r.totalSpend ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                )}
              </h2>
              <ResponsiveContainer width="100%" height={340}>
                <PieChart>
                  <Pie data={custData.slice(0, 8)} dataKey="totalSpend" nameKey="customerName"
                    cx="50%" cy="50%" outerRadius={90}
                    labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    label={({ cx, cy, midAngle, customerName, percent }: any) => {
                      const RADIAN = Math.PI / 180
                      const radius = 90 + 48
                      const x = cx + radius * Math.cos(-midAngle * RADIAN)
                      const y = cy + radius * Math.sin(-midAngle * RADIAN)
                      return (
                        <text x={x} y={y} fill="#9ca3af" fontSize={11}
                          textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                          {`${customerName} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      )
                    }}>
                    {custData.slice(0, 8).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, _: any, props: any) => [`₹${Number(v).toLocaleString('en-IN')}`, props.payload.customerName]} />
                  <Legend content={({ payload }) => {
                    const total = custData.slice(0, 8).reduce((s: number, r: any) => s + Number(r.totalSpend ?? 0), 0)
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px', marginTop: 8, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                        {(payload ?? []).map((entry: any, i: number) => {
                          const pct = total > 0 ? ((entry.payload.totalSpend / total) * 100).toFixed(0) : '0'
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0 }} />
                              <span style={{ color: '#6b7280', fontSize: 12 }}>{entry.value}</span>
                              <span style={{ color: '#374151', fontSize: 12, fontWeight: 600 }}>{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Sales by Customer</h2>
              {custData.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{custData.length} customers in this period</p>}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="Search customer..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          ) : custData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
              <Users size={36} /><p className="text-sm text-gray-400">No customer data for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-center">Orders</th>
                    <th className="px-4 py-3 text-right">Total Spend</th>
                    <th className="px-4 py-3 text-right">Avg Order</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {custData
                    .filter(r => !custSearch || r.customerName?.toLowerCase().includes(custSearch.toLowerCase()) || r.phone?.includes(custSearch))
                    .map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{row.customerName}</p>
                          {row.phone && <p className="text-xs text-gray-400">{row.phone}</p>}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">{row.orderCount}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(Number(row.totalSpend ?? 0))}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt(Number(row.avgOrderValue ?? 0))}</td>
                        <td className="px-4 py-3 text-right text-sm text-orange-600">{fmt(Number(row.totalDiscount ?? 0))}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>
      )}

      {/* ── Sale Returns ── */}
      {tab === 'returns' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Returns',   value: returnData.length.toString(),                                                                     color: '#f43f5e' },
              { label: 'Total Refunded',  value: fmt(returnData.reduce((s, r) => s + Number(r.refundAmount ?? 0), 0)),                             color: '#f59e0b' },
              { label: 'Items Returned',  value: returnData.reduce((s, r) => s + Number(r.itemCount ?? 0), 0).toString(),                          color: '#f59e0b' },
              { label: 'Full Refunds',    value: returnData.filter(r => r.status === 'REFUNDED').length.toString(),                                color: '#ef4444' },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-xl p-5 shadow-[0_2px_16px_0_rgba(0,0,0,0.07)] border border-gray-100">
                <p className="text-xl font-bold text-gray-900">{c.value}</p>
                <p className="text-sm font-medium text-gray-600 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Returns chart: revenue vs refunds overlay */}
          {dailyTrend.length > 0 && (
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Daily Revenue vs Refunds</h2>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={dailyTrend}>
                  <defs>
                    <linearGradient id="revGradR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="refGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                    formatter={(v: any, name: string) => [`₹${Number(v).toLocaleString('en-IN')}`, name === 'revenue' ? 'Revenue' : 'Refunds']} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGradR)" dot={false} />
                  <Area type="monotone" dataKey="refundAmount" stroke="#f43f5e" strokeWidth={2} fill="url(#refGrad)" dot={false} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === 'revenue' ? 'Revenue' : 'Refunds'} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Sale Returns / Refunds</h2>
                {returnData.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{returnData.length} returns in this period</p>}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={returnSearch} onChange={e => setReturnSearch(e.target.value)} placeholder="Search order / customer..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : returnData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                <RotateCcw size={36} /><p className="text-sm text-gray-400">No return/refund transactions in this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Order #</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-right">Original Amt</th>
                      <th className="px-4 py-3 text-right">Refund Amt</th>
                      <th className="px-4 py-3 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {returnData
                      .filter(r => !returnSearch || r.orderNumber?.toLowerCase().includes(returnSearch.toLowerCase()) || r.customer?.toLowerCase().includes(returnSearch.toLowerCase()))
                      .map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm font-medium text-primary-600">{row.orderNumber}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(row.date)}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-900">{row.customer}</p>
                            {row.customerPhone && <p className="text-xs text-gray-400">{row.customerPhone}</p>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-500'}`}>{row.status}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700">{row.itemCount}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt(Number(row.originalAmount ?? 0))}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-rose-600">{fmt(Number(row.refundAmount ?? 0))}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 max-w-[140px] truncate">{row.notes || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Outstanding Receivable ── */}
      {tab === 'outstanding' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Customers with Dues', value: outData.length.toString(),                                                                color: '#f59e0b' },
              { label: 'Total Outstanding',   value: fmt(outData.reduce((s, r) => s + Number(r.outstandingDue ?? 0), 0)),                      color: '#f43f5e' },
              { label: 'Total Credit Limit',  value: fmt(outData.reduce((s, r) => s + Number(r.creditLimit ?? 0), 0)),                         color: '#3b82f6' },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-xl p-5 shadow-[0_2px_16px_0_rgba(0,0,0,0.07)] border border-gray-100">
                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                <p className="text-sm font-medium text-gray-600 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {outData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Outstanding Due — Top Customers</h2>
                <ResponsiveContainer width="100%" height={Math.max(180, Math.min(outData.length, 8) * 34)}>
                  <BarChart data={outData.slice(0, 8)} layout="vertical">
                    <defs>
                      <linearGradient id="outBarGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#fb923c" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <YAxis dataKey="customerName" type="category" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Outstanding']} />
                    <Bar dataKey="outstandingDue" fill="url(#outBarGrad)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Credit Limit vs Outstanding</h2>
                <ResponsiveContainer width="100%" height={Math.max(180, Math.min(outData.length, 8) * 34)}>
                  <BarChart data={outData.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <YAxis dataKey="customerName" type="category" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any, name: string) => [`₹${Number(v).toLocaleString('en-IN')}`, name === 'creditLimit' ? 'Credit Limit' : 'Outstanding']} />
                    <Bar dataKey="creditLimit"   fill="#bfdbfe" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="outstandingDue" fill="#fca5a5" radius={[0, 6, 6, 0]} />
                    <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }}
                      formatter={(v) => v === 'creditLimit' ? 'Credit Limit' : 'Outstanding'} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Outstanding Receivable</h2>
                <p className="text-xs text-gray-400 mt-0.5">Customers with pending credit dues</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={outSearch} onChange={e => setOutSearch(e.target.value)} placeholder="Search customer..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : outData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                <TrendingDown size={36} /><p className="text-sm text-gray-400">No outstanding receivables</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-center">Segment</th>
                      <th className="px-4 py-3 text-center">Orders</th>
                      <th className="px-4 py-3 text-right">Total Spent</th>
                      <th className="px-4 py-3 text-right">Credit Limit</th>
                      <th className="px-4 py-3 text-right">Outstanding Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {outData
                      .filter(r => !outSearch || r.customerName?.toLowerCase().includes(outSearch.toLowerCase()) || r.customerPhone?.includes(outSearch))
                      .map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{row.customerName}</p>
                            {row.customerPhone && <p className="text-xs text-gray-400">{row.customerPhone}</p>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{row.segment}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700">{row.orderCount}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(Number(row.totalSpent ?? 0))}</td>
                          <td className="px-4 py-3 text-right text-sm text-blue-600">{fmt(Number(row.creditLimit ?? 0))}</td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-rose-600">{fmt(Number(row.outstandingDue ?? 0))}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    {selectedOrder && (
      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    )}
    </>
  )
}
