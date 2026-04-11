import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity, Search, Filter, ChevronLeft, ChevronRight,
  LogIn, LogOut, Plus, Pencil, Trash2, RefreshCw, X, Clock,
} from 'lucide-react'
import { activityLogApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ── Action metadata ────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; dot: string; iconBg: string; iconColor: string; icon: React.ReactNode }> = {
  CREATED: { label: 'Created',    dot: 'bg-emerald-400', iconBg: 'bg-emerald-50',  iconColor: 'text-emerald-600', icon: <Plus   size={13} /> },
  UPDATED: { label: 'Updated',    dot: 'bg-blue-400',    iconBg: 'bg-blue-50',     iconColor: 'text-blue-600',    icon: <Pencil size={13} /> },
  DELETED: { label: 'Deleted',    dot: 'bg-red-400',     iconBg: 'bg-red-50',      iconColor: 'text-red-600',     icon: <Trash2 size={13} /> },
  LOGIN:   { label: 'Logged In',  dot: 'bg-violet-400',  iconBg: 'bg-violet-50',   iconColor: 'text-violet-600',  icon: <LogIn  size={13} /> },
  LOGOUT:  { label: 'Logged Out', dot: 'bg-gray-300',    iconBg: 'bg-gray-50',     iconColor: 'text-gray-500',    icon: <LogOut size={13} /> },
  // legacy
  CREATE:  { label: 'Created',    dot: 'bg-emerald-400', iconBg: 'bg-emerald-50',  iconColor: 'text-emerald-600', icon: <Plus   size={13} /> },
  UPDATE:  { label: 'Updated',    dot: 'bg-blue-400',    iconBg: 'bg-blue-50',     iconColor: 'text-blue-600',    icon: <Pencil size={13} /> },
  DELETE:  { label: 'Deleted',    dot: 'bg-red-400',     iconBg: 'bg-red-50',      iconColor: 'text-red-600',     icon: <Trash2 size={13} /> },
}

const ACTION_BADGE: Record<string, string> = {
  CREATED: 'bg-emerald-100 text-emerald-700',
  UPDATED: 'bg-blue-100 text-blue-700',
  DELETED: 'bg-red-100 text-red-700',
  LOGIN:   'bg-violet-100 text-violet-700',
  LOGOUT:  'bg-gray-100 text-gray-500',
  CREATE:  'bg-emerald-100 text-emerald-700',
  UPDATE:  'bg-blue-100 text-blue-700',
  DELETE:  'bg-red-100 text-red-700',
}

const MODULE_LABELS: Record<string, string> = {
  AUTH: 'Auth', INVOICE: 'Invoice', QUOTATION: 'Quotation', ORDER: 'Order',
  CUSTOMER: 'Customer', PRODUCT: 'Product', INVENTORY: 'Inventory',
  TRANSFER: 'Transfer', PAYMENT_IN: 'Payment In', PAYMENT_OUT: 'Payment Out',
  VENDOR: 'Vendor', BILL: 'Bill', PURCHASE_ORDER: 'Purchase Order',
  PURCHASE: 'Purchase', CREDIT_NOTE: 'Credit Note', RETURN: 'Return',
  DELIVERY_CHALLAN: 'Delivery Challan', DISCOUNT: 'Discount', STAFF: 'Staff',
  CATEGORY: 'Category', INCENTIVE: 'Incentive', SHIFT: 'Shift', SETTINGS: 'Settings',
}

// ── Date preset helpers ────────────────────────────────────────────────────────

type DatePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_7' | 'last_30' | 'custom' | ''

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'last_week',  label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_7',     label: 'Last 7 Days' },
  { key: 'last_30',    label: 'Last 30 Days' },
  { key: 'custom',     label: 'Custom' },
]

function istStr(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function getPresetRange(preset: DatePreset): { from: string; to: string } | null {
  if (!preset || preset === 'custom') return null
  const now     = new Date()
  const todayStr = istStr(now)
  const offset  = (days: number) => istStr(new Date(now.getTime() + days * 86_400_000))

  // Day-of-week in IST (0=Sun…6=Sat)
  const istDay = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay()
  const fromMon = istDay === 0 ? 6 : istDay - 1   // days since last Monday

  switch (preset) {
    case 'today':      return { from: todayStr, to: todayStr }
    case 'yesterday':  return { from: offset(-1), to: offset(-1) }
    case 'this_week':  return { from: offset(-fromMon), to: todayStr }
    case 'last_week':  return { from: offset(-fromMon - 7), to: offset(-fromMon - 1) }
    case 'last_7':     return { from: offset(-6), to: todayStr }
    case 'last_30':    return { from: offset(-29), to: todayStr }
    case 'this_month': {
      const d = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: todayStr }
    }
    case 'last_month': {
      const d  = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const lastDay  = new Date(d.getFullYear(), d.getMonth(), 0)
      const firstDay = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1)
      return { from: istStr(firstDay), to: istStr(lastDay) }
    }
    default: return null
  }
}

// ── Date/time helpers ──────────────────────────────────────────────────────────

function toUtcDate(iso: string): Date {
  return new Date(iso.includes('Z') || iso.includes('+') ? iso : iso + 'Z')
}

function fmtDateTime(iso: string) {
  return toUtcDate(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fmtTime(iso: string) {
  return toUtcDate(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fmtDateLabel(iso: string) {
  const d = toUtcDate(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const isoDate    = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const todayDate  = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const yestDate   = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  if (isoDate === todayDate)  return 'Today'
  if (isoDate === yestDate)   return 'Yesterday'
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' })
}

function dateKey(iso: string) {
  return toUtcDate(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function timeAgo(iso: string) {
  const diff = Date.now() - toUtcDate(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return null
}

// ── Description parsing ────────────────────────────────────────────────────────

function parseDescription(desc: string): { title: string; changes: string[] } {
  const sep = desc.indexOf(' — ')
  if (sep === -1) return { title: desc, changes: [] }
  const title   = desc.slice(0, sep)
  const changes = desc.slice(sep + 3).split(', ').map(s => s.trim()).filter(Boolean)
  return { title, changes }
}

const INLINE_LIMIT = 2

function DescriptionCell({ desc, onDetail }: { desc: string; onDetail: () => void }) {
  const { title, changes } = parseDescription(desc)

  if (changes.length === 0) {
    return <span className="text-sm text-gray-800">{desc}</span>
  }

  const shown  = changes.slice(0, INLINE_LIMIT)
  const hidden = changes.length - shown.length

  return (
    <span className="text-sm text-gray-800">
      {title}
      <span className="text-gray-300 mx-1">·</span>
      {shown.map((c, i) => (
        <span key={i} className="text-gray-500 text-xs">
          {c}{i < shown.length - 1 || hidden > 0 ? <span className="text-gray-300">, </span> : ''}
        </span>
      ))}
      {hidden > 0 && (
        <button
          onClick={e => { e.stopPropagation(); onDetail() }}
          className="text-primary-600 hover:text-primary-700 text-xs font-medium underline underline-offset-2"
        >
          +{hidden} more
        </button>
      )}
    </span>
  )
}

// ── Detail modal ───────────────────────────────────────────────────────────────

function DetailModal({ log, onClose }: { log: any; onClose: () => void }) {
  const { title, changes } = parseDescription(log.description)
  const meta = ACTION_META[log.action] ?? ACTION_META['UPDATED']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.iconBg} ${meta.iconColor}`}>
            {meta.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ACTION_BADGE[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                {meta.label}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-500">
                {MODULE_LABELS[log.module] ?? log.module}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-snug">{title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Meta row */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[9px] font-bold">
              {(log.userName ?? log.userEmail ?? 'S').split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            {log.userName ?? log.userEmail ?? 'System'}
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <Clock size={11} />
            {fmtDateTime(log.createdAt)}
          </span>
          {log.ipAddress && (
            <span className="font-mono text-gray-300">{log.ipAddress}</span>
          )}
        </div>

        {/* Changes */}
        <div className="overflow-y-auto p-5 space-y-2">
          {changes.length === 0 ? (
            <p className="text-sm text-gray-600">{log.description}</p>
          ) : (
            changes.map((c, i) => {
              const arrowIdx = c.indexOf(' → ')
              if (arrowIdx !== -1) {
                const labelEnd = c.indexOf(': ')
                const field = labelEnd !== -1 && labelEnd < arrowIdx ? c.slice(0, labelEnd) : ''
                const from  = field ? c.slice(labelEnd + 2, arrowIdx) : c.slice(0, arrowIdx)
                const to    = c.slice(arrowIdx + 3)
                return (
                  <div key={i} className="grid grid-cols-[6rem_1fr_auto_1fr] items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm">
                    {field
                      ? <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">{field}</span>
                      : <span />
                    }
                    <span className="text-red-500 bg-red-50 rounded px-1.5 py-0.5 text-xs font-mono break-all line-through">{from}</span>
                    <span className="text-gray-300 text-base">→</span>
                    <span className="text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5 text-xs font-mono break-all font-medium">{to}</span>
                  </div>
                )
              }
              return (
                <div key={i} className="rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-700">{c}</div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── User avatar ────────────────────────────────────────────────────────────────

function UserAvatar({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' }) {
  const initials = (name ?? '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  const cls = size === 'sm'
    ? 'w-5 h-5 text-[9px]'
    : 'w-7 h-7 text-xs'
  return (
    <div className={`rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold flex-shrink-0 ${cls}`}>
      {initials}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ActivityLogsPage() {
  const { outletId } = useAuthStore()
  const queryClient = useQueryClient()
  const [page, setPage]               = useState(0)
  const [search, setSearch]           = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [module, setModule]           = useState('')
  const [action, setAction]           = useState('')
  const [fromDate, setFromDate]       = useState('')
  const [toDate, setToDate]           = useState('')
  const [datePreset, setDatePreset]   = useState<DatePreset>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [detailLog, setDetailLog]     = useState<any>(null)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const params = {
    module:  module   || undefined,
    action:  action   || undefined,
    from:    fromDate || undefined,
    to:      toDate   || undefined,
    search:  search   || undefined,
    page,
    size: 50,
  }

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['activity-logs', outletId, params],
    queryFn: () => activityLogApi.search(outletId!, params).then(r => r.data.data),
    enabled: !!outletId,
    refetchInterval: 15000,
  })

  const handleRefresh = useCallback(() => {
    refetch()
    queryClient.invalidateQueries({ queryKey: ['activity-logs-filters', outletId] })
  }, [refetch, queryClient, outletId])

  const { data: filterOpts } = useQuery({
    queryKey: ['activity-logs-filters', outletId],
    queryFn: () => activityLogApi.getFilterOptions(outletId!).then(r => r.data.data),
    enabled: !!outletId,
    staleTime: 60_000,
  })

  const logs        = data?.content ?? []
  const totalPages  = data?.totalPages ?? 0
  const totalElements = data?.totalElements ?? 0
  const hasFilters  = !!(module || action || fromDate || toDate)

  function applyPreset(preset: DatePreset) {
    setDatePreset(preset)
    const range = getPresetRange(preset)
    setFromDate(range?.from ?? '')
    setToDate(range?.to ?? '')
    setPage(0)
  }

  // Group logs by date
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; entries: any[] }>()
    for (const log of logs) {
      const key   = dateKey(log.createdAt)
      const label = fmtDateLabel(log.createdAt)
      if (!map.has(key)) map.set(key, { label, entries: [] })
      map.get(key)!.entries.push(log)
    }
    return Array.from(map.values())
  }, [logs])

  function clearFilters() {
    setModule(''); setAction(''); setFromDate(''); setToDate(''); setDatePreset(''); setPage(0)
  }

  return (
    <div className="min-h-full bg-gray-50/60">
      {detailLog && <DetailModal log={detailLog} onClose={() => setDetailLog(null)} />}

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Activity size={18} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-none">Activity Logs</h1>
              <p className="text-xs text-gray-400 mt-0.5">Track all system activities and changes</p>
            </div>
          </div>

          {/* Search + filters — inline */}
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by description or user…"
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition-colors"
              />
              {searchInput && (
                <button onClick={() => { setSearchInput(''); setSearch('') }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap
                ${hasFilters
                  ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
            >
              <Filter size={13} />
              Filters
              {hasFilters && <span className="bg-white/25 text-white text-[10px] px-1.5 py-0.5 rounded-full">ON</span>}
            </button>
            {hasFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-500 hover:bg-gray-50 whitespace-nowrap">
                <X size={12} /> Clear
              </button>
            )}
          </div>

          {/* Record count + refresh */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {totalElements > 0 && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
                {totalElements.toLocaleString()} records
              </span>
            )}
            <span className="text-[11px] text-gray-400 whitespace-nowrap hidden sm:inline">Auto-refreshes every 15s</span>
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              title="Refresh now"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-primary-600 hover:border-primary-300 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin text-primary-400' : ''} />
              <span className="text-xs font-medium">Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter panel — single line */}
        {filtersOpen && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {/* Module */}
            <select value={module} onChange={e => { setModule(e.target.value); setPage(0) }}
              className="w-40 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none">
              <option value="">All Modules</option>
              {(filterOpts?.modules ?? Object.keys(MODULE_LABELS)).map((m: string) => (
                <option key={m} value={m}>{MODULE_LABELS[m] ?? m}</option>
              ))}
            </select>

            {/* Action */}
            <select value={action} onChange={e => { setAction(e.target.value); setPage(0) }}
              className="w-36 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none">
              <option value="">All Actions</option>
              {[['CREATED','Created'],['UPDATED','Updated'],['DELETED','Deleted'],['LOGIN','Logged In'],['LOGOUT','Logged Out']].map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200" />

            {/* Date preset chips */}
            {DATE_PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(datePreset === p.key && p.key !== 'custom' ? '' : p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap
                  ${datePreset === p.key
                    ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'}`}
              >
                {p.label}
              </button>
            ))}

            {/* Custom date inputs */}
            {datePreset === 'custom' && (
              <>
                <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0) }}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none [color-scheme:light]" />
                <span className="text-gray-400 text-xs">to</span>
                <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(0) }}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none [color-scheme:light]" />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Log list ── */}
      <div className="px-6 py-5">
        {isLoading ? (
          <div className="space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="h-2.5 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Activity size={26} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-500">No activity logs found</p>
            <p className="text-sm mt-1 text-gray-400">
              {hasFilters || search ? 'Try adjusting your filters' : 'Activities will appear here as you use the system'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(group => (
              <div key={group.label}>
                {/* Date divider */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Entries for this date */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
                  {group.entries.map((log: any, idx: number) => {
                    const meta = ACTION_META[log.action] ?? {
                      label: log.action, dot: 'bg-gray-300', iconBg: 'bg-gray-50', iconColor: 'text-gray-500', icon: null
                    }
                    const ago = timeAgo(log.createdAt)

                    return (
                      <div
                        key={log.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/70 transition-colors group"
                      >
                        {/* Action icon */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.iconBg} ${meta.iconColor}`}>
                          {meta.icon}
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${ACTION_BADGE[log.action] ?? 'bg-gray-100 text-gray-500'}`}>
                              {meta.label}
                            </span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400">
                              {MODULE_LABELS[log.module] ?? log.module}
                            </span>
                            <DescriptionCell desc={log.description} onDetail={() => setDetailLog(log)} />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <UserAvatar name={log.userName} size="sm" />
                            <span className="text-xs text-gray-400">{log.userName ?? log.userEmail ?? 'System'}</span>
                            {log.ipAddress && (
                              <span className="text-[10px] text-gray-300 font-mono hidden sm:inline">{log.ipAddress}</span>
                            )}
                          </div>
                        </div>

                        {/* Time */}
                        <div className="flex-shrink-0 text-right">
                          <div className="text-xs font-medium text-gray-400">{fmtTime(log.createdAt)}</div>
                          {ago && <div className="text-[10px] text-gray-300 mt-0.5">{ago}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-sm text-gray-500 px-2">
              Page <span className="font-semibold text-gray-700">{page + 1}</span> of {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
