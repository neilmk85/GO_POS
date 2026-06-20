import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { format, subDays, startOfMonth } from 'date-fns'
import { Truck, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, ArrowLeft, Calendar, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { vehiclesApi, type VehicleEntry } from '@/services/businessApi'

function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
const EMPTY_FORM = {
  date:         todayStr(),
  craneEnabled: false,
  craneDiesel:  '',
  craneHours:   '',
  jcbEnabled:   false,
  jcbDiesel:    '',
  jcbHours:     '',
  notes:        '',
}

function EntryModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: VehicleEntry
  onSave: (entry: Omit<VehicleEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(
    initial
      ? { date: initial.date, craneEnabled: initial.craneEnabled, craneDiesel: initial.craneDiesel, craneHours: initial.craneHours, jcbEnabled: initial.jcbEnabled, jcbDiesel: initial.jcbDiesel, jcbHours: initial.jcbHours, notes: initial.notes }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const setField = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.date) errs.date = 'Please select a date'
    if (!form.craneEnabled && !form.jcbEnabled) errs.vehicle = 'Select at least one vehicle (Crane or JCB)'
    if (form.craneEnabled && !form.craneDiesel) errs.craneDiesel = 'Diesel (L) required'
    if (form.craneEnabled && !form.craneHours)  errs.craneHours  = 'Hours required'
    if (form.jcbEnabled   && !form.jcbDiesel)   errs.jcbDiesel   = 'Diesel (L) required'
    if (form.jcbEnabled   && !form.jcbHours)    errs.jcbHours    = 'Hours required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    onSave({ ...form })
    setSaving(false)
  }

  const inputCls = (disabled: boolean, err?: boolean) =>
    `w-full px-3 py-2 text-sm border rounded-xl focus:outline-none transition-colors ${
      disabled
        ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
        : err
          ? 'border-red-400 focus:ring-2 focus:ring-red-400/30 bg-red-50/20'
          : 'border-gray-200 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Truck size={16} className="text-orange-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{initial ? 'Edit Entry' : 'Add Vehicle Entry'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.date}
              onChange={e => { setField('date', e.target.value); setErrors(prev => { const n = {...prev}; delete n.date; return n }) }}
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${errors.date ? 'border-red-400 focus:ring-red-400/30 bg-red-50/20' : 'border-gray-200 focus:ring-violet-500/30 focus:border-violet-400'}`} />
            {errors.date && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.date}</p>}
          </div>

          {/* ── Crane ── */}
          <div className={`rounded-xl border-2 p-4 transition-colors ${form.craneEnabled ? 'border-orange-300 bg-orange-50/30' : 'border-gray-100 bg-gray-50/40'}`}>
            <label className="flex items-center gap-2.5 cursor-pointer mb-4 select-none">
              <div
                onClick={() => { setField('craneEnabled', !form.craneEnabled); setErrors(prev => { const n = {...prev}; delete n.vehicle; delete n.craneDiesel; delete n.craneHours; return n }) }}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  form.craneEnabled ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'
                }`}
              >
                {form.craneEnabled && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-bold text-gray-800">Crane</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${form.craneEnabled ? 'text-gray-600' : 'text-gray-300'}`}>
                  Diesel (Litres)
                </label>
                <input
                  type="number" min="0" step="0.1" placeholder="e.g. 25"
                  disabled={!form.craneEnabled}
                  value={form.craneDiesel}
                  onChange={e => { setField('craneDiesel', e.target.value); setErrors(prev => { const n = {...prev}; delete n.craneDiesel; return n }) }}
                  className={inputCls(!form.craneEnabled, !!errors.craneDiesel)}
                />
                {errors.craneDiesel && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.craneDiesel}</p>}
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${form.craneEnabled ? 'text-gray-600' : 'text-gray-300'}`}>
                  Daily Hours
                </label>
                <input
                  type="number" min="0" step="0.5" placeholder="e.g. 8"
                  disabled={!form.craneEnabled}
                  value={form.craneHours}
                  onChange={e => { setField('craneHours', e.target.value); setErrors(prev => { const n = {...prev}; delete n.craneHours; return n }) }}
                  className={inputCls(!form.craneEnabled, !!errors.craneHours)}
                />
                {errors.craneHours && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.craneHours}</p>}
              </div>
            </div>
          </div>

          {errors.vehicle && <p className="flex items-center gap-1 text-xs text-red-500 -mt-2"><AlertTriangle size={11} /> {errors.vehicle}</p>}

          {/* ── JCB ── */}
          <div className={`rounded-xl border-2 p-4 transition-colors ${form.jcbEnabled ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100 bg-gray-50/40'}`}>
            <label className="flex items-center gap-2.5 cursor-pointer mb-4 select-none">
              <div
                onClick={() => { setField('jcbEnabled', !form.jcbEnabled); setErrors(prev => { const n = {...prev}; delete n.vehicle; delete n.jcbDiesel; delete n.jcbHours; return n }) }}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  form.jcbEnabled ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
                }`}
              >
                {form.jcbEnabled && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-bold text-gray-800">JCB</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${form.jcbEnabled ? 'text-gray-600' : 'text-gray-300'}`}>
                  Diesel (Litres)
                </label>
                <input
                  type="number" min="0" step="0.1" placeholder="e.g. 20"
                  disabled={!form.jcbEnabled}
                  value={form.jcbDiesel}
                  onChange={e => { setField('jcbDiesel', e.target.value); setErrors(prev => { const n = {...prev}; delete n.jcbDiesel; return n }) }}
                  className={inputCls(!form.jcbEnabled, !!errors.jcbDiesel)}
                />
                {errors.jcbDiesel && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.jcbDiesel}</p>}
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${form.jcbEnabled ? 'text-gray-600' : 'text-gray-300'}`}>
                  Daily Hours
                </label>
                <input
                  type="number" min="0" step="0.5" placeholder="e.g. 6"
                  disabled={!form.jcbEnabled}
                  value={form.jcbHours}
                  onChange={e => { setField('jcbHours', e.target.value); setErrors(prev => { const n = {...prev}; delete n.jcbHours; return n }) }}
                  className={inputCls(!form.jcbEnabled, !!errors.jcbHours)}
                />
                {errors.jcbHours && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.jcbHours}</p>}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea rows={3} placeholder="Optional notes…" value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors resize-none" />
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
function DeleteModal({ entry, onConfirm, onClose }: { entry: VehicleEntry; onConfirm: () => void; onClose: () => void }) {
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
          Delete the entry for <span className="font-semibold">{fmtDate(entry.date)}</span>?
        </p>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Value pill ───────────────────────────────────────────────────────────────
function Pill({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>{label}</span>
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VehiclesPage() {
  const navigate = useNavigate()
  const [entries, setEntries]   = useState<VehicleEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<VehicleEntry | null>(null)
  const [deleting, setDeleting] = useState<VehicleEntry | null>(null)
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [toDate,   setToDate]   = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    setLoading(true)
    vehiclesApi.list(fromDate || undefined, toDate || undefined)
      .then(setEntries)
      .catch(() => toast.error('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  const filtered = useMemo(() => entries, [entries])

  const handleAdd = async (data: Omit<VehicleEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await vehiclesApi.create(data)
      setEntries(prev => [created, ...prev])
      setShowAdd(false)
      toast.success('Entry added')
    } catch { toast.error('Failed to add entry') }
  }
  const handleEdit = async (data: Omit<VehicleEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const updated = await vehiclesApi.update(editing!.id, data)
      setEntries(prev => prev.map(e => e.id === editing!.id ? updated : e))
      setEditing(null)
      toast.success('Entry updated')
    } catch { toast.error('Failed to update entry') }
  }
  const handleDelete = async () => {
    try {
      await vehiclesApi.delete(deleting!.id)
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
              <Truck size={26} className="text-orange-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Business</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Vehicles</h1>
              {/* Subtitle + date filters inline */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-sm text-blue-200 whitespace-nowrap">Daily crane &amp; JCB diesel usage and operating hours</p>
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-600 to-blue-600">
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Date</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Crane Diesel (L)</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Crane Hours</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">JCB Diesel (L)</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">JCB Hours</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Notes</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <Loader2 size={28} className="text-violet-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Loading entries…</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <Truck size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">No entries yet</p>
                  <p className="text-xs text-gray-300 mt-1">Click "Add Entry" to get started</p>
                </td>
              </tr>
            ) : (
              filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-orange-50/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium text-gray-800">{fmtDate(entry.date)}</span>
                  </td>

                  {/* Crane Diesel */}
                  <td className="px-5 py-3.5 text-center">
                    {entry.craneEnabled
                      ? <Pill label={`${entry.craneDiesel} L`} color="bg-orange-50 text-orange-700" />
                      : <span className="text-gray-200 text-xs">—</span>}
                  </td>

                  {/* Crane Hours */}
                  <td className="px-5 py-3.5 text-center">
                    {entry.craneEnabled
                      ? <Pill label={`${entry.craneHours} hrs`} color="bg-orange-50 text-orange-700" />
                      : <span className="text-gray-200 text-xs">—</span>}
                  </td>

                  {/* JCB Diesel */}
                  <td className="px-5 py-3.5 text-center">
                    {entry.jcbEnabled
                      ? <Pill label={`${entry.jcbDiesel} L`} color="bg-blue-50 text-blue-700" />
                      : <span className="text-gray-200 text-xs">—</span>}
                  </td>

                  {/* JCB Hours */}
                  <td className="px-5 py-3.5 text-center">
                    {entry.jcbEnabled
                      ? <Pill label={`${entry.jcbHours} hrs`} color="bg-blue-50 text-blue-700" />
                      : <span className="text-gray-200 text-xs">—</span>}
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
        </table>
      </div>

      {/* Modals */}
      {showAdd  && <EntryModal onSave={handleAdd}  onClose={() => setShowAdd(false)} />}
      {editing  && <EntryModal initial={editing}   onSave={handleEdit} onClose={() => setEditing(null)} />}
      {deleting && <DeleteModal entry={deleting}   onConfirm={handleDelete} onClose={() => setDeleting(null)} />}
    </div>
  )
}
