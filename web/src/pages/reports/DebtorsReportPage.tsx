import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Users, IndianRupee, AlertCircle, Loader2, RefreshCw,
  Download, Search, ChevronDown, ChevronRight, Clock, CheckCircle, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { reportApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const BAR_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

const AGING_COLORS: Record<string, string> = {
  current:   'bg-green-50 text-green-700',
  days1_30:  'bg-yellow-50 text-yellow-700',
  days31_60: 'bg-orange-50 text-orange-700',
  days61_90: 'bg-red-50 text-red-600',
  days90plus:'bg-red-100 text-red-800',
}


type Invoice = {
  invoiceNumber: string; issueDate: string; dueDate: string | null
  totalAmount: number; paidAmount: number; outstanding: number; status: string; daysOverdue: number
}
type DebtorRow = {
  customerId: number; name: string; phone: string; gstin: string
  totalInvoiced: number; totalPaid: number; outstanding: number
  current: number; days1_30: number; days31_60: number; days61_90: number; days90plus: number
  invoices: Invoice[]
}

type Tab = 'summary' | 'party-wise' | 'invoice-aging'
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary',       label: 'Summary' },
  { key: 'party-wise',    label: 'Party-wise' },
  { key: 'invoice-aging', label: 'Invoice Aging' },
]

const fmt  = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmt2 = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function DebtorsReportPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1
  const [tab, setTab]           = useState<Tab>('summary')
  const [rows, setRows]         = useState<DebtorRow[]>([])
  const [loading, setLoading]   = useState(false)
  const [exporting, setExporting] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [search, setSearch]     = useState('')
  const [invSearch, setInvSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getDebtorsLedger(oid)
      setRows(res.data.data || [])
    } catch { toast.error('Failed to load debtors ledger') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [oid])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await reportApi.exportDebtorsCsv(oid)
      const url = URL.createObjectURL(new Blob([res.data as any], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = 'debtors_ledger.csv'; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const filtered = rows.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.phone.includes(search) || r.gstin.toLowerCase().includes(search.toLowerCase())
  )

  const allInvoices = rows.flatMap(r => r.invoices.map(inv => ({ ...inv, partyName: r.name })))
    .filter(inv => !invSearch || inv.invoiceNumber.toLowerCase().includes(invSearch.toLowerCase()) ||
      inv.partyName.toLowerCase().includes(invSearch.toLowerCase()))

  const totals = filtered.reduce(
    (a, r) => ({ totalInvoiced: a.totalInvoiced + r.totalInvoiced, totalPaid: a.totalPaid + r.totalPaid,
      outstanding: a.outstanding + r.outstanding, current: a.current + r.current,
      days1_30: a.days1_30 + r.days1_30, days31_60: a.days31_60 + r.days31_60,
      days61_90: a.days61_90 + r.days61_90, days90plus: a.days90plus + r.days90plus }),
    { totalInvoiced: 0, totalPaid: 0, outstanding: 0, current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0 }
  )

  const agingChart = [
    { name: 'Current',   value: totals.current },
    { name: '1–30 days', value: totals.days1_30 },
    { name: '31–60 days',value: totals.days31_60 },
    { name: '61–90 days',value: totals.days61_90 },
    { name: '90+ days',  value: totals.days90plus },
  ].filter(d => d.value > 0)

  const kpiCards = [
    { label: 'Total Parties',     value: rows.length.toString(),    icon: <Users size={18} />,       gradient: 'from-blue-500 to-indigo-600',   color: '#3b82f6' },
    { label: 'Total Outstanding', value: fmt(totals.outstanding),   icon: <IndianRupee size={18} />, gradient: 'from-rose-500 to-red-600',       color: '#f43f5e' },
    { label: 'Current',           value: fmt(totals.current),       icon: <CheckCircle size={18} />, gradient: 'from-emerald-500 to-teal-600',   color: '#10b981' },
    { label: '1–30 Days',         value: fmt(totals.days1_30),      icon: <Clock size={18} />,       gradient: 'from-yellow-400 to-amber-500',   color: '#eab308' },
    { label: '31–60 Days',        value: fmt(totals.days31_60),     icon: <Clock size={18} />,       gradient: 'from-orange-400 to-amber-500',   color: '#f59e0b' },
    { label: '61–90 Days',        value: fmt(totals.days61_90),     icon: <AlertCircle size={18} />, gradient: 'from-pink-500 to-rose-500',      color: '#ec4899' },
    { label: '90+ Days',          value: fmt(totals.days90plus),    icon: <AlertCircle size={18} />, gradient: 'from-red-400 to-red-600',        color: '#ef4444' },
    { label: 'Total Invoiced',    value: fmt(totals.totalInvoiced), icon: <FileText size={18} />,    gradient: 'from-violet-500 to-purple-600',  color: '#8b5cf6' },
  ]

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="relative bg-white border border-gray-200 rounded-xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3">
        <button onClick={load} disabled={loading}
          className="absolute top-2.5 right-3 p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 transition-colors">
          {loading
            ? <Loader2 size={14} className="animate-spin text-green-500" />
            : <RefreshCw size={14} className="text-green-500" />}
        </button>
        <h1 className="text-lg font-bold text-gray-900 shrink-0">Debtors Ledger</h1>
        <p className="text-xs text-gray-400">Sundry Debtors · Accounts Receivable</p>

        <div className="flex gap-1 bg-gray-100 rounded-full p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                tab === t.key ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white rounded-full'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors">
            <Download size={13} className="text-green-600" />
            {exporting ? 'Exporting…' : 'Export CSV (Tally)'}
          </button>
        </div>
      </div>

      {/* Summary Tab */}
      {tab === 'summary' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {loading ? Array(8).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                </div>
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

          {/* Aging Chart — keep light theme for readability */}
          <div className="bg-white rounded-xl shadow-lg p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Outstanding by Aging Bucket</h2>
            {agingChart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <CheckCircle size={36} className="text-green-300" />
                <p className="text-sm text-gray-400">No outstanding receivables</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={agingChart}>
                  <defs>
                    <linearGradient id="debtBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                    formatter={(v: any) => [fmt2(Number(v)), 'Amount']} />
                  <Bar dataKey="value" fill="url(#debtBarGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {/* Party-wise Tab */}
      {tab === 'party-wise' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Party-wise Outstanding</h2>
              {rows.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{rows.length} parties with outstanding dues</p>}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / GSTIN..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left w-8"></th>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Party</th>
                  <th className="px-4 py-3 text-left">GSTIN</th>
                  <th className="px-4 py-3 text-right">Invoiced</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-right">Current</th>
                  <th className="px-4 py-3 text-right">1–30d</th>
                  <th className="px-4 py-3 text-right">31–60d</th>
                  <th className="px-4 py-3 text-right">61–90d</th>
                  <th className="px-4 py-3 text-right">90+d</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(12).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                )) : filtered.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-14 text-center">
                    <CheckCircle size={32} className="mx-auto text-green-300 mb-2" />
                    <p className="text-sm text-gray-400">No outstanding receivables</p>
                  </td></tr>
                ) : (
                  <>
                    {filtered.map((row, i) => (
                      <>
                        <tr key={row.customerId}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => toggle(row.customerId)}>
                          <td className="px-4 py-3 text-gray-400">
                            {expanded.has(row.customerId) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{row.name}</p>
                            {row.phone && <p className="text-xs text-gray-400">{row.phone}</p>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.gstin || '—'}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt2(row.totalInvoiced)}</td>
                          <td className="px-4 py-3 text-right text-sm text-green-700">{fmt2(row.totalPaid)}</td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-red-600">{fmt2(row.outstanding)}</td>
                          <td className="px-4 py-3 text-right text-sm text-green-600">{row.current > 0 ? fmt2(row.current) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-right text-sm text-yellow-600">{row.days1_30 > 0 ? fmt2(row.days1_30) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-right text-sm text-orange-600">{row.days31_60 > 0 ? fmt2(row.days31_60) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-right text-sm text-red-500">{row.days61_90 > 0 ? fmt2(row.days61_90) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-red-700">{row.days90plus > 0 ? fmt2(row.days90plus) : <span className="text-gray-300 font-normal">—</span>}</td>
                        </tr>

                        {expanded.has(row.customerId) && (
                          <tr key={`${row.customerId}-inv`}>
                            <td colSpan={12} className="px-0 py-0 bg-indigo-50/60 border-b border-indigo-100">
                              <div className="px-10 py-3">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-indigo-100">
                                      <th className="pb-2 text-left pr-4">Invoice #</th>
                                      <th className="pb-2 text-left pr-4">Issue Date</th>
                                      <th className="pb-2 text-left pr-4">Due Date</th>
                                      <th className="pb-2 text-right pr-4">Amount</th>
                                      <th className="pb-2 text-right pr-4">Paid</th>
                                      <th className="pb-2 text-right pr-4">Outstanding</th>
                                      <th className="pb-2 text-center">Aging</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-indigo-100">
                                    {row.invoices.map(inv => (
                                      <tr key={inv.invoiceNumber}>
                                        <td className="py-2 pr-4 font-mono font-medium text-indigo-700">{inv.invoiceNumber}</td>
                                        <td className="py-2 pr-4 text-gray-500">{inv.issueDate}</td>
                                        <td className="py-2 pr-4 text-gray-500">{inv.dueDate ?? '—'}</td>
                                        <td className="py-2 pr-4 text-right">{fmt2(inv.totalAmount)}</td>
                                        <td className="py-2 pr-4 text-right text-green-700">{fmt2(inv.paidAmount)}</td>
                                        <td className="py-2 pr-4 text-right font-semibold text-red-600">{fmt2(inv.outstanding)}</td>
                                        <td className="py-2 text-center">
                                          {inv.daysOverdue === 0
                                            ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.current}`}>Current</span>
                                            : inv.daysOverdue <= 30
                                            ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days1_30}`}>{inv.daysOverdue}d</span>
                                            : inv.daysOverdue <= 60
                                            ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days31_60}`}>{inv.daysOverdue}d</span>
                                            : inv.daysOverdue <= 90
                                            ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days61_90}`}>{inv.daysOverdue}d</span>
                                            : <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days90plus}`}>{inv.daysOverdue}d</span>
                                          }
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}

                    <tr className="bg-gray-50 font-semibold text-sm">
                      <td colSpan={4} className="px-4 py-3 text-gray-700">Total ({filtered.length} parties)</td>
                      <td className="px-4 py-3 text-right">{fmt2(totals.totalInvoiced)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{fmt2(totals.totalPaid)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{fmt2(totals.outstanding)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{fmt2(totals.current)}</td>
                      <td className="px-4 py-3 text-right text-yellow-600">{fmt2(totals.days1_30)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{fmt2(totals.days31_60)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{fmt2(totals.days61_90)}</td>
                      <td className="px-4 py-3 text-right text-red-700">{fmt2(totals.days90plus)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Aging Tab */}
      {tab === 'invoice-aging' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Invoice Aging</h2>
              <p className="text-xs text-gray-400 mt-0.5">{allInvoices.length} unpaid / partial invoices</p>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search invoice / party..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice #</th>
                  <th className="px-4 py-3 text-left">Party</th>
                  <th className="px-4 py-3 text-left">Issue Date</th>
                  <th className="px-4 py-3 text-left">Due Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Aging</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(9).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                )) : allInvoices.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-14 text-center">
                    <CheckCircle size={32} className="mx-auto text-green-300 mb-2" />
                    <p className="text-sm text-gray-400">No outstanding invoices</p>
                  </td></tr>
                ) : allInvoices.map((inv, i) => (
                  <tr key={i} className={`hover:bg-gray-50 transition-colors ${inv.daysOverdue > 90 ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3"><span className="font-mono text-sm font-medium text-primary-600">{inv.invoiceNumber}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-900">{inv.partyName}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{inv.issueDate}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className={inv.daysOverdue > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {inv.dueDate ?? '—'}{inv.daysOverdue > 0 ? ' ⚠' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt2(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-green-700">{fmt2(inv.paidAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">{fmt2(inv.outstanding)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        inv.status === 'OVERDUE' ? 'bg-red-50 text-red-600'
                        : inv.status === 'PARTIAL' ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-blue-50 text-blue-700'}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inv.daysOverdue === 0
                        ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.current}`}>Current</span>
                        : inv.daysOverdue <= 30
                        ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days1_30}`}>{inv.daysOverdue}d</span>
                        : inv.daysOverdue <= 60
                        ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days31_60}`}>{inv.daysOverdue}d</span>
                        : inv.daysOverdue <= 90
                        ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days61_90}`}>{inv.daysOverdue}d</span>
                        : <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days90plus}`}>{inv.daysOverdue}d</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        Aging from due date (defaults to issue date + 30 days if unset). Export is Tally ERP compatible.
      </p>
    </div>
  )
}
