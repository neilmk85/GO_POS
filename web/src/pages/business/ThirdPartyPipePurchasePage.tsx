import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth } from 'date-fns'
import {
  Package, Plus, Trash2, X, Loader2, AlertTriangle,
  ShoppingCart, Hash, Banknote, Building2, BarChart2,
  Calendar, ChevronDown,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { pipePurchasesApi, type PipePurchaseEntry } from '@/services/businessApi'
import { pipeConfigApi, vendorApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(s: string) {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function fmtNum(n: string | number | undefined) {
  if (n == null || n === '') return '—'
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function startOf(unit: 'week' | 'month' | 'quarter' | 'year', d = new Date()) {
  const r = new Date(d)
  if (unit === 'week') { const day = r.getDay() || 7; r.setDate(r.getDate() - day + 1) }
  else if (unit === 'month') r.setDate(1)
  else if (unit === 'quarter') r.setMonth(Math.floor(r.getMonth() / 3) * 3, 1)
  else r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0)
  return r
}

type PresetKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today',        label: 'Today' },
  { key: 'yesterday',    label: 'Yesterday' },
  { key: 'this_week',    label: 'This Week' },
  { key: 'last_week',    label: 'Last Week' },
  { key: 'this_month',   label: 'This Month' },
  { key: 'last_month',   label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year',    label: 'This Year' },
]

function resolvePreset(key: PresetKey): { from: string; to: string } {
  const today = new Date(); const to = isoDate(today)
  switch (key) {
    case 'today':        return { from: to, to }
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); const d = isoDate(y); return { from: d, to: d } }
    case 'this_week':    return { from: isoDate(startOf('week')), to }
    case 'last_week': { const end = new Date(startOf('week')); end.setDate(end.getDate() - 1); const start = new Date(end); start.setDate(start.getDate() - 6); return { from: isoDate(start), to: isoDate(end) } }
    case 'this_month':   return { from: isoDate(startOf('month')), to }
    case 'last_month': { const end = new Date(startOf('month')); end.setDate(end.getDate() - 1); return { from: isoDate(startOf('month', end)), to: isoDate(end) } }
    case 'this_quarter': return { from: isoDate(startOf('quarter')), to }
    case 'this_year':    return { from: isoDate(startOf('year')), to }
  }
}

function DateRangePicker({ fromDate, toDate, onChange }: {
  fromDate: string; toDate: string; onChange: (f: string, t: string) => void
}) {
  const [open, setOpen]             = useState(false)
  const [preset, setPreset]         = useState<PresetKey | ''>('this_month')
  const [customFrom, setCustomFrom] = useState(fromDate)
  const [customTo, setCustomTo]     = useState(toDate)
  const [pos, setPos]               = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const ref    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

  function selectPreset(key: PresetKey) {
    setPreset(key)
    const { from, to } = resolvePreset(key)
    setCustomFrom(from); setCustomTo(to)
    onChange(from, to); setOpen(false)
  }

  function applyCustom() { onChange(customFrom, customTo); setOpen(false) }
  function clear() { setPreset(''); setCustomFrom(''); setCustomTo(''); onChange('', '') }

  const hasDate = fromDate || toDate
  const activeLabel = preset
    ? PRESETS.find(p => p.key === preset)?.label
    : hasDate ? `${fromDate || '…'} → ${toDate || '…'}` : null

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border transition-all ${
          hasDate
            ? 'bg-white/20 border-white/40 text-white backdrop-blur-sm'
            : 'bg-white/10 border-white/20 text-white/90 hover:bg-white/20 hover:border-white/40 backdrop-blur-sm'
        }`}
      >
        <Calendar size={14} />
        <span>{activeLabel ?? 'Filter by Date'}</span>
        {hasDate
          ? <X size={13} onClick={e => { e.stopPropagation(); clear() }} className="ml-1 opacity-70 hover:opacity-100" />
          : <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>

      {open && (
        <div ref={ref} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }} className="bg-white rounded-2xl shadow-xl border border-gray-100 w-72">
          <div className="p-2">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => selectPreset(p.key)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  preset === p.key ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p.label}
                {preset === p.key && (
                  <span className="float-right text-xs text-violet-400 tabular-nums">{fromDate} → {toDate}</span>
                )}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 mx-3" />
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Custom Range</p>
            <div className="grid grid-cols-2 gap-2">
              {([['From', customFrom, setCustomFrom], ['To', customTo, setCustomTo]] as const).map(([lbl, val, set]) => (
                <div key={lbl}>
                  <label className="text-xs text-gray-500 mb-0.5 block">{lbl}</label>
                  <input type="date" value={val}
                    onChange={e => { set(e.target.value); setPreset('') }}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              ))}
            </div>
            <button onClick={applyCustom} disabled={!customFrom && !customTo}
              className="w-full py-1.5 text-sm font-medium bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg disabled:opacity-40 hover:from-violet-700 hover:to-blue-700">
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Form ─────────────────────────────────────────────────────────────────

function AddForm({
  outletId,
  pipeConfigs,
  vendors,
  onSuccess,
  onCancel,
}: {
  outletId: number
  pipeConfigs: any[]
  vendors: any[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    purchaseDate:  today(),
    pipeConfigId:  '',
    pipeName:      '',
    vendorId:      '',
    vendorName:    '',
    invoiceNumber: '',
    quantity:      '',
    unitRate:      '',
    totalAmount:   '',
    notes:         '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: (data: any) => pipePurchasesApi.create(data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pipe-purchases'] })
      toast.success(`${data.quantity} × ${data.pipeName} added to inventory`)
      onSuccess()
    },
    onError: () => toast.error('Failed to record purchase'),
  })

  function set(k: keyof typeof form, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      // Auto-compute total
      const qty  = Number(k === 'quantity'  ? v : next.quantity)
      const rate = Number(k === 'unitRate'   ? v : next.unitRate)
      if (!isNaN(qty) && !isNaN(rate)) {
        next.totalAmount = (qty * rate).toFixed(2)
      }
      return next
    })
    setErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  function handlePipeChange(id: string) {
    const pc = pipeConfigs.find((p: any) => String(p.id) === id)
    setForm(prev => ({
      ...prev,
      pipeConfigId: id,
      pipeName: pc?.name ?? prev.pipeName,
    }))
  }

  function handleVendorChange(id: string) {
    const v = vendors.find((v: any) => String(v.id) === id)
    setForm(prev => ({
      ...prev,
      vendorId:   id,
      vendorName: v?.name ?? prev.vendorName,
    }))
  }

  function handleSubmit() {
    const errs: Record<string, string> = {}
    if (!form.purchaseDate)             errs.purchaseDate  = 'Date is required'
    if (!form.pipeName.trim())          errs.pipeName      = 'Pipe type is required'
    if (!form.quantity || Number(form.quantity) < 1) errs.quantity = 'Quantity must be ≥ 1'
    if (!form.vendorName.trim())        errs.vendorName    = 'Vendor name is required'
    if (Object.keys(errs).length) { setErrors(errs); return }

    mutation.mutate({
      outletId:      outletId,
      purchaseDate:  form.purchaseDate,
      pipeConfigId:  form.pipeConfigId ? Number(form.pipeConfigId) : null,
      pipeName:      form.pipeName.trim(),
      supplierId:    form.vendorId ? Number(form.vendorId) : null,
      vendorName:    form.vendorName.trim(),
      invoiceNumber: form.invoiceNumber.trim(),
      quantity:      Number(form.quantity),
      unitRate:      form.unitRate || '0',
      totalAmount:   form.totalAmount || '0',
      notes:         form.notes.trim(),
      createdBy:     '',
    })
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const sel = inp + ' bg-white'
  const err = (k: string) => errors[k] ? <p className="text-red-500 text-xs mt-1">{errors[k]}</p> : null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-blue-900 text-sm">Record Pipe Purchase</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Purchase Date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Date *</label>
          <input type="date" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} className={inp} />
          {err('purchaseDate')}
        </div>

        {/* Pipe Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Pipe Type *</label>
          <select value={form.pipeConfigId} onChange={e => handlePipeChange(e.target.value)} className={sel}>
            <option value="">— Select Pipe Config —</option>
            {pipeConfigs.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {/* Free-text override */}
          <input
            type="text"
            placeholder="Or type pipe name manually"
            value={form.pipeName}
            onChange={e => set('pipeName', e.target.value)}
            className={inp + ' mt-1'}
          />
          {err('pipeName')}
        </div>

        {/* Vendor */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vendor *</label>
          <select value={form.vendorId} onChange={e => handleVendorChange(e.target.value)} className={sel}>
            <option value="">— Select Vendor —</option>
            {vendors.map((v: any) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Or type vendor name"
            value={form.vendorName}
            onChange={e => set('vendorName', e.target.value)}
            className={inp + ' mt-1'}
          />
          {err('vendorName')}
        </div>

        {/* Invoice No */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Invoice No.</label>
          <input type="text" placeholder="e.g. INV-2024-001" value={form.invoiceNumber} onChange={e => set('invoiceNumber', e.target.value)} className={inp} />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Quantity (pcs) *</label>
          <input type="number" min={1} placeholder="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} className={inp} />
          {err('quantity')}
        </div>

        {/* Unit Rate */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Unit Rate (₹)</label>
          <input type="number" min={0} step="0.01" placeholder="0.00" value={form.unitRate} onChange={e => set('unitRate', e.target.value)} className={inp} />
        </div>

        {/* Total Amount */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Total Amount (₹)</label>
          <input type="number" min={0} step="0.01" placeholder="auto-computed" value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)} className={inp + ' bg-gray-50'} />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input type="text" placeholder="Optional notes" value={form.notes} onChange={e => set('notes', e.target.value)} className={inp} />
        </div>
      </div>

      <div className="flex justify-end mt-4 gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Record Purchase
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ThirdPartyPipePurchasePage() {
  const { outletId } = useAuthStore()
  const qc = useQueryClient()

  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to,   setTo]   = useState(today())
  const [showForm, setShowForm] = useState(false)
  const [showCharts, setShowCharts] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  // Data fetches
  const { data: purchases = [], isLoading, error } = useQuery({
    queryKey: ['pipe-purchases', outletId, from, to],
    queryFn: () => pipePurchasesApi.list(outletId!, from, to),
    enabled: !!outletId,
  })

  const { data: pipeConfigs = [] } = useQuery<any[]>({
    queryKey: ['pipe-configs-active'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 200 }).then((r: any) => r.data.data?.content ?? []),
    staleTime: 60_000,
  })

  const { data: vendors = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['vendors-all'],
    queryFn: () => vendorApi.getAll().then((r: any) => {
      const raw = r?.data?.data
      if (Array.isArray(raw)) return raw
      if (raw?.content && Array.isArray(raw.content)) return raw.content
      return []
    }),
    staleTime: 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => pipePurchasesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipe-purchases'] })
      toast.success('Purchase deleted and inventory reversed')
      setConfirmDelete(null)
    },
    onError: () => toast.error('Failed to delete purchase'),
  })

  // Summary stats
  const stats = useMemo(() => {
    const totalQty    = purchases.reduce((s, p) => s + p.quantity, 0)
    const totalAmount = purchases.reduce((s, p) => s + Number(p.totalAmount), 0)
    const pipeTypes   = new Set(purchases.map(p => p.pipeName)).size
    const vendors     = new Set(purchases.map(p => p.vendorName).filter(Boolean)).size
    return { count: purchases.length, totalQty, totalAmount, pipeTypes, vendors }
  }, [purchases])

  // Group by vendor for the summary panel
  const byVendor = useMemo(() => {
    const map: Record<string, { vendor: string; pipes: Record<string, { qty: number; amount: number }> }> = {}
    purchases.forEach(p => {
      const v = p.vendorName || '(Unknown Vendor)'
      if (!map[v]) map[v] = { vendor: v, pipes: {} }
      if (!map[v].pipes[p.pipeName]) map[v].pipes[p.pipeName] = { qty: 0, amount: 0 }
      map[v].pipes[p.pipeName].qty    += p.quantity
      map[v].pipes[p.pipeName].amount += Number(p.totalAmount)
    })
    return Object.values(map).sort((a, b) => a.vendor.localeCompare(b.vendor))
  }, [purchases])

  if (error) return (
    <div className="flex items-center gap-2 p-8 text-red-600">
      <AlertTriangle size={18} /> Failed to load pipe purchases
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Package size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Business · Purchases</p>
              <h1 className="text-xl font-extrabold tracking-tight">Third-Party Pipe Purchases</h1>
              <p className="text-blue-200 text-sm mt-0.5">Pipes purchased from external vendors — tracked separately, credited to inventory</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-50 transition shadow-sm"
            >
              <Plus size={16} /> Record Purchase
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="border-t border-white/15 grid grid-cols-5 divide-x divide-white/15">
          {[
            { label: 'Purchases',   value: stats.count,                              sub: 'entries' },
            { label: 'Total Qty',   value: `${stats.totalQty.toLocaleString()} pcs`, sub: 'pipes purchased' },
            { label: 'Total Value', value: `₹${fmtNum(stats.totalAmount)}`,          sub: 'incl. all vendors' },
            { label: 'Pipe Types',  value: stats.pipeTypes,                          sub: 'distinct types' },
            { label: 'Vendors',     value: stats.vendors,                            sub: 'unique vendors' },
          ].map(s => (
            <div key={s.label} className="px-6 py-3.5">
              <p className="text-lg font-extrabold text-white tabular-nums leading-none">{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-5">
        {purchases.length > 0 && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCharts(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-full bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600 transition font-medium"
            >
              <BarChart2 size={13} />{showCharts ? 'Hide Charts' : 'Show Charts'}
            </button>
          </div>
        )}

        {/* Charts */}
        {purchases.length > 0 && showCharts && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Qty by Vendor */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Qty by Vendor</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byVendor.map(v => ({ name: v.vendor, qty: Object.values(v.pipes).reduce((s, p) => s + p.qty, 0) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <RTooltip />
                    <Bar dataKey="qty" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Right: Qty by Pipe Type */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Qty by Pipe Type</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={Object.entries(purchases.reduce((acc, p) => { acc[p.pipeName] = (acc[p.pipeName] || 0) + p.quantity; return acc }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={85}
                    >
                      {Object.entries(purchases.reduce((acc, p) => { acc[p.pipeName] = (acc[p.pipeName] || 0) + p.quantity; return acc }, {} as Record<string, number>)).map(([_, __], i) => (
                        <Cell key={i} fill={['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'][i % 6]} />
                      ))}
                    </Pie>
                    <RTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <AddForm
            outletId={outletId!}
            pipeConfigs={pipeConfigs}
            vendors={vendors}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" /> Loading...
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No pipe purchases recorded in this period</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-blue-600 text-sm hover:underline">Record first purchase →</button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Main purchase table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-blue-100 flex items-center justify-between" style={{ background: 'linear-gradient(to right, #e5f0ff, #e7ecff)' }}>
                <h2 className="font-semibold text-gray-800 text-sm">Purchase Log</h2>
                <span className="text-xs text-gray-400">{purchases.length} entries</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'linear-gradient(to right, #eff6ff 0%, #eef2ff 100%)', borderBottom: '1px solid #dbeafe' }}>
                      {['Date', 'Vendor', 'Invoice No.', 'Pipe Type', 'Qty (pcs)', 'Unit Rate', 'Total Amount', 'Notes', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-700 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {purchases.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-medium">{fmtDate(p.purchaseDate)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{p.vendorName || '—'}</div>
                          {p.supplier && <div className="text-xs text-gray-400">#{p.supplier.id}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.invoiceNumber || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            <Package size={11} />{p.pipeName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{p.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-600">₹{fmtNum(p.unitRate)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">₹{fmtNum(p.totalAmount)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{p.notes || '—'}</td>
                        <td className="px-4 py-3">
                          {confirmDelete === p.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteMutation.mutate(p.id)}
                                disabled={deleteMutation.isPending}
                                className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                {deleteMutation.isPending ? '...' : 'Confirm'}
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(p.id)}
                              className="text-gray-400 hover:text-red-600 transition p-1 rounded"
                              title="Delete & reverse inventory"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* By Vendor breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-blue-100" style={{ background: 'linear-gradient(to right, #e5f0ff, #e7ecff)' }}>
                <h2 className="font-semibold text-gray-800 text-sm">Purchases by Vendor</h2>
                <p className="text-xs text-gray-500 mt-0.5">Which pipes were bought from which vendor and how many</p>
              </div>
              <div className="divide-y divide-gray-50">
                {byVendor.map(v => (
                  <div key={v.vendor} className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={14} className="text-blue-500" />
                      <span className="font-semibold text-gray-800 text-sm">{v.vendor}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 ml-5">
                      {Object.entries(v.pipes).map(([pipeName, info]) => (
                        <div key={pipeName} className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                          <div className="text-xs font-medium text-blue-800 flex items-center gap-1">
                            <Package size={11} />{pipeName}
                          </div>
                          <div className="text-gray-800 font-bold text-sm mt-0.5">{info.qty.toLocaleString()} pcs</div>
                          {info.amount > 0 && <div className="text-gray-500 text-xs">₹{fmtNum(info.amount)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
