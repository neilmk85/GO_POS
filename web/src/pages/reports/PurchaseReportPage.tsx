import { useState, useEffect } from 'react'
import { format, subDays, startOfMonth } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import {
  ShoppingBag, IndianRupee, AlertCircle, Loader2, RefreshCw,
  Building2, TrendingDown, PackageCheck, XCircle, Search,
  ChevronLeft, ChevronRight, Download, Clock, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { reportApi, purchaseOrderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const PRESETS = [
  { label: 'Today',      from: () => format(new Date(), 'yyyy-MM-dd'),             to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 7d',   from: () => format(subDays(new Date(), 6), 'yyyy-MM-dd'),  to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 30d',  from: () => format(subDays(new Date(), 29), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Month',from: () => format(startOfMonth(new Date()), 'yyyy-MM-dd'),to: () => format(new Date(), 'yyyy-MM-dd') },
]

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-600',
  SENT:     'bg-blue-50 text-blue-700',
  PARTIAL:  'bg-yellow-50 text-yellow-700',
  RECEIVED: 'bg-green-50 text-green-700',
  CANCELLED:'bg-red-50 text-red-500',
}

const BAR_COLORS  = ['#0d9488','#3b82f6','#f59e0b','#ef4444','#14b8a6','#60a5fa','#fbbf24','#f87171']
const PIE_COLORS  = ['#0d9488','#3b82f6','#f59e0b','#ef4444','#14b8a6','#60a5fa','#fbbf24','#f87171']

type Tab = 'summary' | 'transactions' | 'by-supplier' | 'outstanding'
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary',      label: 'Summary' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'by-supplier',  label: 'By Supplier' },
  { key: 'outstanding',  label: 'Outstanding' },
]

export default function PurchaseReportPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1
  const [tab, setTab]   = useState<Tab>('summary')
  const [from, setFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [to, setTo]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading]     = useState(false)
  const [exporting, setExporting] = useState(false)

  const [summary, setSummary]   = useState<any>(null)
  const [supChart, setSupChart] = useState<any[]>([])

  const [orders, setOrders]             = useState<any[]>([])
  const [txPage, setTxPage]             = useState(0)
  const [txTotalPages, setTxTotalPages] = useState(0)
  const [txTotal, setTxTotal]           = useState(0)
  const [txSearch, setTxSearch]         = useState('')
  const [txLoading, setTxLoading]       = useState(false)
  const PAGE_SIZE = 10

  const [supData, setSupData]     = useState<any[]>([])
  const [supSearch, setSupSearch] = useState('')
  const [outData, setOutData]     = useState<any[]>([])
  const [outSearch, setOutSearch] = useState('')

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const [s, sup] = await Promise.all([
        reportApi.getPurchaseSummary(oid, from, to),
        reportApi.getPurchaseBySupplier(oid, from, to),
      ])
      setSummary(s.data.data)
      const supList: any[] = sup.data.data ?? []
      setSupChart(supList.slice(0, 8).map(r => ({ name: r.supplierName, total: Number(r.totalValue ?? 0) })))
    } catch { toast.error('Failed to load summary') }
    finally { setLoading(false) }
  }

  const fetchOrders = async (page = 0) => {
    setTxLoading(true)
    try {
      const res = await purchaseOrderApi.getByOutlet(oid, { from, to, page, size: PAGE_SIZE })
      const d = res.data.data
      setOrders(d?.content ?? [])
      setTxTotal(d?.totalElements ?? 0)
      setTxTotalPages(Math.ceil((d?.totalElements ?? 0) / PAGE_SIZE))
    } catch { setOrders([]) }
    finally { setTxLoading(false) }
  }

  const fetchSupplier = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getPurchaseBySupplier(oid, from, to)
      setSupData(res.data.data ?? [])
    } catch { toast.error('Failed to load supplier report') }
    finally { setLoading(false) }
  }

  const fetchOutstanding = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getOutstandingPOs(oid, from, to)
      setOutData(res.data.data ?? [])
    } catch { toast.error('Failed to load outstanding POs') }
    finally { setLoading(false) }
  }

  const load = () => {
    if (tab === 'summary')           fetchSummary()
    else if (tab === 'transactions') { setTxPage(0); fetchOrders(0) }
    else if (tab === 'by-supplier')  fetchSupplier()
    else if (tab === 'outstanding')  fetchOutstanding()
  }

  useEffect(() => { load() }, [from, to, oid, tab])
  useEffect(() => { if (tab === 'transactions') fetchOrders(txPage) }, [txPage])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await reportApi.exportPurchaseCsv(oid, from, to)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = `purchases_${from}_${to}.csv`; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const kpiCards = summary ? [
    { label: 'Total PO Value',   value: fmt(summary.totalValue ?? 0),            icon: <IndianRupee size={18} />, gradient: 'from-blue-500 to-indigo-600',   color: '#3b82f6' },
    { label: 'Purchase Orders',  value: (summary.totalOrders ?? 0).toString(),   icon: <ShoppingBag size={18} />, gradient: 'from-sky-500 to-blue-600',       color: '#0ea5e9' },
    { label: 'Received',         value: (summary.received ?? 0).toString(),      icon: <PackageCheck size={18} />,gradient: 'from-emerald-500 to-teal-600',   color: '#10b981' },
    { label: 'Outstanding Amt',  value: fmt(summary.outstanding ?? 0),           icon: <AlertCircle size={18} />, gradient: 'from-amber-400 to-orange-500',   color: '#f59e0b' },
    { label: 'Avg PO Value',     value: fmt(summary.avgPoValue ?? 0),            icon: <TrendingDown size={18} />,gradient: 'from-violet-500 to-indigo-600',  color: '#8b5cf6' },
    { label: 'Unique Suppliers', value: (summary.uniqueSuppliers ?? 0).toString(),icon: <Building2 size={18} />, gradient: 'from-cyan-500 to-sky-600',        color: '#0ea5e9' },
    { label: 'Pending',          value: (summary.pending ?? 0).toString(),       icon: <Clock size={18} />,       gradient: 'from-orange-400 to-amber-500',   color: '#f59e0b' },
    { label: 'Cancelled',        value: (summary.cancelled ?? 0).toString(),     icon: <XCircle size={18} />,     gradient: 'from-rose-500 to-red-600',       color: '#f43f5e' },
  ] : []

  const supTotalValue = supData.reduce((s, r) => s + Number(r.totalValue ?? 0), 0)
  const outTotalValue = outData.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0)

  return (
    <div className="p-6">
      <div className="relative bg-white border border-gray-200 rounded-xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3">
        <button onClick={load} disabled={loading || txLoading}
          className="absolute top-2.5 right-3 p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 transition-colors">
          {loading || txLoading
            ? <Loader2 size={14} className="animate-spin text-green-500" />
            : <RefreshCw size={14} className="text-green-500" />}
        </button>
        <h1 className="text-lg font-bold text-gray-900 shrink-0">Purchase Report</h1>

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
              <div key={i} className="rounded-2xl p-4 bg-gray-100 animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-xl shrink-0" />
                <div className="flex-1"><div className="h-3 bg-gray-200 rounded w-1/2 mb-2" /><div className="h-5 bg-gray-200 rounded w-3/4" /></div>
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

          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Purchases by Supplier</h2>
            {supChart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-300 gap-2">
                <Building2 size={36} /><p className="text-sm text-gray-400">No purchase data for this period</p>
              </div>
            ) : (() => {
              const maxVal = Math.max(...supChart.map(r => r.total))
              return (
                <div className="space-y-3">
                  {supChart.map((r, i) => {
                    const pct = maxVal > 0 ? (r.total / maxVal) * 100 : 0
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-bold text-gray-400 shrink-0 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-800 truncate pr-2">{r.name}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 shrink-0 w-24 text-right">
                          ₹{r.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Purchase Orders</h2>
              {txTotal > 0 && <p className="text-xs text-gray-400 mt-0.5">{txTotal} orders in this period</p>}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search PO #..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">PO Number</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-left">Expected</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {txLoading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(7).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                )) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center">
                    <ShoppingBag size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">No purchase orders in this period</p>
                  </td></tr>
                ) : orders
                    .filter(o => !txSearch || o.poNumber?.toLowerCase().includes(txSearch.toLowerCase()))
                    .map((o: any) => (
                      <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3"><span className="text-sm font-mono font-medium text-primary-600">{o.poNumber}</span></td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{o.createdAt ? format(new Date(o.createdAt), 'dd MMM yyyy') : '—'}</td>
                        <td className="px-4 py-3">
                          {o.supplier ? <div><p className="text-sm text-gray-900">{o.supplier.name}</p><p className="text-xs text-gray-400">{o.supplier.phone}</p></div>
                            : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">{o.items?.length ?? 0}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{o.expectedDate ? format(new Date(o.expectedDate), 'dd MMM yyyy') : '—'}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(Number(o.totalAmount ?? 0))}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-500'}`}>{o.status ?? '—'}</span>
                        </td>
                      </tr>
                    ))}
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
      )}

      {tab === 'by-supplier' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Suppliers', value: supData.length.toString(),                                          icon: <Building2 size={18} />,  gradient: 'from-blue-500 to-indigo-600'  },
              { label: 'Total Value',     value: fmt(supTotalValue),                                                  icon: <IndianRupee size={18} />, gradient: 'from-emerald-500 to-teal-600' },
              { label: 'Top Supplier',    value: supData[0]?.supplierName ?? '—',                                    icon: <Building2 size={18} />,  gradient: 'from-amber-400 to-orange-500' },
              { label: 'Outstanding',     value: fmt(supData.reduce((s, r) => s + Number(r.outstanding ?? 0), 0)),  icon: <AlertCircle size={18} />, gradient: 'from-rose-500 to-red-600'     },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                  {c.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                  <p className="text-xl font-bold text-gray-900 truncate">{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">Supplier Analysis</h2>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={supSearch} onChange={e => setSupSearch(e.target.value)} placeholder="Search supplier..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : supData.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No supplier data for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Supplier</th>
                      <th className="px-4 py-3 text-center">Orders</th>
                      <th className="px-4 py-3 text-center">Received</th>
                      <th className="px-4 py-3 text-center">Pending</th>
                      <th className="px-4 py-3 text-right">Avg PO Value</th>
                      <th className="px-4 py-3 text-right">Total Value</th>
                      <th className="px-4 py-3 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {supData
                      .filter(r => !supSearch || r.supplierName?.toLowerCase().includes(supSearch.toLowerCase()))
                      .map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{row.supplierName}</p>
                            {row.phone && <p className="text-xs text-gray-400">{row.phone}</p>}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700">{row.orderCount}</td>
                          <td className="px-4 py-3 text-center"><span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{row.received}</span></td>
                          <td className="px-4 py-3 text-center"><span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">{row.pending}</span></td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt(Number(row.avgPoValue ?? 0))}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(Number(row.totalValue ?? 0))}</td>
                          <td className="px-4 py-3 text-right text-sm text-yellow-600 font-medium">{fmt(Number(row.outstanding ?? 0))}</td>
                        </tr>
                      ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm" colSpan={2}>Total</td>
                      <td className="px-4 py-3 text-center text-sm">{supData.reduce((s, r) => s + Number(r.orderCount ?? 0), 0)}</td>
                      <td className="px-4 py-3 text-center text-sm">{supData.reduce((s, r) => s + Number(r.received ?? 0), 0)}</td>
                      <td className="px-4 py-3 text-center text-sm">{supData.reduce((s, r) => s + Number(r.pending ?? 0), 0)}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right text-sm">{fmt(supTotalValue)}</td>
                      <td className="px-4 py-3 text-right text-sm text-yellow-600">{fmt(supData.reduce((s, r) => s + Number(r.outstanding ?? 0), 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'outstanding' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Open POs',          value: outData.length.toString(),                                                                     icon: <FileText size={18} />,    gradient: 'from-blue-500 to-indigo-600'  },
              { label: 'Total Outstanding', value: fmt(outTotalValue),                                                                             icon: <IndianRupee size={18} />, gradient: 'from-amber-400 to-orange-500' },
              { label: 'Overdue',           value: outData.filter(r => r.expectedDate && new Date(r.expectedDate) < new Date()).length.toString(), icon: <AlertCircle size={18} />, gradient: 'from-rose-500 to-red-600'     },
            ].map((c, i) => (
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

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Outstanding Purchase Orders</h2>
                <p className="text-xs text-gray-400 mt-0.5">Draft, Sent, and Partially received orders</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={outSearch} onChange={e => setOutSearch(e.target.value)} placeholder="Search PO / supplier..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : outData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                <PackageCheck size={36} /><p className="text-sm text-gray-400">No outstanding POs for this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">PO Number</th>
                      <th className="px-4 py-3 text-left">Supplier</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-left">Order Date</th>
                      <th className="px-4 py-3 text-left">Expected</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {outData
                      .filter(r => !outSearch || r.poNumber?.toLowerCase().includes(outSearch.toLowerCase()) || r.supplierName?.toLowerCase().includes(outSearch.toLowerCase()))
                      .map((row, i) => {
                        const isOverdue = row.expectedDate && new Date(row.expectedDate) < new Date()
                        return (
                          <tr key={i} className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                            <td className="px-4 py-3"><span className="text-sm font-mono font-medium text-primary-600">{row.poNumber}</span></td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-900">{row.supplierName}</p>
                              {row.supplierPhone && <p className="text-xs text-gray-400">{row.supplierPhone}</p>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-500'}`}>{row.status}</span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-700">{row.itemCount}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{row.orderDate}</td>
                            <td className="px-4 py-3 text-xs">
                              <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}>
                                {row.expectedDate || '—'}{isOverdue && ' ⚠'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(Number(row.totalAmount ?? 0))}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
