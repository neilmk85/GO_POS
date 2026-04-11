import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingBag, Loader2,
  User, FileText, Truck, CreditCard, ChevronDown, AlertCircle,
  Package, Tag, CalendarDays, Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { salesOrderApi, productApi, customerApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineItem {
  productId: number
  productName: string
  sku?: string
  unitPrice: number
  quantity: number
  discountPercent: number
  taxRate: number
  lineTotal: number
}

const PAYMENT_TERMS = ['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Advance', 'Custom']

function calcLine(item: Omit<LineItem, 'lineTotal'>): number {
  const disc = item.unitPrice * (item.discountPercent / 100)
  const base = (item.unitPrice - disc) * item.quantity
  const tax  = base * (item.taxRate / 100)
  return parseFloat((base + tax).toFixed(2))
}

// ── Customer search widget ────────────────────────────────────────────────────
function CustomerPicker({ value, onSelect, onClear }: { value: any; onSelect: (c: any) => void; onClear: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try { const r = await customerApi.search(query); setResults(r.data.data ?? []) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  if (value) return (
    <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl p-3">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
        {value.name?.[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{value.name}</p>
        <p className="text-xs text-gray-500">{value.phone} {value.gstin ? `· GSTIN: ${value.gstin}` : ''}</p>
        {value.creditLimit > 0 && (
          <p className="text-xs text-violet-600 font-medium mt-0.5">
            Credit: ₹{parseFloat(value.creditLimit).toLocaleString('en-IN')} · Due: ₹{parseFloat(value.outstandingDue).toLocaleString('en-IN')}
          </p>
        )}
      </div>
      <button onClick={onClear} className="text-gray-400 hover:text-red-500 shrink-0 text-xs">Change</button>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:border-violet-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-100 transition-all">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
          placeholder="Search customer by name or phone…"
          className="flex-1 text-sm bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none" />
        {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
      </div>
      {open && (query.trim().length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {results.length === 0 && !loading
            ? <p className="text-xs text-gray-400 text-center py-4">No customers found</p>
            : results.map((c: any) => (
              <button key={c.id} onMouseDown={() => { onSelect(c); setQuery(''); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xs shrink-0">
                  {c.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.phone} {c.gstin ? `· ${c.gstin}` : ''}</p>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

// ── Product search widget ─────────────────────────────────────────────────────
function ProductSearch({ onAdd }: { onAdd: (p: any) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try { const r = await productApi.search(query); setResults(r.data.data ?? []) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 border-2 border-dashed border-violet-200 rounded-xl px-4 py-3 bg-violet-50/50 hover:border-violet-400 focus-within:border-violet-500 focus-within:bg-white transition-all">
        <Search size={15} className="text-violet-400 shrink-0" />
        <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
          placeholder="Search and add product by name, SKU or barcode…"
          className="flex-1 text-sm bg-transparent text-gray-700 placeholder-violet-400 focus:outline-none" />
        {loading && <Loader2 size={14} className="animate-spin text-violet-400" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-64 overflow-auto">
          {results.map((p: any) => (
            <button key={p.id} onMouseDown={() => { onAdd(p); setQuery(''); inputRef.current?.focus() }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-violet-50 text-left transition-colors border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400">{p.sku} {p.taxGroup ? `· GST ${p.taxGroup.totalRate}%` : ''}</p>
              </div>
              <div className="text-right ml-4 shrink-0">
                <p className="text-sm font-bold text-violet-700">₹{parseFloat(p.sellingPrice).toLocaleString('en-IN')}</p>
                {p.mrp && <p className="text-xs text-gray-400 line-through">₹{parseFloat(p.mrp).toFixed(2)}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreateSalesOrderPage() {
  const navigate = useNavigate()
  const { outletId, user } = useAuthStore()

  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t) }, [])

  const [customer, setCustomer] = useState<any>(null)
  const [customerPoNumber, setCustomerPoNumber] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [requiredDate, setRequiredDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingAmount, setShippingAmount] = useState('0')
  const [advanceAmount, setAdvanceAmount] = useState('0')
  const [notes, setNotes] = useState('')
  const [termsConditions, setTermsConditions] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [placing, setPlacing] = useState(false)

  function addProduct(p: any) {
    const taxRate = parseFloat(String(p.taxGroup?.totalRate ?? 0)) || 0
    const unitPrice = parseFloat(String(p.sellingPrice)) || 0
    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === p.id)
      if (idx >= 0) {
        const updated = [...prev]
        const item = { ...updated[idx], quantity: updated[idx].quantity + 1 }
        item.lineTotal = calcLine(item)
        updated[idx] = item
        return updated
      }
      const newItem: LineItem = { productId: p.id, productName: p.name, sku: p.sku, unitPrice, quantity: 1, discountPercent: 0, taxRate, lineTotal: calcLine({ productId: p.id, productName: p.name, sku: p.sku, unitPrice, quantity: 1, discountPercent: 0, taxRate }) }
      return [...prev, newItem]
    })
  }

  function updateItem(idx: number, field: keyof LineItem, val: number) {
    setItems(prev => {
      const updated = [...prev]
      const item = { ...updated[idx], [field]: val }
      item.lineTotal = calcLine(item)
      updated[idx] = item
      return updated
    })
  }

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const discountAmt = items.reduce((s, i) => s + i.unitPrice * i.discountPercent / 100 * i.quantity, 0)
  const taxAmt = items.reduce((s, i) => s + (i.unitPrice * (1 - i.discountPercent / 100) * i.quantity * i.taxRate / 100), 0)
  const shipping = parseFloat(shippingAmount) || 0
  const advance = parseFloat(advanceAmount) || 0
  const total = subtotal - discountAmt + taxAmt + shipping

  // GST label: show % if all items share same rate
  const orderTaxRates = [...new Set(items.map(i => i.taxRate).filter(r => r > 0))]
  const gstLabel = orderTaxRates.length === 1 ? `GST (${orderTaxRates[0]}%)` : 'GST'

  // Rounding off
  const roundedOrderTotal = Math.round(total)
  const orderRoundOff = parseFloat((roundedOrderTotal - total).toFixed(2))
  const balanceDue = total - advance

  // Credit limit check
  const creditWarning = customer?.creditLimit > 0
    ? total > (parseFloat(customer.creditLimit) - parseFloat(customer.outstandingDue))
    : false

  async function handleSubmit() {
    if (!customer) { toast.error('Please select a customer'); return }
    if (items.length === 0) { toast.error('Add at least one product'); return }
    if (creditWarning) { toast.error('Order exceeds customer credit limit'); return }
    setPlacing(true)
    try {
      const res = await salesOrderApi.create({
        customerId: customer.id,
        outletId,
        customerPoNumber: customerPoNumber || undefined,
        orderDate,
        requiredDate: requiredDate || undefined,
        paymentTerms,
        shippingAddress: shippingAddress || undefined,
        shippingCity: shippingCity || undefined,
        shippingState: shippingState || undefined,
        shippingAmount: parseFloat(shippingAmount) || 0,
        advanceAmount: parseFloat(advanceAmount) || 0,
        notes: notes || undefined,
        termsConditions: termsConditions || undefined,
        items: items.map(i => ({
          productId: i.productId, productName: i.productName, sku: i.sku,
          quantity: i.quantity, unitPrice: i.unitPrice,
          discountPercent: i.discountPercent, taxRate: i.taxRate,
        })),
      })
      toast.success(`${res.data.data?.soNumber} created!`)
      navigate(`/sales-orders/${res.data.data?.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to create sales order')
    } finally { setPlacing(false) }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/20 to-violet-50/20"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'all 280ms cubic-bezier(0.22,1,0.36,1)' }}>

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <button onClick={() => navigate('/sales-orders')}
          className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
            <ShoppingBag size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">New Sales Order</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {items.length === 0 ? 'Add customer & products to get started' : `${items.length} item${items.length > 1 ? 's' : ''} · ₹${total.toFixed(2)}`}
            </p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate('/sales-orders')}
            className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={placing || !customer || items.length === 0 || creditWarning}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-200 transition-all hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2">
            {placing ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Create Sales Order
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-5 gap-5">

        {/* ── Left col: Customer + Products ── */}
        <div className="col-span-3 space-y-5">

          {/* Customer card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-100 to-blue-100 border-b border-violet-100 px-5 py-3 flex items-center gap-2">
              <User size={15} className="text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-700">Customer</h3>
              <span className="ml-1 text-xs text-red-500">*</span>
            </div>
            <div className="p-5 space-y-3">
              <CustomerPicker value={customer} onSelect={setCustomer} onClear={() => setCustomer(null)} />
              {creditWarning && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0" />
                  Order total exceeds available credit limit — please adjust the order or check with customer
                </div>
              )}
              <input value={customerPoNumber} onChange={e => setCustomerPoNumber(e.target.value)}
                placeholder="Customer PO Number (reference from their Purchase Order)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
            </div>
          </div>

          {/* Product search + line items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-100 to-blue-100 border-b border-violet-100 px-5 py-3 flex items-center gap-2">
              <Package size={15} className="text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-700">Order Items</h3>
              <span className="ml-1 text-xs text-red-500">*</span>
            </div>
            <div className="p-5 space-y-4">
              <ProductSearch onAdd={addProduct} />
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                  <ShoppingBag size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">No items yet — search and add products above</p>
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100 text-xs text-gray-600 uppercase">
                        <th className="px-4 py-2.5 text-left">Product</th>
                        <th className="px-3 py-2.5 text-center w-28">Qty</th>
                        <th className="px-3 py-2.5 text-right w-24">Price</th>
                        <th className="px-3 py-2.5 text-center w-20">Disc%</th>
                        <th className="px-3 py-2.5 text-right w-24">Total</th>
                        <th className="px-3 py-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-violet-50/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                            <p className="text-xs text-gray-400">{item.sku} {item.taxRate > 0 ? `· GST ${item.taxRate}%` : ''}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => updateItem(idx, 'quantity', Math.max(1, item.quantity - 1))}
                                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-violet-100 flex items-center justify-center transition-colors">
                                <Minus size={11} />
                              </button>
                              <input type="number" min={1} value={item.quantity}
                                onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-12 text-center text-sm border border-gray-200 rounded-lg py-0.5 focus:ring-1 focus:ring-violet-400 focus:outline-none" />
                              <button onClick={() => updateItem(idx, 'quantity', item.quantity + 1)}
                                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-violet-100 flex items-center justify-center transition-colors">
                                <Plus size={11} />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <input type="number" min={0} value={item.unitPrice}
                              onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full text-right text-sm border border-gray-200 rounded-lg px-2 py-0.5 focus:ring-1 focus:ring-violet-400 focus:outline-none" />
                          </td>
                          <td className="px-3 py-2.5">
                            <input type="number" min={0} max={100} value={item.discountPercent}
                              onChange={e => updateItem(idx, 'discountPercent', parseFloat(e.target.value) || 0)}
                              className="w-full text-center text-sm border border-gray-200 rounded-lg px-2 py-0.5 focus:ring-1 focus:ring-violet-400 focus:outline-none" />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-sm font-bold text-gray-900">₹{item.lineTotal.toFixed(2)}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                              className="text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-100 to-blue-100 border-b border-violet-100 px-5 py-3 flex items-center gap-2">
              <FileText size={15} className="text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-700">Notes & Terms</h3>
            </div>
            <div className="p-5 space-y-3">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Internal notes or instructions…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none resize-none" />
              <textarea value={termsConditions} onChange={e => setTermsConditions(e.target.value)} rows={2}
                placeholder="Terms & conditions (printed on order document)…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none resize-none" />
            </div>
          </div>
        </div>

        {/* ── Right col: Dates, Shipping, Summary ── */}
        <div className="col-span-2 space-y-4">

          {/* Order details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-100 to-blue-100 border-b border-violet-100 px-5 py-3 flex items-center gap-2">
              <CalendarDays size={15} className="text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-700">Order Details</h3>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Order Date</label>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Required Delivery Date</label>
                <input type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Payment Terms</label>
                <div className="relative">
                  <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none appearance-none pr-8">
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Shipping */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-100 to-blue-100 border-b border-violet-100 px-5 py-3 flex items-center gap-2">
              <Truck size={15} className="text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-700">Shipping Details</h3>
            </div>
            <div className="p-5 space-y-3">
              <textarea value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} rows={2}
                placeholder="Delivery address…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <input value={shippingCity} onChange={e => setShippingCity(e.target.value)} placeholder="City"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
                <input value={shippingState} onChange={e => setShippingState(e.target.value)} placeholder="State"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Shipping Charges (₹)</label>
                <input type="number" min={0} value={shippingAmount} onChange={e => setShippingAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-100 to-blue-100 border-b border-violet-100 px-5 py-3 flex items-center gap-2">
              <Tag size={15} className="text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-700">Order Summary</h3>
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              {discountAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{discountAmt.toFixed(2)}</span></div>}
              {taxAmt > 0 && <div className="flex justify-between text-gray-600"><span>{gstLabel}</span><span>₹{taxAmt.toFixed(2)}</span></div>}
              {shipping > 0 && <div className="flex justify-between text-gray-600"><span>Shipping</span><span>₹{shipping.toFixed(2)}</span></div>}
              {orderRoundOff !== 0 && (
                <div className="flex justify-between text-gray-400 text-xs"><span>Round Off</span><span>{orderRoundOff > 0 ? '+' : ''}₹{orderRoundOff.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2.5 mt-1">
                <span>Total</span>
                <span className={`${creditWarning ? 'text-red-600' : 'text-gray-900'}`}>₹{roundedOrderTotal.toFixed(2)}</span>
              </div>
              {/* Advance */}
              <div className="border-t border-dashed border-gray-100 pt-2.5 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Advance Collected (₹)</label>
                  <input
                    type="number" min={0} value={advanceAmount}
                    onChange={e => setAdvanceAmount(e.target.value)}
                    className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-violet-400 focus:outline-none"
                  />
                </div>
                {advance > 0 && (
                  <div className="flex justify-between font-semibold text-sm">
                    <span className="text-gray-600">Balance Due</span>
                    <span className={balanceDue < 0 ? 'text-red-600' : 'text-violet-700'}>₹{balanceDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
              {customer?.creditLimit > 0 && (
                <div className={`text-xs rounded-xl px-3 py-2 flex items-start gap-1.5 ${creditWarning ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                  <Info size={12} className="mt-0.5 shrink-0" />
                  <span>Credit available: ₹{(parseFloat(customer.creditLimit) - parseFloat(customer.outstandingDue)).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={placing || !customer || items.length === 0 || creditWarning}
            className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-200 hover:shadow-xl hover:-translate-y-0.5 text-sm">
            {placing
              ? <><Loader2 size={17} className="animate-spin" /> Creating…</>
              : <><ShoppingBag size={17} /> Create Sales Order · ₹{total.toFixed(2)}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
