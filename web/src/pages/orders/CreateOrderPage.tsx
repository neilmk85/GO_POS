import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Plus, Minus, Trash2,
  ShoppingBag, Loader2, CreditCard, DollarSign, Smartphone,
  ChevronDown, Tag, FileText, User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { productApi, orderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { Product, Customer } from '@/types'
import CustomerSearchInput from '@/components/CustomerSearchInput'

// ─── Types ────────────────────────────────────────────────────────────────────

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

const ORDER_TYPES = ['RETAIL', 'TAKEAWAY', 'DELIVERY', 'DINE_IN', 'ONLINE']
const PAYMENT_METHODS = [
  { method: 'CASH',  label: 'Cash',  icon: <DollarSign size={16} /> },
  { method: 'CARD',  label: 'Card',  icon: <CreditCard size={16} /> },
  { method: 'UPI',   label: 'UPI',   icon: <Smartphone size={16} /> },
]

function calcLineTotal(item: Omit<LineItem, 'lineTotal'>): number {
  const disc  = item.unitPrice * (item.discountPercent / 100)
  const base  = (item.unitPrice - disc) * item.quantity
  const tax   = base * (item.taxRate / 100)
  return parseFloat((base + tax).toFixed(2))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateOrderPage() {
  const navigate  = useNavigate()
  const { outletId } = useAuthStore()

  // Transition
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Items
  const [items, setItems] = useState<LineItem[]>([])

  // Product search
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [showDrop, setShowDrop]   = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropRef   = useRef<HTMLDivElement>(null)

  // Customer
  const [customer, setCustomer] = useState<Customer | null>(null)

  // Order meta
  const [orderType, setOrderType] = useState('RETAIL')
  const [coupon, setCoupon]       = useState('')
  const [notes, setNotes]         = useState('')

  // Payment
  const [payMethod, setPayMethod] = useState('CASH')
  const [cashGiven, setCashGiven] = useState('')
  const [payRef, setPayRef]       = useState('')

  // Submit
  const [placing, setPlacing] = useState(false)

  // ── Product search ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowDrop(false); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await productApi.search(query)
        setResults(res.data.data || [])
        setShowDrop(true)
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        searchRef.current && !searchRef.current.contains(e.target as Node)
      ) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function addProduct(p: Product) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === p.id)
      if (idx >= 0) {
        const updated = [...prev]
        const item = { ...updated[idx], quantity: updated[idx].quantity + 1 }
        item.lineTotal = calcLineTotal(item)
        updated[idx] = item
        return updated
      }
      const taxRate = parseFloat(String((p.taxGroup as any)?.totalRate ?? 0)) || 0
      const unitPrice = parseFloat(String(p.sellingPrice)) || 0
      const newItem: LineItem = {
        productId: p.id, productName: p.name, sku: p.sku,
        unitPrice, quantity: 1,
        discountPercent: 0, taxRate,
        lineTotal: calcLineTotal({ productId: p.id, productName: p.name, sku: p.sku,
          unitPrice, quantity: 1, discountPercent: 0, taxRate }),
      }
      return [...prev, newItem]
    })
    setQuery('')
    setShowDrop(false)
    searchRef.current?.focus()
  }

  function updateQty(idx: number, delta: number) {
    setItems(prev => {
      const updated = [...prev]
      const item = { ...updated[idx], quantity: Math.max(1, updated[idx].quantity + delta) }
      item.lineTotal = calcLineTotal(item)
      updated[idx] = item
      return updated
    })
  }

  function setQty(idx: number, val: number) {
    if (isNaN(val) || val < 1) return
    setItems(prev => {
      const updated = [...prev]
      const item = { ...updated[idx], quantity: val }
      item.lineTotal = calcLineTotal(item)
      updated[idx] = item
      return updated
    })
  }

  function setDiscount(idx: number, val: number) {
    const d = Math.min(100, Math.max(0, val || 0))
    setItems(prev => {
      const updated = [...prev]
      const item = { ...updated[idx], discountPercent: d }
      item.lineTotal = calcLineTotal(item)
      updated[idx] = item
      return updated
    })
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Totals ──────────────────────────────────────────────────────────────────

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const discountAmt = items.reduce((s, i) => {
    const d = i.unitPrice * (i.discountPercent / 100) * i.quantity
    return s + d
  }, 0)
  const taxAmt = items.reduce((s, i) => {
    const base = (i.unitPrice - i.unitPrice * i.discountPercent / 100) * i.quantity
    return s + base * (i.taxRate / 100)
  }, 0)
  const total = parseFloat((subtotal - discountAmt + taxAmt).toFixed(2))
  const change = payMethod === 'CASH' ? Math.max(0, (parseFloat(cashGiven) || 0) - total) : 0

  // ── Place order ─────────────────────────────────────────────────────────────

  async function handlePlaceOrder() {
    if (items.length === 0) { toast.error('Add at least one product'); return }
    setPlacing(true)
    try {
      const payload = {
        outletId,
        customerId: customer?.id,
        orderType,
        couponCode: coupon.trim() || undefined,
        notes: notes.trim() || undefined,
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPercent: i.discountPercent,
        })),
        payments: [{
          paymentMethod: payMethod,
          amount: total,
          referenceNumber: payRef.trim() || undefined,
        }],
      }
      const res = await orderApi.checkout(payload)
      toast.success(`Order ${res.data.data?.orderNumber ?? ''} placed!`)
      navigate('/orders')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to place order')
    } finally {
      setPlacing(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-full bg-gray-50"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(40px)',
        transition: 'opacity 220ms ease, transform 280ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
            <ShoppingBag size={18} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">New Order</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {items.length === 0 ? 'Add products to get started' : `${items.length} item${items.length > 1 ? 's' : ''} · ₹${total.toFixed(2)}`}
            </p>
          </div>
        </div>
        <div className="ml-auto flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={placing || items.length === 0}
            className="px-5 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            {placing && <Loader2 size={15} className="animate-spin" />}
            Place Order
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-6xl mx-auto p-6 grid grid-cols-5 gap-5">

        {/* ── Left: Products ── */}
        <div className="col-span-3 space-y-4">

          {/* Product search */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setShowDrop(true)}
                placeholder="Search products by name, SKU or barcode…"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                autoFocus
              />

              {/* Dropdown */}
              {showDrop && results.length > 0 && (
                <div
                  ref={dropRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-72 overflow-auto"
                >
                  {results.map(p => (
                    <button
                      key={p.id}
                      onMouseDown={() => addProduct(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-primary-600">₹{p.sellingPrice}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ShoppingBag size={40} className="mb-3 opacity-30" />
                <p className="text-sm">No items yet — search and add products above</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-center w-32">Qty</th>
                    <th className="px-4 py-3 text-right w-24">Price</th>
                    <th className="px-4 py-3 text-center w-24">Disc %</th>
                    <th className="px-4 py-3 text-right w-24">Total</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={item.productId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                        {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => updateQty(idx, -1)}
                            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => setQty(idx, parseInt(e.target.value))}
                            className="w-12 text-center text-sm border border-gray-300 rounded-lg py-1 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                          />
                          <button
                            onClick={() => updateQty(idx, 1)}
                            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">₹{item.unitPrice.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discountPercent}
                          onChange={e => setDiscount(idx, parseFloat(e.target.value))}
                          className="w-16 mx-auto block text-center text-sm border border-gray-300 rounded-lg py-1 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">₹{item.lineTotal.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              <FileText size={13} /> Order Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Special instructions or notes…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* ── Right: Customer + Summary + Payment ── */}
        <div className="col-span-2 space-y-4">

          {/* Customer */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <User size={13} /> Customer
            </p>
            <CustomerSearchInput
              value={customer}
              onSelect={c => setCustomer(c as Customer)}
              onClear={() => setCustomer(null)}
              placeholder="Search customer (optional)…"
            />
          </div>

          {/* Order Type */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order Type</p>
            <div className="relative">
              <select
                value={orderType}
                onChange={e => setOrderType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none appearance-none pr-8"
              >
                {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Coupon */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Tag size={13} /> Coupon
            </p>
            <input
              value={coupon}
              onChange={e => setCoupon(e.target.value)}
              placeholder="Enter coupon code"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span><span>-₹{discountAmt.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Tax</span><span>₹{taxAmt.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                <span>Total</span><span>₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Method</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.method}
                  onClick={() => { setPayMethod(pm.method); setPayRef(''); setCashGiven('') }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-medium transition-colors ${
                    payMethod === pm.method
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {pm.icon} {pm.label}
                </button>
              ))}
            </div>

            {payMethod === 'CASH' && (
              <div className="space-y-2">
                <input
                  type="number"
                  value={cashGiven}
                  onChange={e => setCashGiven(e.target.value)}
                  placeholder={`Cash received (₹${total.toFixed(2)})`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
                {change > 0 && (
                  <div className="flex justify-between bg-green-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-green-700">Change</span>
                    <span className="text-green-700 font-bold">₹{change.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {(payMethod === 'UPI' || payMethod === 'CARD') && (
              <input
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
                placeholder={payMethod === 'UPI' ? 'UPI Transaction ID (optional)' : 'Card Approval Code (optional)'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            )}
          </div>

          {/* Place Order button (bottom) */}
          <button
            onClick={handlePlaceOrder}
            disabled={placing || items.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
          >
            {placing
              ? <><Loader2 size={18} className="animate-spin" /> Placing…</>
              : <><ShoppingBag size={18} /> Place Order · ₹{total.toFixed(2)}</>}
          </button>
        </div>
      </div>

    </div>
  )
}
