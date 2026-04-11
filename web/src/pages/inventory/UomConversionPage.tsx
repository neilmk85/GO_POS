import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ArrowRight, Zap, Package, X, ChevronDown, Info, ShoppingCart, Truck, FlaskConical } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/services/api'

// ── UOM options (mirrored from ProductForm) ──────────────────────────────────
const UOM_OPTIONS = [
  { group: 'Count',   units: [{ value: 'pcs', label: 'Pieces (pcs)' }, { value: 'nos', label: 'Numbers (nos)' }, { value: 'unit', label: 'Unit' }, { value: 'pair', label: 'Pair' }, { value: 'set', label: 'Set' }, { value: 'dozen', label: 'Dozen' }, { value: 'pack', label: 'Pack' }, { value: 'box', label: 'Box' }, { value: 'carton', label: 'Carton' }, { value: 'bag', label: 'Bag' }, { value: 'roll', label: 'Roll' }, { value: 'strip', label: 'Strip' }] },
  { group: 'Weight',  units: [{ value: 'kg', label: 'Kilogram (kg)' }, { value: 'g', label: 'Gram (g)' }, { value: 'mg', label: 'Milligram (mg)' }, { value: 'ton', label: 'Tonne (ton)' }, { value: 'lb', label: 'Pound (lb)' }, { value: 'oz', label: 'Ounce (oz)' }, { value: 'quintal', label: 'Quintal' }] },
  { group: 'Volume',  units: [{ value: 'l', label: 'Litre (l)' }, { value: 'ml', label: 'Millilitre (ml)' }, { value: 'cl', label: 'Centilitre (cl)' }] },
  { group: 'Length',  units: [{ value: 'm', label: 'Metre (m)' }, { value: 'cm', label: 'Centimetre (cm)' }, { value: 'mm', label: 'Millimetre (mm)' }, { value: 'ft', label: 'Feet (ft)' }, { value: 'in', label: 'Inch (in)' }, { value: 'yard', label: 'Yard' }] },
  { group: 'Area',    units: [{ value: 'sqm', label: 'Sq. Metre (sqm)' }, { value: 'sqft', label: 'Sq. Feet (sqft)' }] },
  { group: 'Service', units: [{ value: 'hr', label: 'Hour (hr)' }, { value: 'min', label: 'Minute (min)' }, { value: 'day', label: 'Day' }, { value: 'month', label: 'Month' }, { value: 'job', label: 'Job / Visit' }] },
]

const ALL_UNITS = UOM_OPTIONS.flatMap(g => g.units)
const labelFor = (v: string) => ALL_UNITS.find(u => u.value === v)?.label ?? v

// ── Preset conversions ────────────────────────────────────────────────────────
const PRESETS = [
  // Weight
  { from: 'kg',      to: 'g',    factor: 1000,     emoji: '⚖️',  label: '1 kg = 1,000 g' },
  { from: 'ton',     to: 'kg',   factor: 1000,     emoji: '🏋️',  label: '1 ton = 1,000 kg' },
  { from: 'quintal', to: 'kg',   factor: 100,      emoji: '📦',  label: '1 quintal = 100 kg' },
  { from: 'lb',      to: 'g',    factor: 453.5924, emoji: '⚖️',  label: '1 lb = 453.6 g' },
  { from: 'oz',      to: 'g',    factor: 28.3495,  emoji: '⚖️',  label: '1 oz = 28.35 g' },
  // Volume
  { from: 'l',       to: 'ml',   factor: 1000,     emoji: '💧',  label: '1 L = 1,000 ml' },
  { from: 'cl',      to: 'ml',   factor: 10,       emoji: '💧',  label: '1 cl = 10 ml' },
  // Count
  { from: 'dozen',   to: 'pcs',  factor: 12,       emoji: '🥚',  label: '1 dozen = 12 pcs' },
  { from: 'box',     to: 'pcs',  factor: 10,       emoji: '📦',  label: '1 box = 10 pcs' },
  { from: 'carton',  to: 'box',  factor: 12,       emoji: '📦',  label: '1 carton = 12 boxes' },
  { from: 'pack',    to: 'pcs',  factor: 10,       emoji: '🎁',  label: '1 pack = 10 pcs' },
  { from: 'roll',    to: 'm',    factor: 100,      emoji: '🧻',  label: '1 roll = 100 m' },
  // Length
  { from: 'm',       to: 'cm',   factor: 100,      emoji: '📏',  label: '1 m = 100 cm' },
  { from: 'm',       to: 'mm',   factor: 1000,     emoji: '📏',  label: '1 m = 1,000 mm' },
  { from: 'ft',      to: 'in',   factor: 12,       emoji: '📏',  label: '1 ft = 12 in' },
  { from: 'yard',    to: 'ft',   factor: 3,        emoji: '📏',  label: '1 yard = 3 ft' },
]

function fmtFactor(n: number) {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(4).replace(/\.?0+$/, '')
}

// ── UoM Select component ──────────────────────────────────────────────────────
function UomSelect({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm cursor-pointer"
      >
        {UOM_OPTIONS.map(g => (
          <optgroup key={g.group} label={g.group}>
            {g.units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
          </optgroup>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard({ product, onConfigure }: { product: any; onConfigure: () => void }) {
  const hasPurchase = product.purchaseUom && (product.purchaseFactor ?? 1) != 1
  const hasSale     = product.saleUom && (product.saleFactor ?? 1) != 1
  const hasAny      = hasPurchase || hasSale

  return (
    <div
      className={`group relative bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden cursor-pointer ${
        hasAny ? 'border-indigo-200 shadow-indigo-50 shadow-md' : 'border-gray-200'
      }`}
      onClick={onConfigure}
    >
      {/* Top accent stripe */}
      <div className={`h-1 w-full ${hasAny ? 'bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400' : 'bg-gray-100'}`} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{product.name}</h3>
            {product.sku && <p className="text-xs text-gray-400 mt-0.5 truncate">{product.sku}</p>}
          </div>
          <span className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-full font-semibold tracking-wide ${
            hasAny
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {hasAny ? 'Active' : 'Direct'}
          </span>
        </div>

        {/* UoM rows */}
        <div className="space-y-1.5">
          <UomRow icon={<FlaskConical size={11} />} label="Base" value={product.unitOfMeasure ?? 'pcs'} color="gray" />
          {hasPurchase && (
            <UomRow icon={<Truck size={11} />} label="Buy in" value={product.purchaseUom}
              color="blue" extra={`×${fmtFactor(product.purchaseFactor)}`} />
          )}
          {hasSale && (
            <UomRow icon={<ShoppingCart size={11} />} label="Sell in" value={product.saleUom}
              color="green" extra={`×${fmtFactor(product.saleFactor)}`} />
          )}
        </div>

        <button
          className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold transition-colors ${
            hasAny
              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          Configure
        </button>
      </div>
    </div>
  )
}

function UomRow({ icon, label, value, color, extra }: { icon: React.ReactNode; label: string; value: string; color: string; extra?: string }) {
  const colors: Record<string, string> = {
    gray:  'bg-gray-100 text-gray-700',
    blue:  'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 w-4 flex justify-center">{icon}</span>
      <span className="text-[11px] text-gray-400 w-12">{label}</span>
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${colors[color]}`}>{value}</span>
      {extra && <span className="text-[11px] text-gray-400">{extra}</span>}
    </div>
  )
}

// ── Configure Modal ───────────────────────────────────────────────────────────
function ConfigureModal({ product, onClose, onSaved }: { product: any; onClose: () => void; onSaved: () => void }) {
  const [baseUom,        setBaseUom]        = useState(product.unitOfMeasure ?? 'pcs')
  const [purchaseUom,    setPurchaseUom]    = useState(product.purchaseUom ?? '')
  const [saleUom,        setSaleUom]        = useState(product.saleUom ?? '')
  const [purchaseFactor, setPurchaseFactor] = useState<number>(product.purchaseFactor ?? 1)
  const [saleFactor,     setSaleFactor]     = useState<number>(product.saleFactor ?? 1)
  const [saving, setSaving] = useState(false)

  const purchasePresets = PRESETS.filter(p => p.to === baseUom)
  const salePresets     = PRESETS.filter(p => p.to === baseUom)

  async function handleSave() {
    setSaving(true)
    try {
      await productApi.update(product.id, {
        ...product,
        unitOfMeasure: baseUom,
        purchaseUom:   purchaseUom || null,
        saleUom:       saleUom     || null,
        purchaseFactor: purchaseFactor,
        saleFactor:     saleFactor,
      })
      toast.success('UoM conversion saved!')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function applyPurchasePreset(p: typeof PRESETS[0]) {
    setPurchaseUom(p.from)
    setPurchaseFactor(p.factor)
  }

  function applySalePreset(p: typeof PRESETS[0]) {
    setSaleUom(p.from)
    setSaleFactor(p.factor)
  }

  const purchaseExample = purchaseUom && purchaseFactor > 1
    ? `Receive 1 ${purchaseUom} → +${fmtFactor(purchaseFactor)} ${baseUom} added to stock`
    : null
  const saleExample = saleUom && saleFactor > 1
    ? `Sell 1 ${saleUom} → −${fmtFactor(saleFactor)} ${baseUom} deducted from stock`
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header gradient */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-t-3xl px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Package size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-none">{product.name}</h2>
                <p className="text-indigo-200 text-xs mt-0.5">{product.sku ? `SKU: ${product.sku}` : 'UoM Conversion Setup'}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Mini explainer */}
          <div className="mt-4 flex items-start gap-2 bg-white/10 rounded-xl p-3">
            <Info size={14} className="text-indigo-200 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-100 leading-relaxed">
              Stock is always tracked in the <strong>Base unit</strong>. Purchase & Sale units are for display — the system converts automatically using the factor.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Visual Flow ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Conversion Flow</p>
            <div className="flex items-stretch gap-2">
              {/* Purchase */}
              <div className="flex-1 bg-gradient-to-b from-blue-50 to-blue-50/30 border border-blue-100 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center">
                    <Truck size={11} className="text-white" />
                  </div>
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Purchase</span>
                </div>
                <UomSelect value={purchaseUom || baseUom} onChange={setPurchaseUom} />
                <div className="mt-3">
                  <label className="text-[11px] text-blue-600 font-medium">Factor (1 unit = ? base)</label>
                  <input
                    type="number" min="0.0001" step="any"
                    value={purchaseFactor}
                    onChange={e => setPurchaseFactor(parseFloat(e.target.value) || 1)}
                    className="w-full mt-1 border border-blue-200 bg-white rounded-xl px-3 py-2 text-sm font-bold text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center gap-1 px-1">
                <ArrowRight size={16} className="text-indigo-300" />
                <ArrowRight size={16} className="text-indigo-300 opacity-40" />
              </div>

              {/* Base */}
              <div className="flex-1 bg-gradient-to-b from-indigo-50 to-indigo-50/30 border-2 border-indigo-200 rounded-2xl p-4 relative">
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide shadow">Stock Unit</span>
                </div>
                <div className="flex items-center gap-1.5 mb-3 mt-1">
                  <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center">
                    <FlaskConical size={11} className="text-white" />
                  </div>
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Base</span>
                </div>
                <UomSelect value={baseUom} onChange={setBaseUom} />
                <p className="text-[11px] text-indigo-500 mt-2 text-center">Inventory tracked in this unit</p>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center gap-1 px-1">
                <ArrowRight size={16} className="text-indigo-300" />
                <ArrowRight size={16} className="text-indigo-300 opacity-40" />
              </div>

              {/* Sale */}
              <div className="flex-1 bg-gradient-to-b from-emerald-50 to-emerald-50/30 border border-emerald-100 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center">
                    <ShoppingCart size={11} className="text-white" />
                  </div>
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Sale</span>
                </div>
                <UomSelect value={saleUom || baseUom} onChange={setSaleUom} />
                <div className="mt-3">
                  <label className="text-[11px] text-emerald-600 font-medium">Factor (1 unit = ? base)</label>
                  <input
                    type="number" min="0.0001" step="any"
                    value={saleFactor}
                    onChange={e => setSaleFactor(parseFloat(e.target.value) || 1)}
                    className="w-full mt-1 border border-emerald-200 bg-white rounded-xl px-3 py-2 text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Live Preview ── */}
          {(purchaseExample || saleExample) && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Live Preview</p>
              {purchaseExample && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                  <Truck size={14} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-blue-800 font-medium">{purchaseExample}</span>
                </div>
              )}
              {saleExample && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                  <ShoppingCart size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-sm text-emerald-800 font-medium">{saleExample}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Presets ── */}
          {(purchasePresets.length > 0 || salePresets.length > 0) && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Zap size={12} className="text-yellow-500" /> Quick Presets
              </p>
              <div className="grid grid-cols-2 gap-3">
                {purchasePresets.length > 0 && (
                  <div>
                    <p className="text-[11px] text-blue-600 font-semibold mb-1.5 flex items-center gap-1">
                      <Truck size={10} /> Purchase presets
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {purchasePresets.map(p => (
                        <button
                          key={p.label}
                          onClick={() => applyPurchasePreset(p)}
                          className="text-[11px] px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors border border-blue-100"
                        >
                          {p.emoji} {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {salePresets.length > 0 && (
                  <div>
                    <p className="text-[11px] text-emerald-600 font-semibold mb-1.5 flex items-center gap-1">
                      <ShoppingCart size={10} /> Sale presets
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {salePresets.map(p => (
                        <button
                          key={p.label}
                          onClick={() => applySalePreset(p)}
                          className="text-[11px] px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-medium transition-colors border border-emerald-100"
                        >
                          {p.emoji} {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              {saving ? 'Saving…' : 'Save Conversion'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UomConversionPage() {
  const qc = useQueryClient()
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState<'all' | 'active' | 'none'>('all')
  const [selected,   setSelected]   = useState<any>(null)

  const { data: productsPage, isLoading } = useQuery({
    queryKey: ['products-uom'],
    queryFn: () => productApi.getAll({ size: 500 }).then(r => r.data.data),
  })

  const products: any[] = productsPage?.content ?? []

  const stats = useMemo(() => ({
    total:    products.length,
    active:   products.filter(p => (p.purchaseFactor ?? 1) != 1 || (p.saleFactor ?? 1) != 1).length,
    purchase: products.filter(p => (p.purchaseFactor ?? 1) != 1).length,
    sale:     products.filter(p => (p.saleFactor ?? 1) != 1).length,
  }), [products])

  const filtered = useMemo(() => {
    let list = products
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
    }
    if (filter === 'active') list = list.filter(p => (p.purchaseFactor ?? 1) != 1 || (p.saleFactor ?? 1) != 1)
    if (filter === 'none')   list = list.filter(p => (p.purchaseFactor ?? 1) == 1 && (p.saleFactor ?? 1) == 1)
    return list
  }, [products, search, filter])

  return (
    <div className="min-h-full bg-gray-50">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative px-8 py-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
              <ArrowRight size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Unit of Measure Conversion</h1>
              <p className="text-indigo-300 text-sm mt-0.5">
                Buy in bulk, stock in base units, sell in customer-friendly sizes
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-4 mt-5">
            {[
              { label: 'Total Products',      value: stats.total,    color: 'bg-white/10' },
              { label: 'Conversion Active',   value: stats.active,   color: 'bg-indigo-500/30' },
              { label: 'Purchase Conversion', value: stats.purchase, color: 'bg-blue-500/30' },
              { label: 'Sale Conversion',     value: stats.sale,     color: 'bg-emerald-500/30' },
            ].map(s => (
              <div key={s.label} className={`${s.color} backdrop-blur rounded-xl px-4 py-2.5 border border-white/10`}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-indigo-300 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'none'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Conversion Active' : 'No Conversion'}
            </button>
          ))}
        </div>
        <p className="ml-auto text-sm text-gray-400">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* ── Grid ── */}
      <div className="px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-60">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
              <p className="text-sm text-gray-500">Loading products…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Package size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No products found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onConfigure={() => setSelected(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <ConfigureModal
          product={selected}
          onClose={() => setSelected(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['products-uom'] })}
        />
      )}
    </div>
  )
}
