import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { FlaskConical, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, CheckCircle2, MinusCircle, ArrowLeft, Calendar, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { testingLabsApi } from '@/services/businessApi'
import type { TestingLabEntry as ApiTestingLabEntry } from '@/services/businessApi'

// ─── Types ────────────────────────────────────────────────────────────────────
interface CompressiveStrength {
  enabled: boolean
  day7:    string
  day28:   string
}

interface TestItem {
  enabled: boolean
  notes:   string
}

// Local UI type (nested structure)
interface TestingLabEntry {
  id?:                  number
  date:                 string
  compressiveStrength:  CompressiveStrength
  pressurePermeability: TestItem
  normalPermeability:   TestItem
  boilingTest:          TestItem
}

// Transform API flat → local nested
function fromApiEntry(e: ApiTestingLabEntry): TestingLabEntry & { id: number } {
  return {
    id:   e.id,
    date: e.date,
    compressiveStrength:  { enabled: e.csEnabled, day7: e.csDay7,  day28: e.csDay28 },
    pressurePermeability: { enabled: e.ppEnabled, notes: e.ppNotes },
    normalPermeability:   { enabled: e.npEnabled, notes: e.npNotes },
    boilingTest:          { enabled: e.btEnabled, notes: e.btNotes },
  }
}

// Transform local nested → API flat
function toApiData(data: Omit<TestingLabEntry, 'id'>): Omit<ApiTestingLabEntry, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    date:      data.date,
    csEnabled: data.compressiveStrength.enabled,
    csDay7:    data.compressiveStrength.day7,
    csDay28:   data.compressiveStrength.day28,
    ppEnabled: data.pressurePermeability.enabled,
    ppNotes:   data.pressurePermeability.notes,
    npEnabled: data.normalPermeability.enabled,
    npNotes:   data.normalPermeability.notes,
    btEnabled: data.boilingTest.enabled,
    btNotes:   data.boilingTest.notes,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyEntry(): Omit<TestingLabEntry, 'id'> {
  return {
    date: new Date().toISOString().slice(0, 10),
    compressiveStrength:  { enabled: false, day7: '', day28: '' },
    pressurePermeability: { enabled: false, notes: '' },
    normalPermeability:   { enabled: false, notes: '' },
    boilingTest:          { enabled: false, notes: '' },
  }
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function Checkbox({ checked, onChange, color = 'cyan' }: { checked: boolean; onChange: () => void; color?: string }) {
  const active   = color === 'cyan'    ? 'bg-cyan-500 border-cyan-500'    : 'bg-cyan-500 border-cyan-500'
  const inactive = 'border-gray-300 bg-white hover:border-cyan-400'
  return (
    <div
      onClick={onChange}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${checked ? active : inactive}`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  )
}

// ─── N/mm² Input ──────────────────────────────────────────────────────────────
function NmmInput({ value, onChange, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; placeholder: string; disabled: boolean
}) {
  return (
    <div className={`flex items-center border rounded-xl overflow-hidden transition-colors ${disabled ? 'border-gray-100 bg-gray-50' : 'border-gray-200 focus-within:ring-2 focus-within:ring-cyan-500/30 focus-within:border-cyan-400'}`}>
      <input
        type="number" min="0" step="0.01"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className={`flex-1 min-w-0 px-3 py-2.5 text-sm focus:outline-none bg-transparent ${disabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-800'}`}
      />
      <span className={`px-2.5 text-xs font-semibold shrink-0 ${disabled ? 'text-gray-200' : 'text-cyan-600'}`}>N/mm²</span>
    </div>
  )
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function EntryModal({ initial, onSave, onClose }: {
  initial?: TestingLabEntry
  onSave: (data: Omit<TestingLabEntry, 'id'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Omit<TestingLabEntry, 'id'>>(
    initial ? { ...initial } : emptyEntry()
  )
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const setCS   = (k: keyof CompressiveStrength, v: any) =>
    setForm(f => ({ ...f, compressiveStrength: { ...f.compressiveStrength, [k]: v } }))
  const setTest = (key: 'pressurePermeability' | 'normalPermeability' | 'boilingTest', k: keyof TestItem, v: any) =>
    setForm(f => ({ ...f, [key]: { ...f[key], [k]: v } }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.date) errs.date = 'Please select a date'
    const any = form.compressiveStrength.enabled || form.pressurePermeability.enabled ||
                form.normalPermeability.enabled  || form.boilingTest.enabled
    if (!any) errs.tests = 'Please select at least one test'
    if (form.compressiveStrength.enabled && !form.compressiveStrength.day7 && !form.compressiveStrength.day28)
      errs.csValues = 'Enter at least one value (Day 7 or Day 28)'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    setTimeout(() => { onSave({ ...form }); setSaving(false) }, 250)
  }

  const notesInputCls = (disabled: boolean) =>
    `w-full px-3 py-2 text-sm border rounded-xl focus:outline-none transition-colors resize-none ${
      disabled ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
               : 'border-gray-200 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400'
    }`

  const tests: { key: 'pressurePermeability' | 'normalPermeability' | 'boilingTest'; label: string }[] = [
    { key: 'pressurePermeability', label: 'Pressure Permeability' },
    { key: 'normalPermeability',   label: 'Normal Permeability'   },
    { key: 'boilingTest',          label: 'Boiling Test'          },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
              <FlaskConical size={16} className="text-cyan-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{initial ? 'Edit Entry' : 'Add Test Entry'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.date}
                onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setErrors(prev => { const n = {...prev}; delete n.date; return n }) }}
                className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${errors.date ? 'border-red-400 focus:ring-red-400/30 bg-red-50/20' : 'border-gray-200 focus:ring-cyan-500/30 focus:border-cyan-400'}`} />
              {errors.date && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.date}</p>}
            </div>

            {errors.tests && <p className="flex items-center gap-1 text-xs text-red-500"><AlertTriangle size={11} /> {errors.tests}</p>}

            {/* ── Compressive Strength ── */}
            <div className={`rounded-2xl border p-4 transition-all ${form.compressiveStrength.enabled ? 'border-cyan-200 bg-cyan-50/30' : 'border-gray-100 bg-gray-50/40'}`}>
              <div className="flex items-center gap-3 mb-3">
                <Checkbox
                  checked={form.compressiveStrength.enabled}
                  onChange={() => { setCS('enabled', !form.compressiveStrength.enabled); setErrors(prev => { const n = {...prev}; delete n.tests; delete n.csValues; return n }) }}
                />
                <span className={`text-sm font-semibold ${form.compressiveStrength.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                  Compressive Strength
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 pl-8">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${form.compressiveStrength.enabled ? 'text-gray-600' : 'text-gray-300'}`}>Day 7</label>
                  <NmmInput
                    value={form.compressiveStrength.day7}
                    onChange={v => { setCS('day7', v); setErrors(prev => { const n = {...prev}; delete n.csValues; return n }) }}
                    placeholder="0.00"
                    disabled={!form.compressiveStrength.enabled}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${form.compressiveStrength.enabled ? 'text-gray-600' : 'text-gray-300'}`}>Day 28</label>
                  <NmmInput
                    value={form.compressiveStrength.day28}
                    onChange={v => { setCS('day28', v); setErrors(prev => { const n = {...prev}; delete n.csValues; return n }) }}
                    placeholder="0.00"
                    disabled={!form.compressiveStrength.enabled}
                  />
                </div>
              </div>
              {errors.csValues && <p className="flex items-center gap-1 mt-2 text-xs text-red-500 pl-8"><AlertTriangle size={11} /> {errors.csValues}</p>}
            </div>

            {/* ── Other tests ── */}
            {tests.map(({ key, label }) => {
              const item = form[key] as TestItem
              return (
                <div key={key} className={`rounded-2xl border p-4 transition-all ${item.enabled ? 'border-cyan-200 bg-cyan-50/30' : 'border-gray-100 bg-gray-50/40'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <Checkbox
                      checked={item.enabled}
                      onChange={() => { setTest(key, 'enabled', !item.enabled); setErrors(prev => { const n = {...prev}; delete n.tests; return n }) }}
                    />
                    <span className={`text-sm font-semibold ${item.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
                  </div>
                  <div className="pl-8">
                    <textarea
                      rows={2}
                      placeholder="Notes…"
                      value={item.notes}
                      disabled={!item.enabled}
                      onChange={e => setTest(key, 'notes', e.target.value)}
                      className={notesInputCls(!item.enabled)}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-2.5">
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
function DeleteModal({ entry, onConfirm, onClose }: { entry: TestingLabEntry; onConfirm: () => void; onClose: () => void }) {
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

// ─── Status Cell ──────────────────────────────────────────────────────────────
function StatusCell({ enabled, notes }: { enabled: boolean; notes: string }) {
  if (!enabled) return <MinusCircle size={15} className="text-gray-200 mx-auto" />
  return (
    <div className="flex flex-col items-center gap-1">
      <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
      {notes && <span className="text-[11px] text-gray-400 text-center leading-tight max-w-[120px]">{notes}</span>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TestingLabPage() {
  const navigate = useNavigate()
  const [entries, setEntries]   = useState<TestingLabEntry[]>([])
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<TestingLabEntry | null>(null)
  const [deleting, setDeleting] = useState<TestingLabEntry | null>(null)
  const [fromDate, setFromDate] = useState(isoDate(startOf('month')))
  const [toDate,   setToDate]   = useState(isoDate(new Date()))

  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    testingLabsApi.list(fromDate || undefined, toDate || undefined)
      .then(data => setEntries(data.map(fromApiEntry)))
      .catch(() => toast.error('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  const filtered = useMemo(() => entries, [entries])

  const handleAdd = async (data: Omit<TestingLabEntry, 'id'>) => {
    try {
      const created = await testingLabsApi.create(toApiData(data))
      setEntries(prev => [fromApiEntry(created), ...prev])
      setShowAdd(false)
      toast.success('Entry added')
    } catch { toast.error('Failed to add entry') }
  }
  const handleEdit = async (data: Omit<TestingLabEntry, 'id'>) => {
    try {
      const updated = await testingLabsApi.update(editing!.id!, toApiData(data))
      setEntries(prev => prev.map(e => e.id === editing!.id ? fromApiEntry(updated) : e))
      setEditing(null)
      toast.success('Entry updated')
    } catch { toast.error('Failed to update entry') }
  }
  const handleDelete = async () => {
    try {
      await testingLabsApi.delete(deleting!.id!)
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
              <FlaskConical size={26} className="text-cyan-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Business</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Testing Lab</h1>
              {/* Subtitle + date filters inline */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-sm text-blue-200 whitespace-nowrap">Quality test records — compressive strength &amp; permeability</p>
                <div className="w-px h-4 bg-white/20 shrink-0 hidden sm:block" />
                <DateRangePicker fromDate={fromDate} toDate={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
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
      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(6,182,212,0.10), 0 1.5px 6px rgba(0,0,0,0.07)' }}>
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-600 to-blue-600">
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Date</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                <div>Compressive Strength</div>
                <div className="text-[10px] font-medium opacity-80 mt-0.5">Day 7 / Day 28 (N/mm²)</div>
              </th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Pressure<br/>Permeability</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Normal<br/>Permeability</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Boiling<br/>Test</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <FlaskConical size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">{entries.length === 0 ? 'No entries yet' : 'No entries for selected date range'}</p>
                  <p className="text-xs text-gray-300 mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started' : 'Try adjusting the date filter'}</p>
                </td>
              </tr>
            ) : (
              filtered.map(entry => {
                const cs = entry.compressiveStrength
                return (
                  <tr key={entry.id} className="hover:bg-cyan-50/20 transition-colors">

                    {/* Date */}
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{fmtDate(entry.date)}</span>
                    </td>

                    {/* Compressive Strength */}
                    <td className="px-5 py-4 text-center">
                      {!cs.enabled ? (
                        <MinusCircle size={15} className="text-gray-200 mx-auto" />
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          {cs.day7 ? (
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-semibold text-gray-400">Day 7</span>
                              <span className="text-sm font-bold text-cyan-700 tabular-nums">{parseFloat(cs.day7).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                          ) : null}
                          {cs.day7 && cs.day28 && <span className="text-gray-200 text-xs">/</span>}
                          {cs.day28 ? (
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-semibold text-gray-400">Day 28</span>
                              <span className="text-sm font-bold text-cyan-700 tabular-nums">{parseFloat(cs.day28).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>

                    {/* Pressure Permeability */}
                    <td className="px-5 py-4 text-center">
                      <StatusCell enabled={entry.pressurePermeability.enabled} notes={entry.pressurePermeability.notes} />
                    </td>

                    {/* Normal Permeability */}
                    <td className="px-5 py-4 text-center">
                      <StatusCell enabled={entry.normalPermeability.enabled} notes={entry.normalPermeability.notes} />
                    </td>

                    {/* Boiling Test */}
                    <td className="px-5 py-4 text-center">
                      <StatusCell enabled={entry.boilingTest.enabled} notes={entry.boilingTest.notes} />
                    </td>

                    {/* Action */}
                    <td className="px-5 py-4">
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
        </table>
      </div>

      {showAdd  && <EntryModal onSave={handleAdd}  onClose={() => setShowAdd(false)} />}
      {editing  && <EntryModal initial={editing}   onSave={handleEdit} onClose={() => setEditing(null)} />}
      {deleting && <DeleteModal entry={deleting}   onConfirm={handleDelete} onClose={() => setDeleting(null)} />}
    </div>
  )
}
