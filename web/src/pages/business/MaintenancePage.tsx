import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wrench, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, ChevronDown, ArrowLeft, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { vendorApi } from '@/services/api'
import { maintenanceApi, type MaintenanceEntry } from '@/services/businessApi'

const PRODUCTION_PROCESSES = [
  'Fabrication',
  'Fabrication Testing',
  'Moulding',
  'Spinning',
  'Demoulding',
  'Curing 1',
  'Winding',
  'Coating',
  'Final Testing',
  'General / Other',
]

function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().slice(0, 10) }
function fmtAmount(v: string) {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  const [preset, setPreset]         = useState<PresetKey | ''>('')
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

const EMPTY_FORM = {
  date:    todayStr(),
  process: '',
  vendor:  '',
  amount:  '',
  notes:   '',
}

// ─── Vendor Autocomplete ──────────────────────────────────────────────────────
function VendorAutocomplete({
  value,
  onChange,
  suggestions,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
}) {
  const [open, setOpen]     = useState(false)
  const [cursor, setCursor] = useState(-1)
  const inputRef            = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return suggestions
    return suggestions.filter(s => s.toLowerCase().includes(q))
  }, [value, suggestions])

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setCursor(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown') { setOpen(true); setCursor(0); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') { setCursor(c => Math.min(c + 1, filtered.length - 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')   { setCursor(c => Math.max(c - 1, 0));                   e.preventDefault() }
    if (e.key === 'Enter' && cursor >= 0) { pick(filtered[cursor]); e.preventDefault() }
    if (e.key === 'Escape')    { setOpen(false); setCursor(-1) }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder="Type or select vendor…"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setCursor(-1) }}
        onFocus={() => setOpen(true)}
        // mousedown on a list item fires before blur; the 150ms gap lets pick() run first
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors"
      />

      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
          style={{ zIndex: 9999 }}>
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={e => { e.preventDefault(); pick(s) }}
              onMouseEnter={() => setCursor(i)}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                i === cursor
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white'
                  : 'text-gray-700 hover:bg-violet-50 hover:text-violet-700'
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function EntryModal({
  initial,
  onSave,
  onClose,
  vendorSuggestions,
}: {
  initial?: MaintenanceEntry
  onSave: (data: Omit<MaintenanceEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
  vendorSuggestions: string[]
}) {
  const [form, setForm] = useState(
    initial
      ? { date: initial.date, process: initial.process, vendor: initial.vendor, amount: initial.amount, notes: initial.notes }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [k]: e.target.value }))
      setErrors(prev => { const n = {...prev}; delete n[k]; return n })
    }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.date) errs.date = 'Please select a date'
    if (!form.process) errs.process = 'Please select a production process'
    if (!form.vendor.trim()) errs.vendor = 'Please enter a vendor name'
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) < 0)
      errs.amount = 'Please enter a valid amount (≥ 0)'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    onSave({ ...form, vendor: form.vendor.trim(), notes: form.notes.trim() })
    setSaving(false)
  }

  const inputCls = (err?: boolean) =>
    `w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
      err ? 'border-red-400 focus:ring-red-400/30 bg-red-50/20' : 'border-gray-200 focus:ring-violet-500/30 focus:border-violet-400'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Wrench size={16} className="text-amber-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{initial ? 'Edit Entry' : 'Add Maintenance Entry'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Date <span className="text-red-500">*</span>
            </label>
            <input type="date" value={form.date} onChange={set('date')} className={inputCls(!!errors.date)} />
            {errors.date && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.date}</p>}
          </div>

          {/* Production Process dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Production Process <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={form.process}
                onChange={set('process')}
                className={`${inputCls(!!errors.process)} appearance-none pr-9 ${!form.process ? 'text-gray-400' : 'text-gray-800'}`}
              >
                <option value="" disabled>Select a process…</option>
                {PRODUCTION_PROCESSES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {errors.process && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.process}</p>}
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Vendor <span className="text-red-500">*</span>
            </label>
            <div className={errors.vendor ? 'ring-1 ring-red-400 rounded-xl' : ''}>
              <VendorAutocomplete
                value={form.vendor}
                onChange={v => { setForm(f => ({ ...f, vendor: v })); setErrors(prev => { const n = {...prev}; delete n.vendor; return n }) }}
                suggestions={vendorSuggestions}
              />
            </div>
            {errors.vendor && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.vendor}</p>}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 5000"
              value={form.amount}
              onChange={set('amount')}
              className={inputCls(!!errors.amount)}
            />
            {errors.amount && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.amount}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea
              rows={3}
              placeholder="Optional notes…"
              value={form.notes}
              onChange={set('notes')}
              className={`${inputCls()} resize-none`}
            />
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 transition-all disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {initial ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteModal({ entry, onConfirm, onClose }: { entry: MaintenanceEntry; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Delete Entry</h3>
            <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Delete the entry for <span className="font-semibold">{fmtDate(entry.date)}</span> — <span className="font-semibold">{entry.process}</span>?
        </p>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const navigate = useNavigate()
  const [entries, setEntries]   = useState<MaintenanceEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<MaintenanceEntry | null>(null)
  const [deleting, setDeleting] = useState<MaintenanceEntry | null>(null)
  const [fromDate, setFromDate] = useState(isoDate(startOf('month')))
  const [toDate,   setToDate]   = useState(isoDate(new Date()))

  useEffect(() => {
    setLoading(true)
    maintenanceApi.list(fromDate || undefined, toDate || undefined)
      .then(setEntries)
      .catch(() => toast.error('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  const filtered = useMemo(() => entries, [entries])

  const totalAmount = filtered.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)

  // Fetch vendors from the purchases vendor API
  const { data: apiVendors = [] } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: () => vendorApi.getAll().then(r => {
      const d = r.data.data
      const list = Array.isArray(d) ? d : (d?.content ?? d?.items ?? [])
      return (list as any[]).map((v: any) => v.name as string).filter(Boolean)
    }),
    staleTime: 5 * 60 * 1000,
  })

  // Merge API vendors + vendors typed in previous entries, deduplicated & sorted
  const vendorSuggestions = useMemo(() => {
    const localNames = entries.map(e => e.vendor).filter(Boolean)
    return [...new Set([...apiVendors, ...localNames])].sort((a, b) => a.localeCompare(b))
  }, [apiVendors, entries])

  const handleAdd = async (data: Omit<MaintenanceEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await maintenanceApi.create(data)
      setEntries(prev => [created, ...prev])
      setShowAdd(false)
      toast.success('Entry added')
    } catch { toast.error('Failed to add entry') }
  }
  const handleEdit = async (data: Omit<MaintenanceEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const updated = await maintenanceApi.update(editing!.id, data)
      setEntries(prev => prev.map(e => e.id === editing!.id ? updated : e))
      setEditing(null)
      toast.success('Entry updated')
    } catch { toast.error('Failed to update entry') }
  }
  const handleDelete = async () => {
    try {
      await maintenanceApi.delete(deleting!.id)
      setEntries(prev => prev.filter(e => e.id !== deleting!.id))
      setDeleting(null)
      toast.success('Entry deleted')
    } catch { toast.error('Failed to delete entry') }
  }

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero header ── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.28)]">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/3 w-72 h-32 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Content */}
        <div className="relative px-8 pt-6 pb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/business')}
              className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <Wrench size={26} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Business</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Maintenance</h1>
              {/* Subtitle + date filters inline */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-sm text-blue-200 whitespace-nowrap">Equipment &amp; process maintenance costs by vendor</p>
                <DateRangePicker fromDate={fromDate} toDate={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
              </div>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shrink-0 mt-1">
            <Plus size={15} /> Add Maintenance
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-600 to-blue-600">
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Date</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Production Process</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Vendor</th>
              <th className="px-5 py-4 text-right  text-xs font-bold text-white uppercase tracking-wider">Amount</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Notes</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <Loader2 size={28} className="text-violet-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Loading entries…</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <Wrench size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">No entries yet</p>
                  <p className="text-xs text-gray-300 mt-1">Click "Add Maintenance" to get started</p>
                </td>
              </tr>
            ) : (
              filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium text-gray-800">{fmtDate(entry.date)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                      {entry.process}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium text-gray-700">{entry.vendor}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-bold text-emerald-700 tabular-nums">{fmtAmount(entry.amount)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-gray-500">{entry.notes || <span className="text-gray-200 italic">—</span>}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => setEditing(entry)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-violet-50 hover:text-violet-600 transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleting(entry)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-100">
                <td colSpan={3} className="px-5 py-3.5 text-xs font-extrabold text-violet-600 uppercase tracking-widest">Total</td>
                <td className="px-5 py-3.5 text-right">
                  <span className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-500">
                    ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Modals */}
      {showAdd  && <EntryModal onSave={handleAdd}  onClose={() => setShowAdd(false)} vendorSuggestions={vendorSuggestions} />}
      {editing  && <EntryModal initial={editing}   onSave={handleEdit} onClose={() => setEditing(null)} vendorSuggestions={vendorSuggestions} />}
      {deleting && <DeleteModal entry={deleting}   onConfirm={handleDelete} onClose={() => setDeleting(null)} />}
    </div>
  )
}
