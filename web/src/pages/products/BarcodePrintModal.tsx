import { useRef, useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useReactToPrint } from 'react-to-print'
import { useQuery } from '@tanstack/react-query'
import {
  X, Printer, Minus, Plus, Eye, EyeOff, GripVertical,
  AlignLeft, AlignCenter, AlignRight, AlertCircle, RotateCcw, Store,
  Save, Check,
} from 'lucide-react'
import JsBarcode from 'jsbarcode'
import type { Product } from '@/types'
import { outletApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ─── Persistence ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'pos_barcode_label_design'

interface SavedDesign {
  fields:        FieldConfig[]
  fontFamily:    string
  storeNameText: string
}

function loadSavedDesign(): SavedDesign | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedDesign) : null
  } catch { return null }
}

function persistDesign(d: SavedDesign) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
}

// ─── Types ────────────────────────────────────────────────────────────────────
type LabelSize  = 'small' | 'standard' | 'large'
type FieldId    = 'storeName' | 'category' | 'name' | 'price' | 'sku'
type AlignType  = 'left' | 'center' | 'right'

interface FieldConfig {
  id:       FieldId
  label:    string      // shown in editor
  visible:  boolean
  fontSize: number      // in pt
  bold:     boolean
  italic:   boolean
  align:    AlignType
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SIZES: Record<LabelSize, {
  label: string; wMm: number; hMm: number; barcodeH: number;
}> = {
  small:    { label: '38 × 19 mm', wMm: 38, hMm: 19, barcodeH: 18 },
  standard: { label: '50 × 25 mm', wMm: 50, hMm: 25, barcodeH: 26 },
  large:    { label: '75 × 40 mm', wMm: 75, hMm: 40, barcodeH: 40 },
}

const COLS_PER_ROW: Record<LabelSize, number> = { small: 4, standard: 3, large: 2 }

const FONTS = ['Arial', 'Helvetica', 'Georgia', 'Courier New', 'Times New Roman', 'Verdana']

const DEFAULT_FIELDS: FieldConfig[] = [
  { id: 'storeName', label: 'Store / Company Name', visible: true,  fontSize: 6,   bold: true,  italic: false, align: 'center' },
  { id: 'category',  label: 'Category / Brand',     visible: true,  fontSize: 5.5, bold: false, italic: false, align: 'left'   },
  { id: 'name',      label: 'Product Name',         visible: true,  fontSize: 7,   bold: true,  italic: false, align: 'left'   },
  { id: 'price',     label: 'Price / MRP',          visible: true,  fontSize: 6.5, bold: true,  italic: false, align: 'left'   },
  { id: 'sku',       label: 'SKU Code',             visible: false, fontSize: 5,   bold: false, italic: false, align: 'left'   },
]

// ─── Barcode helpers ──────────────────────────────────────────────────────────
function detectFormat(v: string): 'EAN13' | 'CODE128' {
  return /^\d{12,13}$/.test(v) ? 'EAN13' : 'CODE128'
}
function ean13Check(d: string): string {
  let s = 0
  for (let i = 0; i < 12; i++) s += parseInt(d[i]) * (i % 2 === 0 ? 1 : 3)
  return String((10 - (s % 10)) % 10)
}

// ─── Label Component ──────────────────────────────────────────────────────────
// PREVIEW_W: target preview width in pixels — all sizes scale to this
const PREVIEW_W = 200

function BarcodeLabel({
  product, size, fields, fontFamily, storeNameText, forPrint = false,
}: {
  product: Product; size: LabelSize; fields: FieldConfig[];
  fontFamily: string; storeNameText: string; forPrint?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const cfg = SIZES[size]

  // px-per-mm ratio for preview rendering
  const ppm = forPrint ? 3.7795 : (PREVIEW_W / cfg.wMm)
  // pt → px/pt for the current rendering mode
  const pt2unit = (pt: number) =>
    forPrint ? `${pt}pt` : `${(pt * 0.3528 * ppm).toFixed(1)}px`

  const rawBarcode = product.barcode || product.sku || `P${product.id}`
  const fmt = detectFormat(rawBarcode)
  const barcodeVal = fmt === 'EAN13' && rawBarcode.length === 12
    ? rawBarcode + ean13Check(rawBarcode) : rawBarcode

  useEffect(() => {
    if (!svgRef.current) return
    const opts = {
      width:        forPrint ? 1.5 : Math.max(1, 1.3 * (ppm / 3.7795)),
      height:       cfg.barcodeH * (forPrint ? 1 : ppm / 3.7795),
      displayValue: true,
      fontSize:     forPrint ? 8 : Math.round(8 * 0.3528 * ppm),
      margin:       forPrint ? 2 : Math.round(2 * ppm / 3.7795),
      background:   '#ffffff',
      lineColor:    '#000000',
      textMargin:   1,
    }
    try { JsBarcode(svgRef.current, barcodeVal, { ...opts, format: fmt }) }
    catch { try { JsBarcode(svgRef.current, rawBarcode, { ...opts, format: 'CODE128' }) } catch {} }
  }, [barcodeVal, fmt, rawBarcode, cfg, forPrint, ppm])

  const wStyle = forPrint ? `${cfg.wMm}mm` : `${PREVIEW_W}px`
  const hStyle = forPrint ? `${cfg.hMm}mm` : `${Math.round(cfg.hMm * ppm)}px`
  const pad    = forPrint ? '1.5mm 2mm 1mm' : `${Math.round(1.5 * ppm / 3.7795)}px ${Math.round(2 * ppm / 3.7795)}px`

  const mrpVal   = product.mrp
  const sellVal  = product.sellingPrice
  const hasMrp   = mrpVal && Number(mrpVal) !== Number(sellVal)
  const fmt2     = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 })

  const fieldValue = (f: FieldConfig): string | null => {
    switch (f.id) {
      case 'storeName': return storeNameText.trim() || null
      case 'category':  return product.category?.name || null
      case 'name':      return product.name
      case 'sku':       return product.sku || null
      case 'price':     return null  // rendered separately
      default:          return null
    }
  }

  return (
    <div style={{
      width:           wStyle,
      height:          hStyle,
      border:          forPrint ? '0.5pt solid #333' : '1px solid #555',
      borderRadius:    forPrint ? 0 : `${Math.round(2 * ppm / 3.7795)}px`,
      padding:         pad,
      display:         'flex',
      flexDirection:   'column',
      justifyContent:  'space-between',
      background:      '#fff',
      fontFamily:      fontFamily,
      boxSizing:       'border-box' as const,
      overflow:        'hidden',
      pageBreakInside: 'avoid',
      breakInside:     'avoid' as const,
    }}>
      {fields.filter(f => f.visible).map(f => {
        if (f.id === 'storeName') {
          const val = storeNameText.trim()
          if (!val) return null
          const isFirst = fields.filter(x => x.visible)[0]?.id === 'storeName'
          return (
            <div key="storeName" style={{
              fontSize:      pt2unit(f.fontSize),
              fontWeight:    f.bold ? 'bold' : 'normal',
              fontStyle:     f.italic ? 'italic' : 'normal',
              textAlign:     f.align,
              color:         '#000',
              lineHeight:    1.2,
              letterSpacing: '0.5pt',
              textTransform: 'uppercase' as const,
              overflow:      'hidden',
              whiteSpace:    'nowrap' as const,
              textOverflow:  'ellipsis',
              // separator below store name when it's the first field
              borderBottom:  isFirst ? (forPrint ? '0.5pt solid #bbb' : '1px solid #bbb') : undefined,
              paddingBottom:  isFirst ? (forPrint ? '1pt' : `${Math.round(0.5 * 0.3528 * ppm)}px`) : undefined,
              marginBottom:   isFirst ? (forPrint ? '1pt' : `${Math.round(0.5 * 0.3528 * ppm)}px`) : undefined,
            }}>
              {val}
            </div>
          )
        }
        if (f.id === 'price') {
          const justifyMap: Record<AlignType, string> = {
            left: 'flex-start', center: 'center', right: 'flex-end',
          }
          return (
            <div key="price" style={{
              fontSize:       pt2unit(f.fontSize),
              color:          '#000',
              display:        'flex',
              gap:            forPrint ? '3pt' : `${Math.round(3 * 0.3528 * ppm)}px`,
              alignItems:     'baseline',
              justifyContent: justifyMap[f.align],
              flexWrap:       'wrap' as const,
              fontStyle:      f.italic ? 'italic' : 'normal',
              width:          '100%',
            }}>
              {hasMrp && (
                <span style={{ textDecoration: 'line-through', color: '#888', fontSize: '0.82em' }}>
                  MRP ₹{fmt2(Number(mrpVal))}
                </span>
              )}
              <span style={{ fontWeight: f.bold ? 'bold' : 'normal' }}>
                {hasMrp ? 'Offer ' : 'MRP '}₹{fmt2(Number(sellVal))}
              </span>
              {product.unitOfMeasure && (
                <span style={{ color: '#666', fontSize: '0.78em' }}>/ {product.unitOfMeasure}</span>
              )}
            </div>
          )
        }
        const val = fieldValue(f)
        if (!val) return null
        return (
          <div key={f.id} style={{
            fontSize:     pt2unit(f.fontSize),
            fontWeight:   f.bold ? 'bold' : 'normal',
            fontStyle:    f.italic ? 'italic' : 'normal',
            textAlign:    f.align,
            color:        f.id === 'category' ? '#555' : '#000',
            lineHeight:   1.2,
            letterSpacing: f.id === 'category' ? '0.3pt' : undefined,
            textTransform: f.id === 'category' ? 'uppercase' as const : undefined,
            overflow:     'hidden',
            whiteSpace:   'nowrap' as const,
            textOverflow: 'ellipsis',
          }}>
            {f.id === 'sku' ? `SKU: ${val}` : val}
          </div>
        )
      })}

      {/* Barcode — always shown */}
      <svg ref={svgRef} style={{ maxWidth: '100%', display: 'block' }} />
    </div>
  )
}

// ─── Design Tab ───────────────────────────────────────────────────────────────
function DesignTab({
  fields, setFields, fontFamily, setFontFamily,
  storeNameText, setStoreNameText,
  onSave, isSaved, hasUnsaved, onReset,
}: {
  fields: FieldConfig[]
  setFields: (f: FieldConfig[]) => void
  fontFamily: string
  setFontFamily: (f: string) => void
  storeNameText: string
  setStoreNameText: (v: string) => void
  onSave: () => void
  isSaved: boolean
  hasUnsaved: boolean
  onReset: () => void
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const update = (idx: number, patch: Partial<FieldConfig>) => {
    const next = fields.map((f, i) => i === idx ? { ...f, ...patch } : f)
    setFields(next)
  }

  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setOverIdx(null); return }
    const next = [...fields]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(toIdx, 0, moved)
    setFields(next)
    setDragIdx(null)
    setOverIdx(null)
  }

  return (
    <div className="space-y-5">
      {/* Store / Company Name */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Store size={13} className="text-gray-400" />
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Store / Company Name</p>
        </div>
        <input
          type="text"
          value={storeNameText}
          onChange={e => setStoreNameText(e.target.value)}
          placeholder="e.g. My Store, ABC Enterprises…"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
        />
        <p className="text-[11px] text-gray-400 mt-1.5">
          Auto-filled from your outlet name — edit to customise what appears on the label.
        </p>
      </div>

      {/* Font family */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Font Family</p>
        <div className="flex flex-wrap gap-1.5">
          {FONTS.map(f => (
            <button
              key={f}
              onClick={() => setFontFamily(f)}
              className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                fontFamily === f
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              style={{ fontFamily: f }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            Fields — drag to reorder
          </p>
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
          >
            <RotateCcw size={11} /> Reset defaults
          </button>
        </div>

        <div className="space-y-1.5">
          {fields.map((f, idx) => (
            <div
              key={f.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); setOverIdx(idx) }}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
              className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-2 transition-all cursor-grab active:cursor-grabbing ${
                overIdx === idx && dragIdx !== idx
                  ? 'border-primary-400 bg-primary-50 scale-[1.01]'
                  : dragIdx === idx
                    ? 'opacity-40 border-gray-300'
                    : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Drag handle */}
              <GripVertical size={13} className="text-gray-300 flex-shrink-0" />

              {/* Visibility */}
              <button
                onClick={() => update(idx, { visible: !f.visible })}
                className={`flex-shrink-0 transition-colors ${f.visible ? 'text-gray-700' : 'text-gray-300'}`}
                title={f.visible ? 'Hide' : 'Show'}
              >
                {f.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>

              {/* Label */}
              <span className={`text-xs flex-1 min-w-0 truncate ${f.visible ? 'text-gray-700' : 'text-gray-400'}`}>
                {f.label}
              </span>

              {/* Bold */}
              <button
                onClick={() => update(idx, { bold: !f.bold })}
                className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
                  f.bold ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-100'
                }`}
              >B</button>

              {/* Italic */}
              <button
                onClick={() => update(idx, { italic: !f.italic })}
                className={`px-1.5 py-0.5 rounded text-xs italic transition-colors ${
                  f.italic ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-100'
                }`}
              >I</button>

              {/* Align */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                {(['left', 'center', 'right'] as AlignType[]).map(a => {
                  const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
                  return (
                    <button
                      key={a}
                      onClick={() => update(idx, { align: a })}
                      className={`p-1 transition-colors ${
                        f.align === a ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={11} />
                    </button>
                  )
                })}
              </div>

              {/* Font size */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => update(idx, { fontSize: Math.max(4, +(f.fontSize - 0.5).toFixed(1)) })}
                  className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs leading-none"
                >−</button>
                <span className="text-xs font-mono w-6 text-center text-gray-700">{f.fontSize}</span>
                <button
                  onClick={() => update(idx, { fontSize: Math.min(16, +(f.fontSize + 0.5).toFixed(1)) })}
                  className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs leading-none"
                >+</button>
                <span className="text-[10px] text-gray-400">pt</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Barcode bars are always printed — not configurable
        </p>
      </div>

      {/* ── Save design ── */}
      <div className={`rounded-xl border p-3 transition-colors ${
        isSaved
          ? 'border-emerald-200 bg-emerald-50'
          : hasUnsaved
            ? 'border-amber-200 bg-amber-50'
            : 'border-gray-100 bg-gray-50'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {isSaved ? (
              <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <Check size={13} /> Design saved successfully
              </p>
            ) : hasUnsaved ? (
              <p className="text-xs font-semibold text-amber-700">Unsaved changes</p>
            ) : (
              <p className="text-xs font-semibold text-gray-600">Save label design</p>
            )}
            <p className="text-[11px] text-gray-400 mt-0.5">
              {isSaved
                ? 'Your design will load automatically next time'
                : hasUnsaved
                  ? 'Save to keep these changes for future prints'
                  : 'Persist layout, fonts, and field settings across sessions'}
            </p>
          </div>
          <button
            onClick={onSave}
            disabled={isSaved}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              isSaved
                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                : 'bg-gray-900 hover:bg-gray-800 text-white shadow-sm'
            }`}
          >
            {isSaved ? <Check size={14} /> : <Save size={14} />}
            {isSaved ? 'Saved' : 'Save Design'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Setup Tab ────────────────────────────────────────────────────────────────
function SetupTab({
  product, size, setSize, qty, setQty,
}: {
  product: Product; size: LabelSize; setSize: (s: LabelSize) => void;
  qty: number; setQty: (q: number) => void
}) {
  const rawBarcode = product.barcode || product.sku || `P${product.id}`

  return (
    <div className="space-y-5">
      {/* Label Size */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Label Size</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SIZES) as LabelSize[]).map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`py-2.5 px-3 rounded-xl border text-left transition-colors ${
                size === s
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="text-xs font-semibold capitalize">{s}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{SIZES[s].label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Quantity</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Minus size={14} />
            </button>
            <input
              type="number" min={1} max={200} value={qty}
              onChange={e => setQty(Math.max(1, Math.min(200, parseInt(e.target.value) || 1)))}
              className="w-14 text-center border border-gray-200 rounded-lg py-1.5 text-sm font-bold focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
            <button
              onClick={() => setQty(Math.min(200, qty + 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[1, 5, 10, 25, 50, 100].map(n => (
              <button
                key={n}
                onClick={() => setQty(n)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  qty === n ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >{n}</button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          {COLS_PER_ROW[size]} labels per row on A4 ·{' '}
          {Math.ceil(qty / COLS_PER_ROW[size])} row{Math.ceil(qty / COLS_PER_ROW[size]) !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Barcode info */}
      <div className="rounded-xl border border-gray-100 overflow-hidden text-xs">
        <div className="bg-gray-50 px-3 py-2 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">
          Label Data
        </div>
        <div className="divide-y divide-gray-50">
          {([
            ['Product',         product.name],
            ['Category',        product.category?.name || '—'],
            ['SKU',             product.sku || '—'],
            ['Barcode',         rawBarcode],
            ['Format',          detectFormat(rawBarcode) === 'EAN13' ? 'EAN-13 (Global Standard)' : 'Code 128'],
            ['MRP',             product.mrp ? `₹${Number(product.mrp).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'],
            ['Selling Price',   `₹${Number(product.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
          ] as [string, string][]).map(([lbl, val]) => (
            <div key={lbl} className="flex justify-between px-3 py-1.5">
              <span className="text-gray-400">{lbl}</span>
              <span className="text-gray-700 font-medium truncate max-w-[180px] text-right">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {!product.barcode && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            No barcode set — using {product.sku ? 'SKU' : 'product ID'} as barcode value.
            Set a proper barcode on the product for retail scanning compatibility.
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface Props {
  product: Product
  onClose: () => void
}

export default function BarcodePrintModal({ product, onClose }: Props) {
  // ── Load saved design once on mount ──
  const saved = useMemo(() => loadSavedDesign(), [])

  const [tab,           setTab]           = useState<'setup' | 'design'>('setup')
  const [size,          setSize]          = useState<LabelSize>('standard')
  const [qty,           setQty]           = useState(1)
  const [fields,        setFields]        = useState<FieldConfig[]>(
    saved?.fields ?? DEFAULT_FIELDS.map(f => ({ ...f }))
  )
  const [fontFamily,    setFontFamily]    = useState(saved?.fontFamily ?? 'Arial')
  const [storeNameText, setStoreNameText] = useState(saved?.storeNameText ?? '')
  const [isSaved,       setIsSaved]       = useState(false)
  // Track the last-persisted snapshot to detect unsaved changes
  const [savedSnapshot, setSavedSnapshot] = useState<string>(
    saved ? JSON.stringify(saved) : ''
  )

  const printRef = useRef<HTMLDivElement>(null)
  const outletId = useAuthStore(s => s.outletId)

  // Fetch outlet name — only pre-populate if no saved design loaded
  const { data: outletData } = useQuery({
    queryKey:  ['outlet', outletId],
    queryFn:   () => outletApi.getById(outletId!).then(r => r.data.data),
    enabled:   Boolean(outletId),
    staleTime: 5 * 60 * 1000,
  })
  useEffect(() => {
    if (outletData?.name && !storeNameText) setStoreNameText(outletData.name)
  }, [outletData])

  // Detect unsaved changes by comparing current state to last saved snapshot
  const currentSnapshot = JSON.stringify({ fields, fontFamily, storeNameText })
  const hasUnsaved = savedSnapshot !== '' && currentSnapshot !== savedSnapshot

  const handleSaveDesign = () => {
    const design: SavedDesign = { fields, fontFamily, storeNameText }
    persistDesign(design)
    setSavedSnapshot(JSON.stringify(design))
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

  const handleReset = () => {
    const defaults = DEFAULT_FIELDS.map(f => ({ ...f }))
    setFields(defaults)
    setFontFamily('Arial')
    // keep storeNameText — it's content, not design
  }

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Label_${product.sku || product.id}`,
    pageStyle: `
      @page { size: A4 portrait; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { box-sizing: border-box; }
      }
    `,
  })

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '760px', maxWidth: '96vw', maxHeight: '92vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900">Print Barcode Label</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-3"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body: side-by-side ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left — live preview */}
          <div className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-100 flex flex-col items-center justify-center p-5 gap-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide self-start">
              Live Preview
            </p>
            <div className="flex items-center justify-center">
              <BarcodeLabel
                product={product}
                size={size}
                fields={fields}
                fontFamily={fontFamily}
                storeNameText={storeNameText}
                forPrint={false}
              />
            </div>
            <p className="text-[10px] text-gray-400 text-center leading-relaxed">
              Actual label: {SIZES[size].wMm} × {SIZES[size].hMm} mm
            </p>
          </div>

          {/* Right — settings */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100 flex-shrink-0 px-5 pt-4 gap-4">
              {(['setup', 'design'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    tab === t
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t === 'setup' ? 'Setup' : 'Label Design'}
                  {t === 'design' && hasUnsaved && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'setup'
                ? <SetupTab product={product} size={size} setSize={setSize} qty={qty} setQty={setQty} />
                : <DesignTab
                    fields={fields} setFields={setFields}
                    fontFamily={fontFamily} setFontFamily={setFontFamily}
                    storeNameText={storeNameText} setStoreNameText={setStoreNameText}
                    onSave={handleSaveDesign} isSaved={isSaved}
                    hasUnsaved={hasUnsaved} onReset={handleReset}
                  />
              }
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-400">
              <span className="font-semibold text-gray-700">{qty}</span> label{qty !== 1 ? 's' : ''} ·{' '}
              {storeNameText && <><span className="font-semibold text-gray-700 truncate max-w-[100px] inline-block align-bottom">{storeNameText}</span> · </>}
              <span className="font-semibold text-gray-700">{fontFamily}</span> ·{' '}
              {SIZES[size].label}
            </p>
            {hasUnsaved && tab === 'design' && (
              <button
                onClick={handleSaveDesign}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors border border-amber-200"
              >
                <Save size={11} /> Save design
              </button>
            )}
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Printer size={15} />
            Print {qty > 1 ? `${qty} Labels` : 'Label'}
          </button>
        </div>
      </div>

      {/* ── Hidden print sheet ── */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div ref={printRef}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2mm', alignContent: 'flex-start', alignItems: 'flex-start' }}>
            {Array.from({ length: qty }).map((_, i) => (
              <BarcodeLabel key={i} product={product} size={size} fields={fields} fontFamily={fontFamily} storeNameText={storeNameText} forPrint />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
