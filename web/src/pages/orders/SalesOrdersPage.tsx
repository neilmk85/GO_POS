import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, FileText, Clock, CheckCircle2, Truck, PackageCheck,
  XCircle, AlertCircle, ChevronLeft, ChevronRight, Eye, X,
  TrendingUp, Package, IndianRupee, ShoppingBag, Filter,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { salesOrderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; dot: string }> = {
  DRAFT:               { label: 'Draft',               icon: <FileText size={12} />,       bg: 'bg-gray-100',    text: 'text-gray-600',   dot: 'bg-gray-400' },
  CONFIRMED:           { label: 'Confirmed',            icon: <CheckCircle2 size={12} />,   bg: 'bg-blue-50',     text: 'text-blue-700',   dot: 'bg-blue-500' },
  PROCESSING:          { label: 'Processing',           icon: <Clock size={12} />,           bg: 'bg-amber-50',    text: 'text-amber-700',  dot: 'bg-amber-500' },
  PARTIALLY_DELIVERED: { label: 'Part. Delivered',      icon: <Truck size={12} />,           bg: 'bg-purple-50',   text: 'text-purple-700', dot: 'bg-purple-500' },
  DELIVERED:           { label: 'Delivered',            icon: <PackageCheck size={12} />,    bg: 'bg-teal-50',     text: 'text-teal-700',   dot: 'bg-teal-500' },
  INVOICED:            { label: 'Invoiced',             icon: <CheckCircle2 size={12} />,   bg: 'bg-green-50',    text: 'text-green-700',  dot: 'bg-green-500' },
  CANCELLED:           { label: 'Cancelled',            icon: <XCircle size={12} />,         bg: 'bg-red-50',      text: 'text-red-600',    dot: 'bg-red-400' },
  ON_HOLD:             { label: 'On Hold',              icon: <AlertCircle size={12} />,     bg: 'bg-orange-50',   text: 'text-orange-700', dot: 'bg-orange-400' },
}

const ALL_STATUSES = ['ALL', 'DRAFT', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'ON_HOLD', 'CANCELLED']

const DATE_PRESETS = [
  { label: 'All Time',   from: '', to: '' },
  { label: 'Today',      from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Week',  from: format(new Date(new Date().setDate(new Date().getDate() - 6)), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Month', from: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
  { label: 'Custom',     from: '', to: '' },
]

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export default function SalesOrdersPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { outletId } = useAuthStore()

  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [datePreset, setDatePreset] = useState(0)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 15

  const isCustom = datePreset === DATE_PRESETS.length - 1
  const preset = DATE_PRESETS[datePreset]
  const fromDate = isCustom ? customFrom : preset.from
  const toDate   = isCustom ? customTo   : preset.to

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', outletId, statusFilter, search, fromDate, toDate, page],
    queryFn: () => salesOrderApi.getAll({
      outletId,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      search: search || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      page,
      size: PAGE_SIZE,
    }).then(r => r.data.data),
    staleTime: 30_000,
  })

  const orders: any[] = data?.content ?? []
  const total: number = data?.totalElements ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // KPI counts by status from current list
  const kpiCounts = orders.reduce((acc: Record<string, number>, o: any) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})

  function handleSearch() {
    setSearch(searchInput)
    setPage(0)
  }

  const totalValue = orders.reduce((s: number, o: any) => s + parseFloat(o.totalAmount ?? 0), 0)

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">

      {/* ── Hero header ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-200">
                <ShoppingBag size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sales Orders</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage customer purchase orders end-to-end</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/sales-orders/new')}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-200 transition-all hover:shadow-xl hover:-translate-y-0.5"
            >
              <Plus size={16} /> New Sales Order
            </button>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-4 mt-5">
            {[
              { label: 'Total Orders', value: total, icon: <FileText size={16} />, gradient: 'from-violet-500 to-purple-600', light: 'bg-violet-50 text-violet-600' },
              { label: 'Pending Delivery', value: (kpiCounts['CONFIRMED'] ?? 0) + (kpiCounts['PARTIALLY_DELIVERED'] ?? 0), icon: <Truck size={16} />, gradient: 'from-amber-400 to-orange-500', light: 'bg-amber-50 text-amber-600' },
              { label: 'Delivered', value: kpiCounts['DELIVERED'] ?? 0, icon: <PackageCheck size={16} />, gradient: 'from-teal-500 to-emerald-600', light: 'bg-teal-50 text-teal-600' },
              { label: 'Order Value', value: `₹${(totalValue / 1000).toFixed(1)}K`, icon: <IndianRupee size={16} />, gradient: 'from-blue-500 to-cyan-500', light: 'bg-blue-50 text-blue-600' },
            ].map((kpi, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                  {kpi.icon}
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">{kpi.label}</p>
                  <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">

        {/* ── Filters bar ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[220px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search SO#, customer PO# or customer name…"
              className="flex-1 text-sm bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); setPage(0) }}>
                <X size={13} className="text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Date presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {DATE_PRESETS.map((p, i) => (
                <button key={i} onClick={() => { setDatePreset(i); setPage(0) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    datePreset === i
                      ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white border-transparent'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
            {isCustom && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => { setCustomFrom(e.target.value); setPage(0) }}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:ring-2 focus:ring-violet-300 focus:border-violet-400 focus:outline-none"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={e => { setCustomTo(e.target.value); setPage(0) }}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:ring-2 focus:ring-violet-300 focus:border-violet-400 focus:outline-none"
                />
              </div>
            )}
            {fromDate && toDate && !isCustom && (
              <span className="text-xs text-gray-400">{fromDate} → {toDate}</span>
            )}
          </div>

          {search && (
            <button onClick={() => { setSearch(''); setSearchInput(''); setPage(0) }}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <X size={12} /> Clear search
            </button>
          )}
        </div>

        {/* ── Status tabs ── */}
        <div className="flex gap-1 bg-gray-100 rounded-full p-1 w-fit flex-wrap">
          {ALL_STATUSES.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0) }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
              }`}>
              {s === 'ALL' ? 'All Orders' : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                <ShoppingBag size={28} className="opacity-40" />
              </div>
              <p className="font-medium text-gray-500">No sales orders found</p>
              <p className="text-sm mt-1">Create your first sales order to get started</p>
              <button onClick={() => navigate('/sales-orders/new')}
                className="mt-4 px-5 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
                + New Sales Order
              </button>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SO Number</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer PO#</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Required By</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((so: any) => (
                    <tr key={so.id}
                      onClick={() => navigate(`/sales-orders/${so.id}`)}
                      className="hover:bg-violet-50/40 cursor-pointer transition-colors group">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-sm font-semibold text-violet-700 group-hover:text-violet-900">{so.soNumber}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{so.customer?.name}</p>
                          <p className="text-xs text-gray-400">{so.customer?.phone}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-600 font-mono">{so.customerPoNumber ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-600">{format(new Date(so.orderDate), 'dd MMM yyyy')}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {so.requiredDate ? (
                          <span className={`text-sm font-medium ${
                            new Date(so.requiredDate) < new Date() && !['DELIVERED','INVOICED','CANCELLED'].includes(so.status)
                              ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {format(new Date(so.requiredDate), 'dd MMM yyyy')}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={so.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
                          <Package size={11} /> {so.items?.length ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-bold text-gray-900">₹{parseFloat(so.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/sales-orders/${so.id}`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/50">
                  <p className="text-xs text-gray-500">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} orders
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40">
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-3 py-1 text-xs font-medium text-gray-700">{page + 1} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
