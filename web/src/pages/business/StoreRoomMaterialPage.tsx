import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { format, subDays, startOfMonth } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { Archive, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, Search, ArrowLeft, Calendar, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { storeRoomMaterialsApi, type StoreEntry } from '@/services/businessApi'
import { productApi } from '@/services/api'

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

// ─── Custom Range Picker ───────────────────────────────────────────────────────
function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function CustomRangePicker({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tmpFrom, setTmpFrom] = useState(from)
  const [tmpTo,   setTmpTo]   = useState(to)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setTmpFrom(from); setTmpTo(to) }, [from, to])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const presetActive = PRESETS.some(p => from === p.from() && to === p.to())
  const customActive = !presetActive && !!(from || to)
  const label = customActive ? `${dmy(from)} – ${dmy(to)}` : 'Custom'

  const apply = () => { onChange(tmpFrom, tmpTo); setOpen(false) }
  const clear = () => { onChange('', ''); setOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
          customActive
            ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white border-transparent'
            : 'border-white/30 text-white/80 hover:border-white/60'
        }`}
      >
        <Calendar size={11} />
        {label}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-72">
          <p className="text-xs font-semibold text-gray-600 mb-3">Custom Date Range</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">From</label>
              <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">To</label>
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={clear}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Clear
            </button>
            <button onClick={apply}
              className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg hover:from-violet-700 hover:to-blue-700 transition-all">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const ITEM_TYPE_BADGE: Record<string, string> = {
  RAW_MATERIAL:  'bg-amber-50 text-amber-700',
  FINISHED_PIPE: 'bg-violet-50 text-violet-700',
  GENERAL:       'bg-gray-100 text-gray-600',
}
const ITEM_TYPE_LABEL: Record<string, string> = {
  RAW_MATERIAL:  'Raw Material',
  FINISHED_PIPE: 'PCCP Pipe',
  GENERAL:       'General',
}

// ─── Item Autocomplete ────────────────────────────────────────────────────────
interface ProductOption { name: string; uom: string; itemType: string }

function ItemAutocomplete({
  value,
  onChange,
  options,
  loading,
}: {
  value: string
  onChange: (name: string, uom: string, itemType: string) => void
  options: ProductOption[]
  loading: boolean
}) {
  const [open, setOpen]     = useState(false)
  const [cursor, setCursor] = useState(-1)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.name.toLowerCase().includes(q))
  }, [value, options])

  const pick = (o: ProductOption) => {
    onChange(o.name, o.uom, o.itemType)
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
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder={loading ? 'Loading products…' : 'Search item name…'}
          value={value}
          onChange={e => { onChange(e.target.value, '', ''); setOpen(true); setCursor(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-400 transition-colors"
        />
        {loading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto"
          style={{ zIndex: 9999 }}>
          {filtered.map((o, i) => (
            <li
              key={o.name}
              onMouseDown={e => { e.preventDefault(); pick(o) }}
              onMouseEnter={() => setCursor(i)}
              className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                i === cursor
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white'
                  : 'hover:bg-lime-50'
              }`}
            >
              <span className={`text-sm font-medium ${i === cursor ? 'text-white' : 'text-gray-800'}`}>
                {o.name}
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {o.uom && (
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                    i === cursor ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>{o.uom}</span>
                )}
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                  i === cursor
                    ? 'bg-white/20 text-white'
                    : o.itemType === 'RAW_MATERIAL' ? 'bg-amber-50 text-amber-600'
                    : o.itemType === 'FINISHED_PIPE' ? 'bg-violet-50 text-violet-600'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {ITEM_TYPE_LABEL[o.itemType] ?? o.itemType}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && value.trim() && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3"
          style={{ zIndex: 9999 }}>
          <p className="text-sm text-gray-400 italic">No products match "{value}"</p>
        </div>
      )}
    </div>
  )
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
const EMPTY_FORM = { date: todayStr(), itemName: '', itemType: '', quantity: '', uom: '', notes: '' }

function EntryModal({
  initial,
  onSave,
  onClose,
  productOptions,
  loadingProducts,
}: {
  initial?: StoreEntry
  onSave: (data: Omit<StoreEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
  productOptions: ProductOption[]
  loadingProducts: boolean
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
    setErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const handleItemChange = (name: string, uom: string, itemType: string) => {
    setForm(f => ({ ...f, itemName: name, uom, itemType }))
    setErrors(prev => { const n = { ...prev }; delete n.itemName; return n })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.date)              errs.date = 'Please select a date'
    if (!form.itemName?.trim())  errs.itemName = 'Please select an item'
    const qty = parseFloat(form.quantity)
    if (!form.quantity || isNaN(qty) || qty <= 0) errs.quantity = 'Please enter a valid quantity'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    setTimeout(() => { onSave({ ...form, itemName: form.itemName.trim(), notes: form.notes.trim() }); setSaving(false) }, 250)
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-400 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-lime-50 flex items-center justify-center">
              <Archive size={16} className="text-lime-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              {initial ? 'Edit Entry' : 'Add Store Material'}
            </h2>
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
            <input type="date" value={form.date}
              onChange={e => setField('date', e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-400 transition-colors ${errors.date ? 'border-red-400' : 'border-gray-200'}`} />
            {errors.date && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.date}</p>}
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Item Name <span className="text-red-500">*</span>
            </label>
            <div className={errors.itemName ? 'ring-1 ring-red-400 rounded-xl' : ''}>
              <ItemAutocomplete
                value={form.itemName}
                onChange={handleItemChange}
                options={productOptions}
                loading={loadingProducts}
              />
            </div>
            {errors.itemName && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.itemName}</p>}
            {form.itemType && (
              <p className="mt-1.5 text-xs text-gray-400">
                Type: <span className={`font-semibold px-1.5 py-0.5 rounded ${ITEM_TYPE_BADGE[form.itemType] ?? 'bg-gray-100 text-gray-500'}`}>
                  {ITEM_TYPE_LABEL[form.itemType] ?? form.itemType}
                </span>
                {form.uom && <> · UoM: <span className="font-semibold text-gray-500">{form.uom}</span></>}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Quantity <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 100"
                value={form.quantity}
                onChange={e => setField('quantity', e.target.value)}
                className={`${errors.quantity ? 'border-red-400' : 'border-gray-200'} flex-1 px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-400 transition-colors`}
              />
              {form.uom && (
                <span className="flex items-center px-3 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl shrink-0">
                  {form.uom}
                </span>
              )}
            </div>
            {errors.quantity && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.quantity}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea rows={3} placeholder="Optional notes…" value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className={`${inputCls} resize-none`} />
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
function DeleteModal({ entry, onConfirm, onClose }: { entry: StoreEntry; onConfirm: () => void; onClose: () => void }) {
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
          Delete the entry for <span className="font-semibold">{entry.itemName}</span> on <span className="font-semibold">{fmtDate(entry.date)}</span>?
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
export default function StoreRoomMaterialPage() {
  const navigate = useNavigate()
  const [entries, setEntries]   = useState<StoreEntry[]>([])
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<StoreEntry | null>(null)
  const [deleting, setDeleting] = useState<StoreEntry | null>(null)
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [toDate, setToDate]     = useState(format(new Date(), 'yyyy-MM-dd'))

  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    storeRoomMaterialsApi.list(fromDate || undefined, toDate || undefined)
      .then(setEntries)
      .catch(() => toast.error('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  // Fetch all products (raw materials + general) for the autocomplete
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products-for-store'],
    queryFn: async () => {
      const res = await productApi.getAll({ size: 1000, page: 0 })
      const list = res.data.data?.content ?? res.data.data ?? []
      return (list as any[]).map((p: any): ProductOption => ({
        name:     p.name as string,
        uom:      p.unitOfMeasure ?? p.uom ?? '',
        itemType: p.itemType ?? 'GENERAL',
      })).filter((p: ProductOption) => p.name)
    },
    staleTime: 5 * 60 * 1000,
  })

  const productOptions: ProductOption[] = useMemo(() => {
    if (!productsData) return []
    // Sort: Raw Material first, then General, then Pipes; within each group alphabetically
    const order: Record<string, number> = { RAW_MATERIAL: 0, GENERAL: 1, FINISHED_PIPE: 2 }
    return [...productsData].sort((a, b) =>
      (order[a.itemType] ?? 1) - (order[b.itemType] ?? 1) || a.name.localeCompare(b.name)
    )
  }, [productsData])

  const filtered = useMemo(() => entries, [entries])

  const handleAdd = async (data: Omit<StoreEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await storeRoomMaterialsApi.create(data)
      setEntries(prev => [created, ...prev])
      setShowAdd(false)
      toast.success('Entry added')
    } catch { toast.error('Failed to add entry') }
  }
  const handleEdit = async (data: Omit<StoreEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const updated = await storeRoomMaterialsApi.update(editing!.id, data)
      setEntries(prev => prev.map(e => e.id === editing!.id ? updated : e))
      setEditing(null)
      toast.success('Entry updated')
    } catch { toast.error('Failed to update entry') }
  }
  const handleDelete = async () => {
    try {
      await storeRoomMaterialsApi.delete(deleting!.id)
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
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button onClick={() => navigate('/business')} className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors" title="Back">
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Archive size={26} className="text-lime-300" />
                  <h1 className="text-xl font-bold text-white">Store Room Material</h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-white/60">Store room material issues and consumption log</p>
                  <div className="w-px h-4 bg-white/20" />
                  {PRESETS.map(p => (
                    <button key={p.label} onClick={() => { setFromDate(p.from()); setToDate(p.to()) }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                        fromDate === p.from() && toDate === p.to()
                          ? 'bg-white/20 text-white border-white/30'
                          : 'border-white/20 text-white/60 hover:border-white/40'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                  <CustomRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
                </div>
              </div>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-700 bg-white rounded-xl hover:bg-white/90 shadow-sm hover:shadow-md transition-all">
              <Plus size={16} /> Add Material
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-600 to-blue-600">
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Date</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Item Name</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Type</th>
              <th className="px-5 py-4 text-right  text-xs font-bold text-white uppercase tracking-wider">Quantity</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Notes</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <Archive size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">
                    {entries.length === 0 ? 'No entries yet' : 'No entries for selected date range'}
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    {entries.length === 0 ? 'Click "Add Material" to get started' : 'Try adjusting the date filter'}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-lime-50/30 transition-colors">
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-800">{fmtDate(entry.date)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold text-gray-800">{entry.itemName}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    {entry.itemType ? (
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${ITEM_TYPE_BADGE[entry.itemType] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ITEM_TYPE_LABEL[entry.itemType] ?? entry.itemType}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs italic">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="inline-flex items-baseline gap-1">
                      <span className="text-sm font-bold text-gray-800 tabular-nums">
                        {parseFloat(entry.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                      {entry.uom && <span className="text-xs font-semibold text-gray-400">{entry.uom}</span>}
                    </span>
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

      {showAdd  && (
        <EntryModal onSave={handleAdd}  onClose={() => setShowAdd(false)}
          productOptions={productOptions} loadingProducts={loadingProducts} />
      )}
      {editing  && (
        <EntryModal initial={editing}   onSave={handleEdit} onClose={() => setEditing(null)}
          productOptions={productOptions} loadingProducts={loadingProducts} />
      )}
      {deleting && (
        <DeleteModal entry={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} />
      )}
    </div>
  )
}
