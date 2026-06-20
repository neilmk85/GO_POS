import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { format, subDays, startOfMonth } from 'date-fns'
import { ArrowDownToLine, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, ArrowLeft, Calendar, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { siloExtractionsApi } from '@/services/businessApi'

type Unit = 'kg' | 'MT'

interface SiloExtractionEntry {
  id: number
  date: string
  silo1Value: string
  silo1Unit: string
  silo2Value: string
  silo2Unit: string
  silo3Value: string
  silo3Unit: string
  notes: string
}

function toKg(value: string, unit: string) {
  const n = parseFloat(value)
  if (isNaN(n) || !value) return 0
  return unit === 'MT' ? n * 1000 : n
}

function fmtDisplay(kg: number, unit: string) {
  if (kg === 0) return <span className="text-gray-200 text-xs italic">—</span>
  if (unit === 'MT') {
    const mt = kg / 1000
    return (
      <span className="inline-flex items-baseline gap-1">
        <span className="text-sm font-bold text-sky-700 tabular-nums">
          {mt.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
        </span>
        <span className="text-[11px] font-semibold text-sky-400">MT</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-sm font-bold text-sky-700 tabular-nums">
        {kg.toLocaleString('en-IN')}
      </span>
      <span className="text-[11px] font-semibold text-sky-400">kg</span>
    </span>
  )
}

function fmtTotalDisplay(kg: number, unit: string) {
  if (kg === 0) return '—'
  if (unit === 'MT') {
    return `${(kg / 1000).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} MT`
  }
  return `${kg.toLocaleString('en-IN')} kg`
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().slice(0, 10) }

const PRESETS = [
  { label: 'Today',      from: () => format(new Date(), 'yyyy-MM-dd'),              to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 7d',   from: () => format(subDays(new Date(), 6), 'yyyy-MM-dd'),   to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 30d',  from: () => format(subDays(new Date(), 29), 'yyyy-MM-dd'),  to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Month',from: () => format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
]

function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function CustomRangePicker({ fromDate, toDate, onChange }: {
  fromDate: string; toDate: string; onChange: (f: string, t: string) => void
}) {
  const [open, setOpen]       = useState(false)
  const [tmpFrom, setTmpFrom] = useState(fromDate)
  const [tmpTo,   setTmpTo]   = useState(toDate)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const presetActive = PRESETS.some(p => fromDate === p.from() && toDate === p.to())
  const customActive = !presetActive && !!(fromDate || toDate)

  function openPicker() { setTmpFrom(fromDate); setTmpTo(toDate); setOpen(true) }
  function apply()      { onChange(tmpFrom, tmpTo); setOpen(false) }
  function clear()      { setTmpFrom(''); setTmpTo(''); onChange('', ''); setOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPicker}
        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-xl border transition-colors ${
          customActive
            ? 'bg-white text-violet-700 border-white shadow-sm'
            : 'border-white/30 text-white/80 hover:text-white hover:bg-white/10'
        }`}
      >
        <Calendar size={11} />
        {customActive ? `${dmy(fromDate)} – ${dmy(toDate)}` : 'Custom'}
        {customActive
          ? <X size={10} className="ml-0.5 opacity-70 hover:opacity-100" onClick={e => { e.stopPropagation(); clear() }} />
          : <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-64">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Custom Range</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">From</label>
              <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To</label>
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={clear}
              className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Clear
            </button>
            <button onClick={apply} disabled={!tmpFrom && !tmpTo}
              className="flex-1 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 transition-all">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = {
  date:       todayStr(),
  silo1Value: '', silo1Unit: 'MT' as Unit,
  silo2Value: '', silo2Unit: 'MT' as Unit,
  silo3Value: '', silo3Unit: 'MT' as Unit,
  notes:      '',
}

// ─── Unit Toggle ──────────────────────────────────────────────────────────────
function UnitToggle({ value, onChange }: { value: Unit; onChange: (u: Unit) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
      {(['kg', 'MT'] as Unit[]).map(u => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
            value === u
              ? 'bg-sky-500 text-white'
              : 'bg-white text-gray-400 hover:bg-sky-50 hover:text-sky-600'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  )
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function EntryModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: SiloExtractionEntry
  onSave: (data: Omit<SiloExtractionEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(initial ? { ...initial } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const setField = (k: keyof typeof form, v: any) => {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'date') setErrors(prev => { const n = { ...prev }; delete n.date; return n })
    if (k === 'silo1Value' || k === 'silo2Value' || k === 'silo3Value') {
      setErrors(prev => { const n = { ...prev }; delete n.silos; return n })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.date) errs.date = 'Please select a date'
    if (!form.silo1Value && !form.silo2Value && !form.silo3Value) errs.silos = 'Enter extraction for at least one silo'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    setTimeout(() => { onSave({ ...form }); setSaving(false) }, 250)
  }

  const inputCls = 'flex-1 min-w-0 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition-colors'

  const silos: { label: string; valueKey: keyof typeof form; unitKey: keyof typeof form }[] = [
    { label: 'Silo 1', valueKey: 'silo1Value', unitKey: 'silo1Unit' },
    { label: 'Silo 2', valueKey: 'silo2Value', unitKey: 'silo2Unit' },
    { label: 'Silo 3', valueKey: 'silo3Value', unitKey: 'silo3Unit' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
              <ArrowDownToLine size={16} className="text-sky-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{initial ? 'Edit Entry' : 'Add Extraction Entry'}</h2>
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
            <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition-colors ${errors.date ? 'border-red-400' : 'border-gray-200'}`} />
            {errors.date && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.date}</p>}
          </div>

          {/* Silo inputs */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extraction Quantity</p>
            {errors.silos && <p className="flex items-center gap-1 text-xs text-red-500"><AlertTriangle size={11} /> {errors.silos}</p>}
            {silos.map(({ label, valueKey, unitKey }) => (
              <div key={label}>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={`Enter ${label} extraction…`}
                    value={form[valueKey] as string}
                    onChange={e => setField(valueKey, e.target.value)}
                    className={inputCls}
                  />
                  <UnitToggle
                    value={form[unitKey] as Unit}
                    onChange={u => setField(unitKey, u)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea rows={2} placeholder="Optional notes…" value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition-colors resize-none" />
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
function DeleteModal({ entry, onConfirm, onClose }: { entry: SiloExtractionEntry; onConfirm: () => void; onClose: () => void }) {
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
        <p className="text-sm text-gray-600">Delete the entry for <span className="font-semibold">{fmtDate(entry.date)}</span>?</p>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SiloExtractionPage() {
  const navigate = useNavigate()
  const [entries, setEntries]   = useState<SiloExtractionEntry[]>([])
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<SiloExtractionEntry | null>(null)
  const [deleting, setDeleting] = useState<SiloExtractionEntry | null>(null)
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [toDate,   setToDate]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [displayUnit, setDisplayUnit] = useState<Unit>('kg')

  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    siloExtractionsApi.list(fromDate || undefined, toDate || undefined)
      .then(setEntries)
      .catch(() => toast.error('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  const filtered = useMemo(() => entries, [entries])

  const totals = useMemo(() => ({
    silo1: filtered.reduce((s, e) => s + toKg(e.silo1Value, e.silo1Unit), 0),
    silo2: filtered.reduce((s, e) => s + toKg(e.silo2Value, e.silo2Unit), 0),
    silo3: filtered.reduce((s, e) => s + toKg(e.silo3Value, e.silo3Unit), 0),
  }), [filtered])

  const grandTotal = totals.silo1 + totals.silo2 + totals.silo3

  const handleAdd = async (data: Omit<SiloExtractionEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await siloExtractionsApi.create(data)
      setEntries(prev => [created, ...prev])
      setShowAdd(false)
      toast.success('Entry added')
    } catch { toast.error('Failed to add entry') }
  }
  const handleEdit = async (data: Omit<SiloExtractionEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const updated = await siloExtractionsApi.update(editing!.id, data)
      setEntries(prev => prev.map(e => e.id === editing!.id ? updated : e))
      setEditing(null)
      toast.success('Entry updated')
    } catch { toast.error('Failed to update entry') }
  }
  const handleDelete = async () => {
    try {
      await siloExtractionsApi.delete(deleting!.id)
      setEntries(prev => prev.filter(e => e.id !== deleting!.id))
      setDeleting(null)
      toast.success('Entry deleted')
    } catch { toast.error('Failed to delete entry') }
  }

  // silo colour config used in hero strip + table
  const siloColors = [
    { label: 'Silo 1', kg: totals.silo1, ring: 'ring-sky-400/60',  bg: 'bg-sky-500',   text: 'text-sky-700',   pill: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'   },
    { label: 'Silo 2', kg: totals.silo2, ring: 'ring-cyan-400/60', bg: 'bg-cyan-500',  text: 'text-cyan-700',  pill: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200'  },
    { label: 'Silo 3', kg: totals.silo3, ring: 'ring-blue-400/60', bg: 'bg-blue-500',  text: 'text-blue-700',  pill: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'  },
  ]

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

        {/* Title row */}
        <div className="relative px-8 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/business')}
              className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <ArrowDownToLine size={26} className="text-sky-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Business</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Silo Extraction</h1>
              {/* Subtitle + date filters inline */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-sm text-blue-200 whitespace-nowrap">Daily cement extraction from Silo 1, 2 &amp; 3</p>
                <div className="w-px h-4 bg-white/20 shrink-0 hidden sm:block" />
                {PRESETS.map(p => {
                  const pFrom = p.from(), pTo = p.to()
                  const active = fromDate === pFrom && toDate === pTo
                  return (
                    <button key={p.label} onClick={() => { setFromDate(pFrom); setToDate(pTo) }}
                      className={`px-3 py-1 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-white text-violet-700 border-white shadow-sm'
                          : 'border-white/30 text-white/80 hover:text-white hover:bg-white/10'
                      }`}>
                      {p.label}
                    </button>
                  )
                })}
                <CustomRangePicker
                  fromDate={fromDate} toDate={toDate}
                  onChange={(f, t) => { setFromDate(f); setToDate(t) }}
                />
              </div>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shrink-0 mt-1">
            <Plus size={15} /> Add Entry
          </button>
        </div>

        {/* Stat strip — silo totals + grand total + unit toggle */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          {siloColors.map(s => (
            <div key={s.label} className="px-6 py-4">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`w-2 h-2 rounded-full ${s.bg} shrink-0`} />
                <p className="text-xl font-extrabold text-white tabular-nums leading-none">
                  {loading ? '—' : fmtTotalDisplay(s.kg, displayUnit)}
                </p>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">{s.label} Total</p>
            </div>
          ))}
          <div className="px-6 py-4">
            <p className="text-xl font-extrabold text-white tabular-nums leading-none mb-0.5">
              {loading ? '—' : fmtTotalDisplay(grandTotal, displayUnit)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-blue-200">Grand Total</p>
              {/* Unit toggle inline in stat strip */}
              <div className="flex items-center bg-white/10 rounded-lg overflow-hidden border border-white/20 ml-auto">
                {(['kg', 'MT'] as Unit[]).map(u => (
                  <button key={u} onClick={() => setDisplayUnit(u)}
                    className={`px-2 py-0.5 text-[10px] font-bold transition-colors ${
                      displayUnit === u ? 'bg-white text-sky-700' : 'text-white/60 hover:text-white'
                    }`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(14,165,233,0.10),0_1.5px_6px_rgba(0,0,0,0.07)] ring-1 ring-sky-100">

        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-sky-600 to-blue-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowDownToLine size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Extraction Records</h2>
              <p className="text-xs text-sky-100 mt-0.5">{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'} · values in {displayUnit}</p>
            </div>
          </div>
          {/* Silo legend */}
          <div className="flex items-center gap-3">
            {siloColors.map(s => (
              <span key={s.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.bg}`} />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3 text-left   text-[11px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold text-sky-500  uppercase tracking-widest">Silo 1</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold text-cyan-500 uppercase tracking-widest">Silo 2</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold text-blue-500 uppercase tracking-widest">Silo 3</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total</th>
              <th className="px-5 py-3 text-left   text-[11px] font-bold text-slate-500 uppercase tracking-widest">Notes</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <Loader2 size={28} className="text-sky-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Loading entries…</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <ArrowDownToLine size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">No entries yet</p>
                  <p className="text-xs text-gray-300 mt-1">Click "Add Entry" to record silo extraction</p>
                </td>
              </tr>
            ) : (
              filtered.map((entry, idx) => {
                const kg1 = toKg(entry.silo1Value, entry.silo1Unit)
                const kg2 = toKg(entry.silo2Value, entry.silo2Unit)
                const kg3 = toKg(entry.silo3Value, entry.silo3Unit)
                const rowTotal = kg1 + kg2 + kg3
                return (
                  <tr key={entry.id} className={`hover:bg-sky-50/30 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-gray-800">{fmtDate(entry.date)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">{fmtDisplay(kg1, displayUnit)}</td>
                    <td className="px-5 py-3.5 text-center">{fmtDisplay(kg2, displayUnit)}</td>
                    <td className="px-5 py-3.5 text-center">{fmtDisplay(kg3, displayUnit)}</td>
                    <td className="px-5 py-3.5 text-center">
                      {rowTotal > 0
                        ? <span className="inline-flex items-baseline gap-1">
                            <span className="text-sm font-bold text-violet-700 tabular-nums">
                              {displayUnit === 'MT'
                                ? (rowTotal / 1000).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
                                : rowTotal.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[11px] font-semibold text-violet-400">{displayUnit}</span>
                          </span>
                        : <span className="text-gray-200 text-xs italic">—</span>
                      }
                    </td>
                    <td className="px-5 py-3.5 max-w-[180px]">
                      <span className="text-sm text-gray-500 truncate block">{entry.notes || <span className="text-gray-200 italic">—</span>}</span>
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
                )
              })
            )}
          </tbody>

          {!loading && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-sky-100 bg-sky-50/40">
                <td className="px-5 py-3.5 text-xs font-extrabold text-slate-500 uppercase tracking-widest">Total</td>
                {siloColors.map(s => (
                  <td key={s.label} className="px-5 py-3.5 text-center">
                    <span className={`text-sm font-bold tabular-nums ${s.text}`}>{fmtTotalDisplay(s.kg, displayUnit)}</span>
                  </td>
                ))}
                <td className="px-5 py-3.5 text-center">
                  <span className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-500 tabular-nums">
                    {fmtTotalDisplay(grandTotal, displayUnit)}
                  </span>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showAdd  && <EntryModal onSave={handleAdd}  onClose={() => setShowAdd(false)} />}
      {editing  && <EntryModal initial={editing}   onSave={handleEdit} onClose={() => setEditing(null)} />}
      {deleting && <DeleteModal entry={deleting}   onConfirm={handleDelete} onClose={() => setDeleting(null)} />}
    </div>
  )
}
