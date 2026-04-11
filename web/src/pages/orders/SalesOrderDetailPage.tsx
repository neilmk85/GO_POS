import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CheckCircle2, Truck, FileText, XCircle, AlertCircle,
  ShoppingBag, Loader2, Package, User, Calendar, CreditCard,
  MapPin, Clock, Edit2, Receipt, ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { salesOrderApi } from '@/services/api'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:               { label: 'Draft',             color: 'text-gray-600',   bg: 'bg-gray-100',    border: 'border-gray-200' },
  CONFIRMED:           { label: 'Confirmed',          color: 'text-blue-700',   bg: 'bg-blue-50',     border: 'border-blue-200' },
  PROCESSING:          { label: 'Processing',         color: 'text-amber-700',  bg: 'bg-amber-50',    border: 'border-amber-200' },
  PARTIALLY_DELIVERED: { label: 'Partially Delivered',color: 'text-purple-700', bg: 'bg-purple-50',   border: 'border-purple-200' },
  DELIVERED:           { label: 'Delivered',          color: 'text-teal-700',   bg: 'bg-teal-50',     border: 'border-teal-200' },
  INVOICED:            { label: 'Invoiced',           color: 'text-green-700',  bg: 'bg-green-50',    border: 'border-green-200' },
  CANCELLED:           { label: 'Cancelled',          color: 'text-red-600',    bg: 'bg-red-50',      border: 'border-red-200' },
  ON_HOLD:             { label: 'On Hold',            color: 'text-orange-700', bg: 'bg-orange-50',   border: 'border-orange-200' },
}

// ── Timeline steps ────────────────────────────────────────────────────────────
const TIMELINE = [
  { status: 'DRAFT',               label: 'Draft Created',   icon: <FileText size={14} /> },
  { status: 'CONFIRMED',           label: 'Order Confirmed', icon: <CheckCircle2 size={14} /> },
  { status: 'PARTIALLY_DELIVERED', label: 'Dispatched',      icon: <Truck size={14} /> },
  { status: 'DELIVERED',           label: 'Delivered',       icon: <Package size={14} /> },
  { status: 'INVOICED',            label: 'Invoiced',        icon: <Receipt size={14} /> },
]

const STATUS_ORDER = ['DRAFT', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED']

// ── Deliver Modal ─────────────────────────────────────────────────────────────
function DeliverModal({ so, onClose, onDone }: { so: any; onClose: () => void; onDone: () => void }) {
  const [deliveredItems, setDeliveredItems] = useState<Record<number, string>>(
    Object.fromEntries(so.items.map((i: any) => [i.id, String(
      Math.max(0, parseFloat(i.quantity) - parseFloat(i.deliveredQuantity))
    )]))
  )
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  async function handleDeliver() {
    const payload = Object.entries(deliveredItems)
      .filter(([, qty]) => parseFloat(qty) > 0)
      .map(([itemId, deliveredQty]) => ({ itemId: parseInt(itemId), deliveredQty: parseFloat(deliveredQty) }))
    if (!payload.length) { toast.error('Enter at least one delivery quantity'); return }
    setLoading(true)
    try {
      await salesOrderApi.deliver(so.id, { deliveredItems: payload, deliveryDate })
      toast.success('Delivery recorded successfully')
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to record delivery')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
              <Truck size={17} className="text-teal-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Record Delivery</h3>
              <p className="text-xs text-gray-500">Enter quantity delivered for each item</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Delivery Date</label>
            <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 focus:outline-none" />
          </div>
          <div className="space-y-2">
            {so.items.map((item: any) => {
              const remaining = parseFloat(item.quantity) - parseFloat(item.deliveredQuantity)
              return (
                <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-500">Ordered: {parseFloat(item.quantity)} · Delivered: {parseFloat(item.deliveredQuantity)} · Remaining: {remaining.toFixed(2)}</p>
                  </div>
                  <input type="number" min={0} max={remaining}
                    value={deliveredItems[item.id] ?? '0'}
                    onChange={e => setDeliveredItems(p => ({ ...p, [item.id]: e.target.value }))}
                    className="w-20 text-center border border-gray-200 rounded-lg py-1.5 text-sm focus:ring-1 focus:ring-teal-400 focus:outline-none font-semibold"
                    disabled={remaining <= 0} />
                </div>
              )
            })}
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleDeliver} disabled={loading}
              className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Truck size={15} />} Record Delivery
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Invoice Modal ─────────────────────────────────────────────────────────────
function InvoiceModal({ so, onClose, onDone }: { so: any; onClose: () => void; onDone: () => void }) {
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await salesOrderApi.generateInvoice(so.id, { dueDate: dueDate || undefined, notes: notes || undefined })
      toast.success(`Invoice ${res.data.data?.invoiceNumber} generated!`)
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to generate invoice')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
              <Receipt size={17} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Generate Invoice</h3>
              <p className="text-xs text-gray-500">Create billing document for this order</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Invoice will be generated for <strong>delivered items only</strong>. Undelivered items won't be billed.</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Payment Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Invoice Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400 focus:outline-none resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleGenerate} disabled={loading}
              className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />} Generate Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main detail page ──────────────────────────────────────────────────────────
export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showDeliver, setShowDeliver] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => salesOrderApi.getById(parseInt(id!)).then(r => r.data.data),
    enabled: !!id,
  })

  const so = data

  function refresh() { qc.invalidateQueries({ queryKey: ['sales-order', id] }); qc.invalidateQueries({ queryKey: ['sales-orders'] }) }

  async function handleConfirm() {
    setConfirming(true)
    try {
      await salesOrderApi.confirm(parseInt(id!))
      toast.success('Order confirmed!')
      refresh()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to confirm order')
    } finally { setConfirming(false) }
  }

  async function handleCancel() {
    if (!confirm('Cancel this sales order?')) return
    setCancelling(true)
    try {
      await salesOrderApi.cancel(parseInt(id!))
      toast.success('Order cancelled')
      refresh()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to cancel order')
    } finally { setCancelling(false) }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-full">
      <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  )

  if (!so) return (
    <div className="flex flex-col items-center justify-center min-h-full text-gray-400">
      <ShoppingBag size={40} className="mb-3 opacity-30" />
      <p>Sales order not found</p>
    </div>
  )

  const cfg = STATUS_CONFIG[so.status] ?? STATUS_CONFIG.DRAFT
  const currentIdx = STATUS_ORDER.indexOf(so.status)
  const isCancelled = so.status === 'CANCELLED'
  const isEditable  = so.status === 'DRAFT'
  const canConfirm  = so.status === 'DRAFT'
  const canDeliver  = ['CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED'].includes(so.status)
  const canInvoice  = ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED'].includes(so.status)
  const canCancel   = !['DELIVERED', 'INVOICED', 'CANCELLED'].includes(so.status)

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/20 to-violet-50/20">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <button onClick={() => navigate('/sales-orders')}
          className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0">
            <ShoppingBag size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900 font-mono">{so.soNumber}</h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                {cfg.label}
              </span>
              {so.customerPoNumber && (
                <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded-md">
                  PO: {so.customerPoNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Created {format(new Date(so.createdAt), 'dd MMM yyyy, hh:mm a')}
              {so.createdByUser && ` by ${so.createdByUser.name}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isEditable && (
            <button onClick={() => navigate(`/sales-orders/${so.id}/edit`)}
              className="px-4 py-2 border border-violet-300 text-violet-700 hover:bg-violet-50 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors">
              <Edit2 size={14} /> Edit Order
            </button>
          )}
          {canCancel && !isCancelled && (
            <button onClick={handleCancel} disabled={cancelling}
              className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5">
              {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Cancel
            </button>
          )}
          {canConfirm && (
            <button onClick={handleConfirm} disabled={confirming}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors">
              {confirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirm Order
            </button>
          )}
          {canDeliver && (
            <button onClick={() => setShowDeliver(true)}
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-sm">
              <Truck size={14} /> Record Delivery
            </button>
          )}
          {canInvoice && (
            <button onClick={() => setShowInvoice(true)}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-sm shadow-violet-200">
              <Receipt size={14} /> Generate Invoice
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-5 gap-5">

        {/* ── Left: items + timeline ── */}
        <div className="col-span-3 space-y-5">

          {/* Status timeline */}
          {!isCancelled && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-100 z-0" />
                {TIMELINE.map((step, i) => {
                  const stepIdx = STATUS_ORDER.indexOf(step.status)
                  const done = currentIdx >= stepIdx
                  const active = STATUS_ORDER[currentIdx] === step.status || (step.status === 'PARTIALLY_DELIVERED' && so.status === 'PARTIALLY_DELIVERED')
                  return (
                    <div key={step.status} className="flex flex-col items-center gap-2 z-10">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        done
                          ? 'bg-gradient-to-br from-violet-500 to-blue-600 border-transparent text-white shadow-md shadow-violet-200'
                          : 'bg-white border-gray-200 text-gray-300'
                      }`}>
                        {step.icon}
                      </div>
                      <p className={`text-xs font-semibold text-center leading-tight ${done ? 'text-violet-700' : 'text-gray-400'}`}>{step.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Line items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-50 to-blue-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-violet-600" />
                <h3 className="text-sm font-semibold text-gray-700">Order Items</h3>
              </div>
              <span className="text-xs bg-violet-100 text-violet-700 font-semibold px-2.5 py-1 rounded-full">
                {so.items.length} item{so.items.length !== 1 ? 's' : ''}
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70 text-xs text-gray-500 uppercase">
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-center">Ordered</th>
                  <th className="px-4 py-3 text-center">Delivered</th>
                  <th className="px-4 py-3 text-center">Invoiced</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {so.items.map((item: any) => {
                  const ordered   = parseFloat(item.quantity)
                  const delivered = parseFloat(item.deliveredQuantity)
                  const invoiced  = parseFloat(item.invoicedQuantity)
                  const pct = ordered > 0 ? (delivered / ordered) * 100 : 0
                  return (
                    <tr key={item.id} className="hover:bg-violet-50/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-400">{item.sku} {parseFloat(item.taxRate) > 0 ? `· GST ${parseFloat(item.taxRate)}%` : ''}</p>
                        {/* Delivery progress bar */}
                        <div className="mt-1.5 w-32 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-teal-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-semibold text-gray-700">{ordered}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-sm font-semibold ${delivered >= ordered ? 'text-teal-600' : delivered > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{delivered}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-sm font-semibold ${invoiced >= ordered ? 'text-green-600' : invoiced > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{invoiced}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <p className="text-sm text-gray-700">₹{parseFloat(item.unitPrice).toFixed(2)}</p>
                        {parseFloat(item.discountPercent) > 0 && <p className="text-xs text-green-600">-{parseFloat(item.discountPercent)}%</p>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-bold text-gray-900">₹{parseFloat(item.lineTotal).toFixed(2)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Totals */}
            {(() => {
              const subtotal      = parseFloat(so.subtotal)
              const discountAmt   = parseFloat(so.discountAmount)
              const taxAmt        = parseFloat(so.taxAmount)
              const shippingAmt   = parseFloat(so.shippingAmount)
              const advanceAmt    = parseFloat(so.advanceAmount)
              const rawTotal      = subtotal - discountAmt + taxAmt + shippingAmt
              const rounded       = Math.round(rawTotal)
              const roundingOff   = parseFloat((rounded - rawTotal).toFixed(2))
              const finalTotal    = rounded

              // GST breakdown by rate
              const gstMap: Record<string, number> = {}
              so.items.forEach((item: any) => {
                const rate = parseFloat(item.taxRate)
                if (rate > 0) {
                  const base = parseFloat(item.unitPrice) * (1 - parseFloat(item.discountPercent) / 100) * parseFloat(item.quantity)
                  const tax = parseFloat((base * rate / 100).toFixed(2))
                  gstMap[rate] = (gstMap[rate] || 0) + tax
                }
              })

              return (
                <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-slate-50 border-t border-gray-100 space-y-1.5">
                  <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  {discountAmt > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-₹{discountAmt.toFixed(2)}</span></div>}
                  {Object.entries(gstMap).map(([rate, amt]) => (
                    <div key={rate} className="flex justify-between text-sm text-gray-600">
                      <span>GST {rate}%</span><span>₹{amt.toFixed(2)}</span>
                    </div>
                  ))}
                  {Object.keys(gstMap).length === 0 && taxAmt > 0 && (
                    <div className="flex justify-between text-sm text-gray-600"><span>Tax (GST)</span><span>₹{taxAmt.toFixed(2)}</span></div>
                  )}
                  {shippingAmt > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Shipping</span><span>₹{shippingAmt.toFixed(2)}</span></div>}
                  {roundingOff !== 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Rounding Off</span><span>{roundingOff > 0 ? '+' : ''}₹{roundingOff.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-200 pt-2 mt-1">
                    <span>Total</span><span>₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {advanceAmt > 0 && (
                    <div className="border-t border-dashed border-gray-200 pt-2 mt-1 space-y-1.5">
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Advance Collected</span><span>-₹{advanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm text-violet-700">
                        <span>Balance Due</span><span>₹{(finalTotal - advanceAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Notes */}
          {(so.notes || so.termsConditions) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              {so.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{so.notes}</p>
                </div>
              )}
              {so.termsConditions && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Terms & Conditions</p>
                  <p className="text-sm text-gray-600">{so.termsConditions}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: info cards ── */}
        <div className="col-span-2 space-y-4">

          {/* Customer */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-50 to-blue-50 border-b border-gray-100 px-5 py-3 flex items-center gap-2">
              <User size={14} className="text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-700">Customer</h3>
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {so.customer?.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{so.customer?.name}</p>
                  <p className="text-sm text-gray-500">{so.customer?.phone}</p>
                  {so.customer?.email && <p className="text-xs text-gray-400">{so.customer.email}</p>}
                  {so.customer?.gstin && <p className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1 inline-block">GSTIN: {so.customer.gstin}</p>}
                  {parseFloat(so.customer?.creditLimit) > 0 && (
                    <div className="mt-2 bg-violet-50 rounded-xl p-2.5">
                      <p className="text-xs font-semibold text-violet-700">Credit: ₹{parseFloat(so.customer.creditLimit).toLocaleString('en-IN')}</p>
                      <p className="text-xs text-violet-500">Due: ₹{parseFloat(so.customer.outstandingDue ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Order info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-50 to-blue-50 border-b border-gray-100 px-5 py-3 flex items-center gap-2">
              <Calendar size={14} className="text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-700">Order Info</h3>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Order Date',    value: format(new Date(so.orderDate), 'dd MMM yyyy'), icon: <Calendar size={13} /> },
                so.requiredDate ? { label: 'Required By', value: format(new Date(so.requiredDate), 'dd MMM yyyy'), icon: <Clock size={13} />, warn: new Date(so.requiredDate) < new Date() && !['DELIVERED','INVOICED','CANCELLED'].includes(so.status) } : null,
                so.deliveryDate ? { label: 'Delivered On', value: format(new Date(so.deliveryDate), 'dd MMM yyyy'), icon: <Truck size={13} /> } : null,
                so.paymentTerms ? { label: 'Payment Terms', value: so.paymentTerms, icon: <CreditCard size={13} /> } : null,
              ].filter(Boolean).map((row: any, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500 text-xs">{row.icon} {row.label}</div>
                  <span className={`text-sm font-semibold ${row.warn ? 'text-red-600' : 'text-gray-800'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping */}
          {(so.shippingAddress || so.shippingCity) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-violet-50 to-blue-50 border-b border-gray-100 px-5 py-3 flex items-center gap-2">
                <MapPin size={14} className="text-violet-600" />
                <h3 className="text-sm font-semibold text-gray-700">Delivery Address</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {[so.shippingAddress, so.shippingCity, so.shippingState].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Quick action guide */}
          <div className="bg-gradient-to-br from-violet-500 to-blue-600 rounded-2xl p-5 text-white">
            <p className="text-sm font-bold mb-3">Next Steps</p>
            <div className="space-y-2">
              {canConfirm && (
                <div className="flex items-center gap-2 text-xs bg-white/20 rounded-xl px-3 py-2">
                  <CheckCircle2 size={13} /> Confirm the order to lock it in
                </div>
              )}
              {canDeliver && (
                <div className="flex items-center gap-2 text-xs bg-white/20 rounded-xl px-3 py-2">
                  <Truck size={13} /> Record delivery once goods are dispatched
                </div>
              )}
              {canInvoice && (
                <div className="flex items-center gap-2 text-xs bg-white/20 rounded-xl px-3 py-2">
                  <Receipt size={13} /> Generate invoice to bill the customer
                </div>
              )}
              {so.status === 'INVOICED' && (
                <div className="flex items-center gap-2 text-xs bg-white/20 rounded-xl px-3 py-2">
                  <CheckCircle2 size={13} /> Order fully invoiced — collect payment
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDeliver && <DeliverModal so={so} onClose={() => setShowDeliver(false)} onDone={() => { setShowDeliver(false); refresh() }} />}
      {showInvoice && <InvoiceModal so={so} onClose={() => setShowInvoice(false)} onDone={() => { setShowInvoice(false); refresh() }} />}
    </div>
  )
}
