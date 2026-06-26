import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RefreshCw, Plus, Pencil, Trash2, X, Loader2, AlertTriangle,
  ArrowRight, ChevronDown, ArrowLeft, Calendar,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { conversionsApi, type ConversionEntry } from '@/services/businessApi'
import { pipeConfigApi } from '@/services/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().slice(0, 10) }

// Parse "PCCP 350mm 4kg" → { diameter: "350", kg: "4" }
function parsePipe(name: string): { diameter: string; kg: string } | null {
  const m = name.match(/(\d+)mm\s+([\d.]+)kg/i)
  return m ? { diameter: m[1], kg: m[2] } : null
}

function pipeLabel(name: string) {
  const p = parsePipe(name)
  return p ? `${p.kg} kg` : name
}

function diameterLabel(d: string) { return `${d} mm` }

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

// ─── Entry Modal ──────────────────────────────────────────────────────────────
function EntryModal({ initial, onSave, onClose, pipesByDiameter, diameters, loadingPipes }: {
  initial?:        ConversionEntry
  onSave:          (data: Omit<ConversionEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose:         () => void
  pipesByDiameter: Map<string, { kg: string; name: string }[]>
  diameters:       string[]
  loadingPipes:    boolean
}) {
  // Pre-fill from existing entry
  const initFrom = initial ? parsePipe(initial.fromPipe) : null
  const initTo   = initial ? parsePipe(initial.toPipe)   : null

  const [date,     setDate]     = useState(initial?.date ?? todayStr())
  const [diameter, setDiameter] = useState(initFrom?.diameter ?? diameters[0] ?? '')
  const [fromKg,   setFromKg]   = useState(initFrom?.kg ?? '')
  const [toKg,     setToKg]     = useState(initTo?.kg   ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity ?? '')
  const [notes,    setNotes]    = useState(initial?.notes    ?? '')
  const [saving,   setSaving]   = useState(false)
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  // When diameter list loads and nothing is selected yet, pick first
  useEffect(() => {
    if (!diameter && diameters.length > 0) setDiameter(diameters[0])
  }, [diameters, diameter])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const kgOptions = pipesByDiameter.get(diameter) ?? []

  const handleDiameterChange = (d: string) => {
    setDiameter(d)
    setFromKg('')
    setToKg('')
    setErrors({})
  }

  const clearErr = (k: string) => setErrors(prev => { const n = { ...prev }; delete n[k]; return n })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!date)                            errs.date     = 'Please select a date'
    if (!diameter)                        errs.diameter = 'Please select a diameter'
    if (!fromKg)                          errs.fromKg   = 'Please select source pressure'
    if (!toKg)                            errs.toKg     = 'Please select target pressure'
    if (fromKg && toKg && fromKg === toKg) errs.toKg   = 'From and To must be different'
    if (!quantity || parseFloat(quantity) <= 0) errs.quantity = 'Please enter a valid quantity'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    const fromPipe = `PCCP ${diameter}mm ${fromKg}kg`
    const toPipe   = `PCCP ${diameter}mm ${toKg}kg`
    setTimeout(() => {
      onSave({ date, fromPipe, toPipe, quantity, notes: notes.trim() })
      setSaving(false)
    }, 200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <RefreshCw size={15} className="text-purple-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{initial ? 'Edit Conversion' : 'New Conversion'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date <span className="text-red-500">*</span></label>
            <input type="date" value={date}
              onChange={e => { setDate(e.target.value); clearErr('date') }}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-colors ${errors.date ? 'border-red-400' : 'border-gray-200'}`} />
            {errors.date && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} />{errors.date}</p>}
          </div>

          {/* Diameter selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Diameter <span className="text-red-500">*</span>
            </label>
            {loadingPipes ? (
              <p className="text-xs text-gray-400">Loading pipe configs…</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {diameters.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDiameterChange(d)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      diameter === d
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600'
                    }`}
                  >
                    {diameterLabel(d)}
                  </button>
                ))}
              </div>
            )}
            {errors.diameter && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} />{errors.diameter}</p>}
          </div>

          {/* From Kg → To Kg */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Pressure Conversion <span className="text-red-500">*</span>
              {diameter && (
                <span className="ml-2 font-normal text-gray-400">within {diameterLabel(diameter)} pipes</span>
              )}
            </label>
            <div className="grid grid-cols-[1fr_36px_1fr] items-start gap-2">
              {/* From */}
              <div>
                <div className="relative">
                  <select
                    value={fromKg}
                    onChange={e => { setFromKg(e.target.value); clearErr('fromKg') }}
                    disabled={!diameter || kgOptions.length === 0}
                    className={`w-full appearance-none px-3 py-2.5 pr-9 text-sm border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-colors disabled:bg-gray-50 disabled:text-gray-400 ${errors.fromKg ? 'border-red-400' : 'border-gray-200'}`}
                  >
                    <option value="">From pressure…</option>
                    {kgOptions
                      .filter(o => o.kg !== toKg)
                      .map(o => (
                        <option key={o.kg} value={o.kg}>{o.kg} kg</option>
                      ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                {errors.fromKg && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} />{errors.fromKg}</p>}
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center pt-2.5">
                <ArrowRight size={16} className="text-purple-400" />
              </div>

              {/* To */}
              <div>
                <div className="relative">
                  <select
                    value={toKg}
                    onChange={e => { setToKg(e.target.value); clearErr('toKg') }}
                    disabled={!diameter || kgOptions.length === 0}
                    className={`w-full appearance-none px-3 py-2.5 pr-9 text-sm border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-colors disabled:bg-gray-50 disabled:text-gray-400 ${errors.toKg ? 'border-red-400' : 'border-gray-200'}`}
                  >
                    <option value="">To pressure…</option>
                    {kgOptions
                      .filter(o => o.kg !== fromKg)
                      .map(o => (
                        <option key={o.kg} value={o.kg}>{o.kg} kg</option>
                      ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                {errors.toKg && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} />{errors.toKg}</p>}
              </div>
            </div>

            {/* Live preview */}
            {fromKg && toKg && diameter && (
              <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-100">
                <span className="text-[11px] font-medium text-gray-500">Converting:</span>
                <span className="text-xs font-semibold text-orange-700 bg-orange-50 rounded-md px-2 py-0.5">PCCP {diameter}mm {fromKg}kg</span>
                <ArrowRight size={12} className="text-purple-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-purple-700 bg-purple-50 rounded-md px-2 py-0.5 border border-purple-100">PCCP {diameter}mm {toKg}kg</span>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity (pipes) <span className="text-red-500">*</span></label>
            <input
              type="number" min="1" step="1" placeholder="Number of pipes converted…"
              value={quantity}
              onChange={e => { setQuantity(e.target.value); clearErr('quantity') }}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-colors ${errors.quantity ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.quantity && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} />{errors.quantity}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea rows={2} placeholder="Any remarks…" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-colors resize-none" />
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {initial ? 'Save Changes' : 'Add Conversion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteModal({ entry, onConfirm, onClose }: { entry: ConversionEntry; onConfirm: () => void; onClose: () => void }) {
  const from = parsePipe(entry.fromPipe)
  const to   = parsePipe(entry.toPipe)
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
          Delete conversion{from && to ? (
            <> from <span className="font-semibold">{from.diameter}mm {from.kg}kg</span> → <span className="font-semibold">{to.kg}kg</span></>
          ) : (
            <> from <span className="font-semibold">{entry.fromPipe}</span> → <span className="font-semibold">{entry.toPipe}</span></>
          )} on <span className="font-semibold">{fmtDate(entry.date)}</span>?
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
export default function ConversionPage() {
  const navigate = useNavigate()
  const [entries,  setEntries]  = useState<ConversionEntry[]>([])
  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState<ConversionEntry | null>(null)
  const [deleting, setDeleting] = useState<ConversionEntry | null>(null)
  const [fromDate, setFromDate] = useState(isoDate(startOf('month')))
  const [toDate,   setToDate]   = useState(isoDate(new Date()))
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    conversionsApi.list(fromDate || undefined, toDate || undefined)
      .then(setEntries)
      .catch(() => toast.error('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  // Fetch & parse pipe configs
  const { data: pipeProducts = [], isLoading: loadingPipes } = useQuery({
    queryKey: ['pipe-configs-for-conversion'],
    queryFn: async () => {
      const res  = await pipeConfigApi.getAll({ size: 500 })
      const list = res.data.data?.content ?? res.data.data ?? []
      return (list as any[]).filter((p: any) => p.name).map((p: any) => p.name as string)
    },
    staleTime: 5 * 60 * 1000,
  })

  // Group by diameter → sorted kg options
  const { pipesByDiameter, diameters } = useMemo(() => {
    const map = new Map<string, { kg: string; name: string }[]>()
    for (const name of pipeProducts) {
      const p = parsePipe(name)
      if (!p) continue
      if (!map.has(p.diameter)) map.set(p.diameter, [])
      map.get(p.diameter)!.push({ kg: p.kg, name })
    }
    for (const list of map.values()) list.sort((a, b) => parseFloat(a.kg) - parseFloat(b.kg))
    const diams = Array.from(map.keys()).sort((a, b) => parseInt(a) - parseInt(b))
    return { pipesByDiameter: map, diameters: diams }
  }, [pipeProducts])

  const handleAdd = async (data: Omit<ConversionEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await conversionsApi.create(data)
      setEntries(prev => [created, ...prev])
      setShowAdd(false)
      toast.success('Conversion added')
    } catch { toast.error('Failed to add entry') }
  }

  const handleEdit = async (data: Omit<ConversionEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const updated = await conversionsApi.update(editing!.id, data)
      setEntries(prev => prev.map(e => e.id === editing!.id ? updated : e))
      setEditing(null)
      toast.success('Entry updated')
    } catch { toast.error('Failed to update entry') }
  }

  const handleDelete = async () => {
    try {
      await conversionsApi.delete(deleting!.id)
      setEntries(prev => prev.filter(e => e.id !== deleting!.id))
      setDeleting(null)
      toast.success('Entry deleted')
    } catch { toast.error('Failed to delete entry') }
  }

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-5">

      {/* Hero Banner */}
      <div className="relative overflow-visible">
        <div className="rounded-2xl bg-gradient-to-r from-violet-700 via-violet-600 to-blue-600 px-6 py-5 overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button onClick={() => navigate('/business')}
                className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors" title="Back">
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw size={22} className="text-purple-300" />
                  <h1 className="text-xl font-bold text-white">Conversion</h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-white/60">Convert same-diameter pipes to a different pressure class</p>
                  <div className="w-px h-4 bg-white/20" />
                  <DateRangePicker fromDate={fromDate} toDate={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
                </div>
              </div>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-700 bg-white rounded-xl hover:bg-white/90 shadow-sm hover:shadow-md transition-all">
              <Plus size={16} /> Add Conversion
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(168,85,247,0.10), 0 1.5px 6px rgba(0,0,0,0.07)' }}>
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-600 to-purple-600">
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Date</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Diameter</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">From</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider w-8"></th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">To</th>
              <th className="px-5 py-4 text-right  text-xs font-bold text-white uppercase tracking-wider">Qty</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Notes</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <Loader2 size={24} className="text-purple-300 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Loading…</p>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <RefreshCw size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">No conversions yet</p>
                  <p className="text-xs text-gray-300 mt-1">Click "Add Conversion" to get started</p>
                </td>
              </tr>
            ) : (
              entries.map(entry => {
                const from = parsePipe(entry.fromPipe)
                const to   = parsePipe(entry.toPipe)
                return (
                  <tr key={entry.id} className="hover:bg-purple-50/20 transition-colors">

                    {/* Date */}
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{fmtDate(entry.date)}</span>
                    </td>

                    {/* Diameter */}
                    <td className="px-5 py-3.5">
                      {from ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                          {from.diameter} mm
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* From pressure */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 whitespace-nowrap">
                        {from ? `${from.kg} kg` : entry.fromPipe}
                      </span>
                    </td>

                    {/* Arrow */}
                    <td className="px-2 py-3.5 text-center">
                      <ArrowRight size={14} className="text-purple-300 mx-auto" />
                    </td>

                    {/* To pressure */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 whitespace-nowrap">
                        {to ? `${to.kg} kg` : entry.toPipe}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-700 tabular-nums">
                        {parseFloat(entry.quantity).toLocaleString('en-IN')}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-gray-500">
                        {entry.notes || <span className="text-gray-200 italic text-xs">—</span>}
                      </span>
                    </td>

                    {/* Actions */}
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
        </table>
      </div>

      {showAdd  && (
        <EntryModal
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
          pipesByDiameter={pipesByDiameter}
          diameters={diameters}
          loadingPipes={loadingPipes}
        />
      )}
      {editing  && (
        <EntryModal
          initial={editing}
          onSave={handleEdit}
          onClose={() => setEditing(null)}
          pipesByDiameter={pipesByDiameter}
          diameters={diameters}
          loadingPipes={loadingPipes}
        />
      )}
      {deleting && (
        <DeleteModal entry={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} />
      )}
    </div>
  )
}
