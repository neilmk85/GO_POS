import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Search, FileText, X, Loader2, ChevronLeft, ChevronRight,
  Trash2, IndianRupee, Calendar, CheckCircle, Send, Ban,
  CreditCard, Clock, Printer, ShoppingCart, Percent, Truck,
  Hash, Edit2, AlertTriangle, ChevronDown, Mail,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
         startOfQuarter, endOfQuarter, subMonths } from 'date-fns'
import { invoiceApi, productApi, discountApi, integrationApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import CustomerSearchInput from '@/components/CustomerSearchInput'
import { DEFAULT_INVOICE_TEMPLATE, InvoiceTemplateConfig } from '@/pages/settings/SettingsPage'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SENT:      'bg-blue-50 text-blue-700',
  PAID:      'bg-green-50 text-green-700',
  PARTIAL:   'bg-yellow-50 text-yellow-700',
  OVERDUE:   'bg-red-50 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const STATUS_TAB_ACTIVE: Record<string, string> = {
  ALL:       'bg-gray-800 text-white shadow-md',
  DRAFT:     'bg-gray-500 text-white shadow-md',
  SENT:      'bg-blue-600 text-white shadow-md',
  PAID:      'bg-emerald-600 text-white shadow-md',
  PARTIAL:   'bg-amber-500 text-white shadow-md',
  OVERDUE:   'bg-red-500 text-white shadow-md',
  CANCELLED: 'bg-gray-400 text-white shadow-md',
}
const STATUS_TABS = ['ALL', 'DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED']

const PIE_COLORS: Record<string, string> = {
  DRAFT: '#9ca3af', SENT: '#3b82f6', PAID: '#10b981',
  PARTIAL: '#f59e0b', OVERDUE: '#ef4444', CANCELLED: '#d1d5db',
}

type DatePreset = 'today' | 'week' | 'month' | 'lastMonth' | 'quarter' | 'fy' | 'custom' | 'all'

function getDateRange(preset: DatePreset, custom: { from: string; to: string }) {
  const now = new Date()
  switch (preset) {
    case 'today':     return { from: format(now, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'week':      return { from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') }
    case 'month':     return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
    case 'lastMonth': return { from: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'), to: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd') }
    case 'quarter':   return { from: format(startOfQuarter(now), 'yyyy-MM-dd'), to: format(endOfQuarter(now), 'yyyy-MM-dd') }
    case 'fy': {
      const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
      return { from: `${yr}-04-01`, to: `${yr + 1}-03-31` }
    }
    case 'custom':    return custom.from && custom.to ? custom : { from: '', to: '' }
    default:          return { from: '', to: '' }
  }
}

// ─── Line item type ────────────────────────────────────────────────────────────

interface LineItem {
  id: string
  productId: number | null
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRate: number
  autoDiscountLabel?: string   // name of system discount that was auto-applied
}

function calcLine(item: LineItem) {
  const base = item.quantity * item.unitPrice
  const disc = base * (item.discountPercent / 100)
  const afterDisc = base - disc
  const tax = afterDisc * (item.taxRate / 100)
  return { base, disc, tax, total: afterDisc + tax }
}

// ─── Product search dropdown ───────────────────────────────────────────────────

function ProductSearch({ onSelect }: { onSelect: (p: any) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await productApi.search(query)
        const products = res.data.data ?? []
        // Fetch discount previews for each product in parallel
        const withDiscounts = await Promise.all(products.map(async (p: any) => {
          try {
            const unitPrice = p.sellingPrice ?? p.price ?? 0
            if (unitPrice > 0) {
              const dr = await discountApi.itemPreview(p.id, 1, unitPrice)
              const preview = dr.data.data
              if (preview && preview.discountPct > 0) {
                return { ...p, _offerLabel: preview.label, _offerPct: Number(preview.discountPct) }
              }
            }
          } catch { /* ignore */ }
          return p
        }))
        setResults(withDiscounts)
        setOpen(true)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 border border-dashed border-primary-300 rounded-lg px-3 py-2 hover:border-primary-400 transition-colors">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search product to add…"
          className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
        />
        {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {results.map(p => {
            const price = p.sellingPrice ?? p.price ?? 0
            const hasOffer = p._offerPct > 0
            const discounted = hasOffer ? price * (1 - p._offerPct / 100) : price
            return (
              <button key={p.id} type="button"
                onMouseDown={() => { onSelect(p); setQuery(''); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-gray-400">{p.sku}</p>
                    {hasOffer && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Percent size={8} /> {p._offerLabel || `${p._offerPct}% off`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {hasOffer ? (
                    <>
                      <p className="text-xs text-gray-400 line-through">₹{price.toLocaleString('en-IN')}</p>
                      <p className="text-sm font-semibold text-emerald-600">₹{discounted.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-primary-600">₹{price.toLocaleString('en-IN')}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Payment Terms ────────────────────────────────────────────────────────────

const PAYMENT_TERMS = [
  { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt', days: 0 },
  { value: 'NET_7',          label: 'Net 7',           days: 7 },
  { value: 'NET_15',         label: 'Net 15',          days: 15 },
  { value: 'NET_30',         label: 'Net 30',          days: 30 },
  { value: 'NET_45',         label: 'Net 45',          days: 45 },
  { value: 'NET_60',         label: 'Net 60',          days: 60 },
  { value: 'CUSTOM',         label: 'Custom Date',     days: null },
]

// ─── Create Invoice Panel ─────────────────────────────────────────────────────

function CreateInvoicePanel({ outletId, onClose, onCreated, editInvoice }: {
  outletId: number
  onClose: () => void
  onCreated: () => void
  editInvoice?: any
}) {
  const isEdit = !!editInvoice

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [issueDate, setIssueDate]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentTerms, setPaymentTerms] = useState('NET_30')
  const [dueDate, setDueDate]           = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [notes, setNotes]               = useState('')
  const [terms, setTerms]               = useState('')
  const [items, setItems]               = useState<LineItem[]>([])
  const [billDiscPct, setBillDiscPct]   = useState(0)
  const [poNumber, setPoNumber]         = useState('')
  const [shippingAmt, setShippingAmt]   = useState(0)
  const [advanceAmt, setAdvanceAmt]     = useState(0)
  const [submitting, setSubmitting]     = useState(false)
  const [sendOnSave, setSendOnSave]     = useState(false)
  const initialized = useRef(false)

  // Pre-populate for edit mode (runs once)
  useEffect(() => {
    if (editInvoice && !initialized.current) {
      initialized.current = true
      setSelectedCustomer(editInvoice.customer ? { id: editInvoice.customer.id, name: editInvoice.customer.name, phone: editInvoice.customer.phone } : null)
      setIssueDate(editInvoice.issueDate ?? format(new Date(), 'yyyy-MM-dd'))
      setPaymentTerms(editInvoice.paymentTerms ?? 'CUSTOM')
      setDueDate(editInvoice.dueDate ?? '')
      setNotes(editInvoice.notes ?? '')
      setTerms(editInvoice.termsConditions ?? '')
      setBillDiscPct(editInvoice.billDiscountPct ?? 0)
      setPoNumber(editInvoice.poNumber ?? '')
      setShippingAmt(editInvoice.shippingAmount ?? 0)
      setAdvanceAmt(editInvoice.paidAmount ?? 0)
      setItems((editInvoice.items ?? []).map((it: any) => ({
        id: crypto.randomUUID(),
        productId: it.product?.id ?? null,
        productName: it.productName,
        productSku: it.productSku ?? '',
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discountPercent: Number(it.discountPercent ?? 0),
        taxRate: Number(it.taxRate ?? 0),
      })))
    }
  }, [editInvoice])

  // Auto-calculate due date when payment terms or issue date changes (skip CUSTOM & edit init)
  useEffect(() => {
    if (!initialized.current && isEdit) return
    const term = PAYMENT_TERMS.find(t => t.value === paymentTerms)
    if (term && term.days !== null) {
      setDueDate(format(addDays(new Date(issueDate), term.days), 'yyyy-MM-dd'))
    }
  }, [paymentTerms, issueDate])

  async function addProduct(p: any) {
    const unitPrice = p.sellingPrice ?? p.price ?? 0
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      productId: p.id,
      productName: p.name,
      productSku: p.sku ?? '',
      quantity: 1,
      unitPrice,
      discountPercent: 0,
      taxRate: p.taxGroup?.totalRate ?? 0,
    }
    // Fetch auto-discount from system offers
    try {
      const res = await discountApi.itemPreview(p.id, 1, unitPrice)
      const preview = res.data.data
      if (preview && preview.discountPct > 0) {
        newItem.discountPercent = Number(preview.discountPct)
        newItem.autoDiscountLabel = preview.label
      }
    } catch { /* no discount is fine */ }
    setItems(prev => [...prev, newItem])
  }

  function updateItem(id: string, field: keyof LineItem, value: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const lineTotals = items.reduce((acc, it) => {
    const c = calcLine(it)
    return { subtotal: acc.subtotal + c.base, lineDisc: acc.lineDisc + c.disc, tax: acc.tax + c.tax }
  }, { subtotal: 0, lineDisc: 0, tax: 0 })

  const afterLineDisc   = lineTotals.subtotal - lineTotals.lineDisc
  const billDiscAmt     = afterLineDisc * (billDiscPct / 100)
  const taxableAmount   = afterLineDisc - billDiscAmt
  const grandTotal      = taxableAmount + lineTotals.tax + shippingAmt

  // GST label for invoice form: show % if all items share same rate
  const formTaxRates = [...new Set(items.map(i => i.taxRate).filter(r => r > 0))]
  const formGstLabel = formTaxRates.length === 1 ? `GST (${formTaxRates[0]}%)` : 'GST'

  // Rounding off for invoice form
  const roundedGrandTotal = Math.round(grandTotal)
  const formRoundOff = parseFloat((roundedGrandTotal - grandTotal).toFixed(2))

  async function handleSubmit(send: boolean) {
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSendOnSave(send)
    setSubmitting(true)
    try {
      const payload = {
        outletId,
        customerId: selectedCustomer?.id ?? undefined,
        issueDate,
        dueDate: paymentTerms !== 'DUE_ON_RECEIPT' ? dueDate : undefined,
        paymentTerms,
        billDiscountPct: billDiscPct > 0 ? billDiscPct : undefined,
        poNumber: poNumber || undefined,
        shippingAmount: shippingAmt > 0 ? shippingAmt : undefined,
        notes: notes || undefined,
        termsConditions: terms || undefined,
        items: items.map(it => ({
          productId: it.productId ?? undefined,
          productName: it.productName,
          productSku: it.productSku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          taxRate: it.taxRate,
        })),
      }
      let invoiceId: number
      if (isEdit) {
        const res = await invoiceApi.update(editInvoice.id, payload)
        invoiceId = res.data.data.id
        // Sync advance payment: record the delta if it changed
        const prevPaid = editInvoice.paidAmount ?? 0
        const delta = advanceAmt - prevPaid
        if (delta > 0) await invoiceApi.recordPayment(invoiceId, delta)
        if (send) await invoiceApi.updateStatus(invoiceId, 'SENT')
        toast.success(send ? 'Invoice updated & sent' : 'Invoice updated')
      } else {
        const res = await invoiceApi.create(payload)
        invoiceId = res.data.data.id
        if (advanceAmt > 0) await invoiceApi.recordPayment(invoiceId, advanceAmt)
        if (send) await invoiceApi.updateStatus(invoiceId, 'SENT')
        toast.success(send ? 'Invoice created & sent' : 'Invoice saved as draft')
      }
      onCreated()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? (isEdit ? 'Failed to update invoice' : 'Failed to create invoice'))
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTerm = PAYMENT_TERMS.find(t => t.value === paymentTerms)

  return (
    <div className="fixed inset-y-0 right-0 left-[220px] z-50 flex">
      <div className="w-full bg-white shadow-2xl flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <FileText size={16} className="text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{isEdit ? `Edit Invoice` : 'New Invoice'}</h2>
              <p className="text-[11px] text-gray-400">{isEdit ? editInvoice.invoiceNumber : 'Invoice number assigned on save'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: Invoice metadata */}
          <div className="w-72 shrink-0 border-r p-5 flex flex-col gap-4 overflow-y-auto bg-gray-50/50">

            {/* Customer */}
            <CustomerSearchInput
              label="Bill To"
              value={selectedCustomer}
              onSelect={setSelectedCustomer}
              onClear={() => setSelectedCustomer(null)}
              placeholder="Search customer…"
            />

            {/* Issue date */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Issue Date</label>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white">
                <Calendar size={13} className="text-gray-400" />
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                  className="flex-1 text-sm outline-none text-gray-700" />
              </div>
            </div>

            {/* Payment Terms */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Payment Terms</label>
              <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer">
                {PAYMENT_TERMS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {paymentTerms !== 'DUE_ON_RECEIPT' && (
                <div className="mt-1.5">
                  {paymentTerms === 'CUSTOM' ? (
                    <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white">
                      <Calendar size={13} className="text-gray-400" />
                      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                        className="flex-1 text-sm outline-none text-gray-700" />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 pl-1">Due: <span className="font-medium text-gray-600">{dueDate}</span></p>
                  )}
                </div>
              )}
            </div>

            {/* Bill-level Discount */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Trade / Bill Discount</label>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary-500">
                <Percent size={13} className="text-gray-400" />
                <input type="number" min="0" max="100" step="0.5" value={billDiscPct || ''}
                  onChange={e => setBillDiscPct(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="flex-1 text-sm outline-none text-gray-700" />
                <span className="text-xs text-gray-400">%</span>
              </div>
              {billDiscPct > 0 && (
                <p className="text-xs text-green-600 pl-1 mt-1">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} off</p>
              )}
            </div>

            {/* PO Number */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">PO Number</label>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary-500">
                <Hash size={13} className="text-gray-400" />
                <input value={poNumber} onChange={e => setPoNumber(e.target.value)}
                  placeholder="Buyer's PO reference…"
                  className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400" />
              </div>
            </div>

            {/* Shipping */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Freight / Shipping</label>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary-500">
                <Truck size={13} className="text-gray-400" />
                <input type="number" min="0" step="0.01" value={shippingAmt || ''}
                  onChange={e => setShippingAmt(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="flex-1 text-sm outline-none text-gray-700" />
                <span className="text-xs text-gray-400">₹</span>
              </div>
            </div>

            {/* Advance / Partial Payment */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Advance Received</label>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary-500">
                <IndianRupee size={13} className="text-gray-400" />
                <input type="number" min="0" step="0.01" value={advanceAmt || ''}
                  onChange={e => setAdvanceAmt(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="flex-1 text-sm outline-none text-gray-700" />
              </div>
              {advanceAmt > 0 && grandTotal > 0 && (
                <p className="text-xs pl-1 mt-1">
                  {advanceAmt >= grandTotal
                    ? <span className="text-green-600 font-medium">Fully paid</span>
                    : <span className="text-amber-600">Balance due: ₹{(grandTotal - advanceAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  }
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder={`Payment due ${selectedTerm?.days === 0 ? 'on receipt' : `within ${selectedTerm?.days} days`}…`}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white" />
            </div>

            {/* Terms */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Terms & Conditions</label>
              <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={3}
                placeholder="Late payment charges, return policy…"
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white" />
            </div>
          </div>

          {/* Right: Line items */}
          <div className="flex-1 p-5 flex flex-col overflow-hidden">

            <ProductSearch onSelect={addProduct} />

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-2">
                <FileText size={40} className="opacity-40" />
                <p className="text-sm">Search products above to add line items</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto mt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-gray-400 uppercase border-b">
                      <th className="pb-2 text-left">Product</th>
                      <th className="pb-2 text-center w-16">Qty</th>
                      <th className="pb-2 text-center w-24">Unit Price</th>
                      <th className="pb-2 text-center w-16">Disc%</th>
                      <th className="pb-2 text-center w-16">GST%</th>
                      <th className="pb-2 text-right w-24">Amount</th>
                      <th className="pb-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map(it => {
                      const c = calcLine(it)
                      return (
                        <tr key={it.id} className="group">
                          <td className="py-2 pr-2">
                            <p className="font-medium text-gray-800 truncate max-w-[150px]">{it.productName}</p>
                            {it.productSku && <p className="text-xs text-gray-400">{it.productSku}</p>}
                            {it.autoDiscountLabel && it.discountPercent > 0 && (
                              <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Percent size={8} />
                                {it.autoDiscountLabel}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-1">
                            <input type="number" min="0.01" step="0.01" value={it.quantity}
                              onChange={e => updateItem(it.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full text-center border rounded px-1 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none" />
                          </td>
                          <td className="py-2 px-1">
                            <input type="number" min="0" step="0.01" value={it.unitPrice}
                              onChange={e => updateItem(it.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full text-center border rounded px-1 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none" />
                          </td>
                          <td className="py-2 px-1">
                            <input type="number" min="0" max="100" step="0.5" value={it.discountPercent}
                              onChange={e => updateItem(it.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                              className="w-full text-center border rounded px-1 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none" />
                          </td>
                          <td className="py-2 px-1">
                            <input type="number" min="0" max="100" step="0.5" value={it.taxRate}
                              onChange={e => updateItem(it.id, 'taxRate', parseFloat(e.target.value) || 0)}
                              className="w-full text-center border rounded px-1 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none" />
                          </td>
                          <td className="py-2 pl-2 text-right font-semibold text-gray-800 whitespace-nowrap">
                            ₹{c.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 pl-1">
                            <button type="button" onClick={() => removeItem(it.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50">
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals summary */}
            {items.length > 0 && (
              <div className="mt-3 pt-3 border-t shrink-0">
                <div className="ml-auto w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>₹{lineTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {lineTotals.lineDisc > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Line Discounts</span>
                      <span>−₹{lineTotals.lineDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {billDiscPct > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Trade Discount ({billDiscPct}%)</span>
                      <span>−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {lineTotals.tax > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>{formGstLabel}</span>
                      <span>+₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {shippingAmt > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Freight / Shipping</span>
                      <span>+₹{shippingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {formRoundOff !== 0 && (
                    <div className="flex justify-between text-gray-400 text-xs">
                      <span>Round Off</span>
                      <span>{formRoundOff > 0 ? '+' : ''}₹{formRoundOff.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t mt-1">
                    <span>Total</span>
                    <span>₹{roundedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {advanceAmt > 0 && (
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Advance Received</span>
                      <span>−₹{advanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {advanceAmt > 0 && advanceAmt < grandTotal && (
                    <div className="flex justify-between text-red-500 font-semibold">
                      <span>Balance Due</span>
                      <span>₹{(grandTotal - advanceAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {paymentTerms !== 'DUE_ON_RECEIPT' && (
                    <p className="text-xs text-gray-400 text-right">Due {dueDate}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}{grandTotal > 0 ? ` · ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}</p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={submitting}
              className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button onClick={() => handleSubmit(false)} disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
              {submitting && !sendOnSave ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {isEdit ? 'Update Draft' : 'Save as Draft'}
            </button>
            <button onClick={() => handleSubmit(true)} disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg transition-colors">
              {submitting && sendOnSave ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isEdit ? 'Update & Send' : 'Save & Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ invoice, onClose, onDone }: {
  invoice: any
  onClose: () => void
  onDone: () => void
}) {
  const balance = (invoice.totalAmount ?? 0) - (invoice.paidAmount ?? 0)
  const [amount, setAmount] = useState(balance.toFixed(2))
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (amt > balance) { toast.error(`Cannot exceed balance ₹${balance.toFixed(2)}`); return }
    setSubmitting(true)
    try {
      await invoiceApi.recordPayment(invoice.id, amt)
      toast.success('Payment recorded')
      onDone()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Record Payment</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>Invoice Total</span>
              <span className="font-medium text-gray-800">₹{(invoice.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Paid So Far</span>
              <span className="font-medium text-green-600">₹{(invoice.paidAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-1 text-gray-800">
              <span>Balance Due</span>
              <span>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Payment Amount</label>
            <div className="flex items-center border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500">
              <IndianRupee size={14} className="text-gray-400 mr-1.5" />
              <input type="number" min="0.01" step="0.01" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 text-sm outline-none text-gray-800" />
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Date formatter ───────────────────────────────────────────────────────────
// Converts ISO date string (yyyy-MM-dd or yyyy-MM-ddT...) → dd/mm/yyyy
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const clean = d.substring(0, 10)   // strip any time component
  const [y, m, day] = clean.split('-')
  if (!y || !m || !day) return d
  return `${day}/${m}/${y}`
}

function fmtTime(d: string | null | undefined) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '' }
}

// ─── View Invoice Modal ────────────────────────────────────────────────────────

function ViewInvoiceModal({ id, onClose, onUpdated, onEdit }: {
  id: number
  onClose: () => void
  onUpdated: () => void
  onEdit?: (inv: any) => void
}) {
  const [showPayment, setShowPayment]   = useState(false)
  const [updating, setUpdating]         = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const { outletId } = useAuthStore()
  const printRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const res = await invoiceApi.getById(id)
      return res.data.data
    },
  })

  async function changeStatus(status: string) {
    setUpdating(true)
    try {
      await invoiceApi.updateStatus(id, status)
      toast.success(`Invoice marked as ${status.toLowerCase()}`)
      refetch(); onUpdated()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to update status')
    } finally { setUpdating(false) }
  }

  async function handleSendEmail() {
    setEmailSending(true)
    try {
      await integrationApi.sendInvoiceEmail(id, outletId!)
      const inv = data
      toast.success(`Email sent to ${inv?.customer?.email}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to send email')
    } finally { setEmailSending(false) }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this draft invoice? This cannot be undone.')) return
    setDeleting(true)
    try {
      await invoiceApi.delete(id)
      toast.success('Draft deleted')
      onUpdated()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to delete invoice')
    } finally { setDeleting(false) }
  }

  // Parse invoice template from outlet settings
  const invTpl: InvoiceTemplateConfig = (() => {
    try {
      if (data?.outlet?.invoiceTemplate) {
        return { ...DEFAULT_INVOICE_TEMPLATE, ...JSON.parse(data.outlet.invoiceTemplate) }
      }
    } catch { /* use default */ }
    return DEFAULT_INVOICE_TEMPLATE
  })()

  function handlePrint() {
    const content = printRef.current
    if (!content || !inv) return
    const win = window.open('', '_blank', 'width=720,height=900')
    if (!win) return
    const pc = invTpl.primaryColor
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;font-size:13px;color:#111;background:#fff;max-width:700px;margin:0 auto}
        .inv-header{background:${pc};color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start}
        .inv-header h1{font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px}
        .inv-header .sub{font-size:12px;color:rgba(255,255,255,0.7);margin-top:3px}
        .badge{display:inline-flex;background:#ecfdf5;color:#15803d;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid #bbf7d0}
        .badge.partial{background:#fefce8;color:#a16207;border-color:#fde68a}
        .badge.overdue{background:#fef2f2;color:#dc2626;border-color:#fecaca}
        .badge.draft,.badge.cancelled{background:#f3f4f6;color:#4b5563;border-color:#e5e7eb}
        .meta{display:grid;grid-template-columns:${invTpl.showIssueDate !== false ? '1fr 1fr 1fr' : '1fr 1fr'};border-bottom:1px solid #e5e7eb;font-size:12px}
        .meta-cell{padding:12px 20px;border-right:1px solid #e5e7eb}
        .meta-cell:last-child{border-right:none}
        .meta-cell label{color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:2px}
        .meta-cell p{font-weight:600;color:#111}
        .body{padding:24px 32px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th{background:#f9fafb;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:.05em;border-bottom:2px solid #e5e7eb}
        td{padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151}
        .num{text-align:right}.cen{text-align:center}
        .totals-wrap{display:flex;justify-content:flex-end}
        .totals{width:260px;font-size:13px}
        .totals .row{display:flex;justify-content:space-between;padding:4px 0;color:#6b7280}
        .totals .grand{display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:15px;border-top:2px solid #111;margin-top:4px}
        .totals .paid{display:flex;justify-content:space-between;padding:4px 0;color:#16a34a;font-weight:600}
        .totals .balance{display:flex;justify-content:space-between;padding:4px 0;color:#dc2626;font-weight:600}
        .section{padding:16px 32px;border-top:1px solid #e5e7eb;font-size:12px}
        .section h4{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:6px}
        .sig-box{border-top:1px solid #9ca3af;padding-top:6px;text-align:center;width:160px;margin-left:auto;font-size:11px;color:#6b7280}
        .footer-bar{text-align:center;padding:16px 32px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}
        @media print{@page{margin:10mm}}
      </style></head><body>${content.innerHTML}
      <script>window.onload=function(){window.print();window.close()}</script>
      </body></html>`)
    win.document.close()
  }

  const inv     = data
  const balance = inv ? (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0) : 0
  const isPOS   = !!inv?.order

  const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'Cash', CARD: 'Card', UPI: 'UPI', WALLET: 'Wallet',
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900">Invoice Details</h3>
              {isPOS && (
                <span className="flex items-center gap-1 text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-full">
                  <ShoppingCart size={10} /> POS
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {inv && (
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 hover:bg-gray-700 text-white rounded-lg transition-colors">
                  <Printer size={13} /> Print
                </button>
              )}
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : inv ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* ── Printable content ── */}
              <div ref={printRef}>

                {/* Invoice header (template-colored, used in print) */}
                <div className="inv-header rounded-xl mb-3 px-5 py-4 flex items-start justify-between" style={{ background: invTpl.primaryColor }}>
                  <div>
                    {invTpl.showLogo && invTpl.logoUrl && <img src={invTpl.logoUrl} alt="Logo" className="h-8 object-contain mb-1" />}
                    <div className="text-white font-black text-xl tracking-tight">
                      {invTpl.layout === 'classic' ? 'TAX INVOICE' : 'INVOICE'}
                    </div>
                    <div className="sub text-white/70 text-xs mt-0.5">{inv.invoiceNumber}</div>
                    {data?.outlet?.name && <div className="sub text-white/60 text-xs">{data.outlet.name}</div>}
                  </div>
                  <span className={`badge text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600'} ${inv.status.toLowerCase()}`}>
                    {inv.status}
                  </span>
                </div>

                {/* Meta grid */}
                <div className="meta grid grid-cols-3 gap-3 text-sm mb-3">
                  <div className="meta-cell bg-gray-50 rounded-lg p-3">
                    <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Invoice #</label>
                    <p className="font-mono font-bold text-gray-900">{inv.invoiceNumber}</p>
                  </div>
                  {invTpl.showIssueDate !== false && (
                    <div className="meta-cell bg-gray-50 rounded-lg p-3">
                      <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Issue Date</label>
                      <p className="text-gray-800">{fmtDate(inv.issueDate)}</p>
                      {invTpl.showTime && <p className="text-[11px] text-gray-400 mt-0.5">{fmtTime(inv.createdAt ?? inv.issueDate)}</p>}
                    </div>
                  )}
                  <div className="meta-cell bg-gray-50 rounded-lg p-3">
                    <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Customer</label>
                    <p className="text-gray-800">{inv.customer?.name ?? <span className="italic text-gray-400">Walk-in</span>}</p>
                    {inv.customer?.phone && <p className="text-[11px] text-gray-400">{inv.customer.phone}</p>}
                  </div>
                  {inv.dueDate && (
                    <div className="meta-cell bg-gray-50 rounded-lg p-3">
                      <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Due Date</label>
                      <p className="text-gray-800">{fmtDate(inv.dueDate)}</p>
                    </div>
                  )}
                  {inv.paymentTerms && (
                    <div className="meta-cell bg-gray-50 rounded-lg p-3">
                      <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Payment Terms</label>
                      <p className="text-gray-800 text-sm font-medium">{inv.paymentTerms.replace(/_/g, ' ')}</p>
                    </div>
                  )}
                  {inv.poNumber && (
                    <div className="meta-cell bg-gray-50 rounded-lg p-3">
                      <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">PO Number</label>
                      <p className="font-mono text-gray-800 font-semibold">{inv.poNumber}</p>
                    </div>
                  )}
                  {inv.order && (
                    <div className="meta-cell bg-primary-50 rounded-lg p-3 border border-primary-100">
                      <label className="text-[11px] text-primary-400 uppercase tracking-wide mb-0.5">POS Order #</label>
                      <p className="font-mono text-primary-700 font-semibold">{inv.order.orderNumber}</p>
                    </div>
                  )}
                </div>

                {/* Line items */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Unit Price</th>
                          <th className="px-3 py-2 text-center">Disc%</th>
                          <th className="px-3 py-2 text-center">Tax%</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(inv.items ?? []).map((it: any) => (
                          <tr key={it.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800">{it.productName}</p>
                              {it.productSku && <p className="text-xs text-gray-400">{it.productSku}</p>}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600">{it.quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-600">₹{(it.unitPrice ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-center text-gray-500">
                              {(it.discountPercent ?? 0) > 0
                                ? <span className="text-green-600 font-medium">{it.discountPercent}%</span>
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-500">
                              {(it.taxRate ?? 0) > 0
                                ? <span className="text-blue-600 font-medium">{it.taxRate}%</span>
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">
                              ₹{(it.lineTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals + payment breakdown side by side */}
                <div className="flex gap-4">
                  {/* Payment breakdown (POS orders have order.payments) */}
                  {inv.order?.payments?.length > 0 && (
                    <div className="flex-1 bg-gray-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment Breakdown</p>
                      <div className="space-y-1.5 text-sm">
                        {inv.order.payments.map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-gray-600">
                            <span>{PAYMENT_LABELS[p.paymentMethod] ?? p.paymentMethod}
                              {p.referenceNumber ? <span className="text-gray-400 text-xs ml-1">({p.referenceNumber})</span> : ''}
                            </span>
                            <span className="font-medium">₹{(p.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                        {(inv.order.changeAmount ?? 0) > 0 && (
                          <div className="flex justify-between text-blue-600 font-semibold border-t pt-1.5 mt-1">
                            <span>Change Returned</span>
                            <span>₹{(inv.order.changeAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="flex-1 bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span>₹{(inv.subtotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {(inv.discountAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>−₹{(inv.discountAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {(inv.billDiscountAmt ?? 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Trade Discount ({inv.billDiscountPct}%)</span>
                        <span>−₹{(inv.billDiscountAmt ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {(inv.taxAmount ?? 0) > 0 && (() => {
                      const invItemsArr: any[] = inv.items ?? []
                      const invRates = [...new Set(invItemsArr.map((it: any) => Number(it.taxRate ?? 0)).filter((r: number) => r > 0))]
                      const invGstLbl = invRates.length === 1 ? `GST (${invRates[0]}%)` : 'GST'
                      return (
                        <div className="flex justify-between text-gray-500">
                          <span>{invGstLbl}</span>
                          <span>+₹{(inv.taxAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )
                    })()}
                    {(inv.shippingAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Freight / Shipping</span>
                        <span>+₹{(inv.shippingAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {(() => {
                      const invTotal = Number(inv.totalAmount ?? 0)
                      const invRounded = Math.round(invTotal)
                      const invRoundOff = parseFloat((invRounded - invTotal).toFixed(2))
                      if (invRoundOff === 0) return null
                      return (
                        <div className="flex justify-between text-gray-400 text-xs">
                          <span>Round Off</span>
                          <span>{invRoundOff > 0 ? '+' : ''}₹{invRoundOff.toFixed(2)}</span>
                        </div>
                      )
                    })()}
                    <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t">
                      <span>Total</span>
                      <span>₹{Math.round(inv.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {(inv.paidAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-green-600 font-semibold">
                        <span>{isPOS ? 'Paid' : 'Advance Collected'}</span>
                        <span>−₹{(inv.paidAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {balance > 0 && (
                      <div className="flex justify-between font-semibold text-red-600">
                        <span>Balance Due</span>
                        <span>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>

                {inv.notes && (
                  <div className="section bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{inv.notes}</p>
                  </div>
                )}

                {/* ── Template-driven sections ── */}
                {(invTpl.bankDetails || invTpl.showSignatureLine) && (
                  <div className="section flex gap-6 pt-4 border-t border-gray-100">
                    {invTpl.bankDetails && (
                      <div className="flex-1">
                        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Bank Details</h4>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{invTpl.bankDetails}</p>
                      </div>
                    )}
                    {invTpl.showSignatureLine && (
                      <div className="flex flex-col items-end justify-end shrink-0">
                        <div className="sig-box border-t border-gray-400 pt-2 text-center w-40">
                          <p className="text-xs text-gray-500">For {data?.outlet?.name}</p>
                          <p className="text-[10px] text-gray-400 mt-1">Authorised Signatory</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {invTpl.terms && (
                  <div className="section pt-3 border-t border-gray-100">
                    <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Terms & Conditions</h4>
                    <p className="text-xs text-gray-500 whitespace-pre-wrap">{invTpl.terms}</p>
                  </div>
                )}

                {/* Footer bar */}
                <div className="footer-bar mt-4 text-center border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400">{invTpl.thankYouMessage || 'Thank you for your business!'}</p>
                  {invTpl.footerNote && <p className="text-[10px] text-gray-400 mt-0.5">{invTpl.footerNote}</p>}
                </div>

              </div>
              {/* ── End printable content ── */}

            </div>
          ) : isError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400">
              <FileText size={32} className="opacity-40" />
              <p className="text-sm">Failed to load invoice. Please try again.</p>
              <button onClick={() => refetch()} className="text-xs text-primary-600 hover:underline">Retry</button>
            </div>
          ) : null}

          {/* Action buttons */}
          {inv && (
            <div className="px-6 py-4 border-t bg-gray-50 flex flex-wrap gap-2 shrink-0">
              {inv.status === 'DRAFT' && onEdit && (
                <button onClick={() => { onEdit(inv); onClose() }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                  <Edit2 size={13} /> Edit Draft
                </button>
              )}
              {inv.status === 'DRAFT' && (
                <button disabled={updating} onClick={() => changeStatus('SENT')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Send size={13} /> Send Invoice
                </button>
              )}
              {inv.customer?.email && (
                <button disabled={emailSending} onClick={handleSendEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  title={`Send email to ${inv.customer.email}`}>
                  {emailSending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                  Send Email
                </button>
              )}
              {(inv.status === 'SENT' || inv.status === 'PARTIAL' || inv.status === 'OVERDUE') && balance > 0 && (
                <button onClick={() => setShowPayment(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <CreditCard size={13} /> Record Payment
                </button>
              )}
              {inv.status === 'SENT' && (
                <button disabled={updating} onClick={() => changeStatus('OVERDUE')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                  <Clock size={13} /> Mark Overdue
                </button>
              )}
              {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                <button disabled={updating} onClick={() => changeStatus('CANCELLED')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100">
                  <Ban size={13} /> Cancel
                </button>
              )}
              {inv.status === 'DRAFT' && (
                <button disabled={deleting} onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 ml-auto">
                  {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete Draft
                </button>
              )}
              {inv.status === 'PAID' && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-700 bg-green-50 rounded-lg">
                  <CheckCircle size={13} /> Fully Paid
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {showPayment && inv && (
        <RecordPaymentModal
          invoice={inv}
          onClose={() => setShowPayment(false)}
          onDone={() => { refetch(); onUpdated() }}
        />
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const outletId = useAuthStore(s => s.user?.outletId ?? 1)
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab]                       = useState<'summary' | 'transactions'>('summary')
  const [statusTab, setStatusTab]           = useState('ALL')
  const [search, setSearch]                 = useState('')
  const [page, setPage]                     = useState(0)
  const [showCreate, setShowCreate]         = useState(false)
  const [editInvoice, setEditInvoice]       = useState<any | null>(null)
  const [collectInvoice, setCollectInvoice] = useState<any | null>(null)
  const [datePreset, setDatePreset]         = useState<DatePreset>('month')
  const [customFrom, setCustomFrom]         = useState('')
  const [customTo, setCustomTo]             = useState('')
  const [viewId, setViewId]                 = useState<number | null>(() => {
    const id = searchParams.get('invoiceId')
    return id ? parseInt(id) : null
  })
  const PAGE_SIZE = 15

  const dateRange = getDateRange(datePreset, { from: customFrom, to: customTo })

  // Clear the ?invoiceId param once the modal opens so the URL stays clean
  useEffect(() => {
    if (viewId && searchParams.has('invoiceId')) {
      setSearchParams({}, { replace: true })
    }
  }, [viewId])

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', outletId, statusTab, page, dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await invoiceApi.getByOutlet(outletId, {
        status: statusTab === 'ALL' ? undefined : statusTab,
        fromDate: dateRange.from || undefined,
        toDate:   dateRange.to   || undefined,
        page,
        size: PAGE_SIZE,
        sort: 'issueDate,desc',
      })
      return res.data.data
    },
  })

  // Separate large-page fetch for chart data (same filters, no pagination limit)
  const { data: chartRaw } = useQuery({
    queryKey: ['invoices-chart', outletId, dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await invoiceApi.getByOutlet(outletId, {
        fromDate: dateRange.from || undefined,
        toDate:   dateRange.to   || undefined,
        page: 0,
        size: 500,
        sort: 'issueDate,asc',
      })
      return (res.data.data?.content ?? []) as any[]
    },
  })

  const invoices: any[]   = data?.content ?? []
  const totalPages: number = data?.totalPages ?? 0
  const totalElements: number = data?.totalElements ?? 0

  const filtered = search.trim()
    ? invoices.filter(inv =>
        inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
        inv.customer?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : invoices

  function fmt(amt: number) {
    return '₹' + (amt ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
  }

  function shortNum(num: string) {
    if (!num) return '—'
    const parts = num.split('-')
    return parts[0] + '-…-' + parts[parts.length - 1]
  }

  function isOverdue(inv: any) {
    if (!inv.dueDate) return false
    if (inv.status !== 'SENT' && inv.status !== 'PARTIAL') return false
    return new Date(inv.dueDate) < new Date(new Date().toDateString())
  }

  // Summary KPIs (from chart raw data = all invoices for period, not just current page)
  const kpiSource      = chartRaw ?? invoices
  const totalInvoiced  = kpiSource.reduce((s: number, i: any) => s + parseFloat(String(i.totalAmount ?? 0)), 0)
  const totalPaid      = kpiSource.reduce((s: number, i: any) => s + parseFloat(String(i.paidAmount ?? 0)), 0)
  const totalOutstanding = kpiSource.reduce((s: number, i: any) => s + Math.max(0, parseFloat(String(i.totalAmount ?? 0)) - parseFloat(String(i.paidAmount ?? 0))), 0)
  const overdueCount   = kpiSource.filter((i: any) => i.status === 'OVERDUE' || isOverdue(i)).length

  // Bar chart: group by issueDate
  const barData = (() => {
    if (!chartRaw?.length) return []
    const map = new Map<string, { invoiced: number; paid: number }>()
    for (const inv of chartRaw) {
      const d = (inv.issueDate ?? '').substring(0, 10)
      if (!d) continue
      const cur = map.get(d) ?? { invoiced: 0, paid: 0 }
      cur.invoiced += parseFloat(String(inv.totalAmount ?? 0))
      cur.paid     += parseFloat(String(inv.paidAmount  ?? 0))
      map.set(d, cur)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => {
        const [y, m, dd] = date.substring(0, 10).split('-')
        return { date: `${dd}/${m}/${y}`, ...v }
      })
  })()

  // Pie chart: status distribution
  const pieData = (() => {
    if (!chartRaw?.length) return []
    const map = new Map<string, number>()
    for (const inv of chartRaw) {
      const s = inv.status ?? 'DRAFT'
      map.set(s, (map.get(s) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  })()

  const DATE_PRESETS: { value: DatePreset; label: string }[] = [
    { value: 'today',     label: 'Today' },
    { value: 'week',      label: 'This Week' },
    { value: 'month',     label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'quarter',   label: 'This Quarter' },
    { value: 'fy',        label: 'This FY' },
    { value: 'custom',    label: 'Custom' },
    { value: 'all',       label: 'All Time' },
  ]

  return (
    <div className="p-6 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
          <p className="text-xs text-gray-500 mt-0.5">Create and track customer invoices</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
          <Plus size={15} /> New Invoice
        </button>
      </div>

      {/* ── Date Filter ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar size={14} className="text-gray-400 shrink-0" />
        <div className="flex gap-1 flex-wrap">
          {DATE_PRESETS.map(p => (
            <button key={p.value}
              onClick={() => { setDatePreset(p.value); setPage(0) }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                datePreset === p.value
                  ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white border-transparent'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPage(0) }}
              className="border rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:ring-2 focus:ring-primary-400 outline-none" />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setPage(0) }}
              className="border rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:ring-2 focus:ring-primary-400 outline-none" />
          </div>
        )}
        {dateRange.from && dateRange.to && (
          <span className="text-xs text-gray-400 ml-1">{dateRange.from} → {dateRange.to}</span>
        )}
      </div>

      {/* ── Section Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-full p-1 w-fit">
        {(['summary', 'transactions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
              tab === t
                ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Summary Tab ── */}
      {tab === 'summary' && (<>
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 text-white shadow-lg">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -right-2 -bottom-6 w-28 h-28 rounded-full bg-white/5" />
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">Total Invoiced</p>
            <p className="text-2xl font-bold truncate">{fmt(totalInvoiced)}</p>
            <p className="text-[11px] text-white/60 mt-1">{kpiSource.length} invoice{kpiSource.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-emerald-500 via-green-500 to-teal-400 text-white shadow-lg">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -right-2 -bottom-6 w-28 h-28 rounded-full bg-white/5" />
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">Amount Received</p>
            <p className="text-2xl font-bold truncate">{fmt(totalPaid)}</p>
            <p className="text-[11px] text-white/60 mt-1">{totalInvoiced > 0 ? Math.round(totalPaid / totalInvoiced * 100) : 0}% collected</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 text-white shadow-lg">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -right-2 -bottom-6 w-28 h-28 rounded-full bg-white/5" />
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">Outstanding</p>
            <p className="text-2xl font-bold truncate">{fmt(totalOutstanding)}</p>
            <p className="text-[11px] text-white/60 mt-1">{totalInvoiced > 0 ? Math.round(totalOutstanding / totalInvoiced * 100) : 0}% pending</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-red-500 via-rose-500 to-pink-400 text-white shadow-lg">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -right-2 -bottom-6 w-28 h-28 rounded-full bg-white/5" />
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">Overdue</p>
            <p className="text-2xl font-bold">{overdueCount}</p>
            <p className="text-[11px] text-white/60 mt-1">past due date</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 bg-white rounded-2xl border p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Invoiced vs Collected</p>
            {barData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-gray-300 text-sm">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={barData} barCategoryGap="30%">
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: any, name: string) => [`₹${Number(v).toLocaleString('en-IN')}`, name === 'invoiced' ? 'Invoiced' : 'Collected']}
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="invoiced" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid"     fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Status Breakdown</p>
            {pieData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-gray-300 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" innerRadius={45} outerRadius={70}
                    dataKey="value" paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[entry.name] ?? '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, name: string) => [v, name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </>)}

      {/* ── Transactions Tab ── */}
      {tab === 'transactions' && (<>
        {/* Status Tabs + Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 bg-gray-100/80 rounded-2xl p-1.5 flex-wrap">
            {STATUS_TABS.map(s => (
              <button key={s} onClick={() => { setStatusTab(s); setPage(0) }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  statusTab === s
                    ? STATUS_TAB_ACTIVE[s]
                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/80'
                }`}>
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search invoice # or customer…"
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl w-full text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none bg-white shadow-sm" />
          </div>
          {totalElements > 0 && (
            <span className="text-xs text-gray-400 whitespace-nowrap">{totalElements} invoice{totalElements !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Invoice #</th>
                <th className="px-4 py-3 text-left">Order #</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center">Issue Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={11} className="py-16 text-center">
                  <Loader2 size={24} className="animate-spin text-gray-300 mx-auto" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="py-16 text-center">
                  <FileText size={36} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No invoices found</p>
                </td></tr>
              ) : filtered.map(inv => {
                const balance = (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0)
                return (
                  <tr key={inv.id} onClick={() => setViewId(inv.id)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <span title={inv.invoiceNumber} className="font-mono text-xs font-semibold text-primary-600">{shortNum(inv.invoiceNumber)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {inv.order?.orderNumber
                        ? <span className="flex items-center gap-1">
                            <ShoppingCart size={10} className="text-primary-400 shrink-0" />
                            <span title={inv.order.orderNumber} className="font-mono text-xs text-primary-600">{shortNum(inv.order.orderNumber)}</span>
                          </span>
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{inv.customer?.name ?? <span className="text-gray-400 italic">Walk-in</span>}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{inv.items?.length ?? 0}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">{fmt(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-green-600">{fmt(inv.paidAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {balance > 0
                        ? (inv.status === 'SENT' || inv.status === 'PARTIAL' || inv.status === 'OVERDUE')
                          ? <button onClick={e => { e.stopPropagation(); setCollectInvoice(inv) }}
                              className="text-red-500 hover:text-green-700 hover:underline transition-colors"
                              title="Click to collect payment">
                              {fmt(balance)}
                            </button>
                          : <span className="text-red-500">{fmt(balance)}</span>
                        : <span className="text-green-500">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{fmtDate(inv.issueDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {inv.status}
                        </span>
                        {isOverdue(inv) && (
                          <span title="Past due date" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
                            <AlertTriangle size={9} /> Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status === 'DRAFT' && (
                          <button onClick={e => { e.stopPropagation(); setEditInvoice(inv) }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Edit draft">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {balance > 0 && (inv.status === 'SENT' || inv.status === 'PARTIAL' || inv.status === 'OVERDUE') && (
                          <button onClick={e => { e.stopPropagation(); setCollectInvoice(inv) }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
                            title="Collect balance payment">
                            <CreditCard size={11} /> Collect
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <span className="text-xs text-gray-500">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg border text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft size={14} />
                </button>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg border text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </>)}

      {showCreate && (
        <CreateInvoicePanel
          outletId={outletId}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['invoices'] })}
        />
      )}
      {editInvoice && (
        <CreateInvoicePanel
          outletId={outletId}
          editInvoice={editInvoice}
          onClose={() => setEditInvoice(null)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['invoices'] })}
        />
      )}
      {viewId !== null && (
        <ViewInvoiceModal
          id={viewId}
          onClose={() => setViewId(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['invoices'] })}
          onEdit={inv => { setViewId(null); setEditInvoice(inv) }}
        />
      )}
      {collectInvoice && (
        <RecordPaymentModal
          invoice={collectInvoice}
          onClose={() => setCollectInvoice(null)}
          onDone={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); setCollectInvoice(null) }}
        />
      )}
    </div>
  )
}
