import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, FileText, X, Loader2, ChevronLeft, ChevronRight,
  Trash2, IndianRupee, CheckCircle, Send, Ban,
  ArrowRightCircle, Eye, Calendar, Mail,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import { quotationApi, productApi, integrationApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import CustomerSearchInput from '@/components/CustomerSearchInput'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SENT:      'bg-blue-50 text-blue-700',
  ACCEPTED:  'bg-green-50 text-green-700',
  REJECTED:  'bg-red-50 text-red-600',
  EXPIRED:   'bg-orange-50 text-orange-600',
  CONVERTED: 'bg-purple-50 text-purple-700',
}
const STATUS_TABS = ['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED']

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
        setResults(res.data.data ?? [])
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
          className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent focus:outline-none"
        />
        {loading && <Loader2 size={13} className="animate-spin text-gray-400 shrink-0" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-52 overflow-y-auto">
          {results.map((p: any) => (
            <button key={p.id} onMouseDown={() => { onSelect(p); setQuery(''); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400">{p.sku}</p>
              </div>
              <span className="text-sm font-semibold text-gray-700">₹{Number(p.sellingPrice ?? 0).toLocaleString('en-IN')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Create Quotation Panel ────────────────────────────────────────────────────

function CreateQuotationPanel({ outletId, onClose, onCreated }: {
  outletId: number
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [validUntil, setValidUntil] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('Prices are valid till the validity date. GST as applicable.')
  const [items, setItems] = useState<LineItem[]>([])

  const addProduct = (p: any) => {
    setItems(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      productId: p.id,
      productName: p.name,
      productSku: p.sku ?? '',
      quantity: 1,
      unitPrice: Number(p.sellingPrice ?? 0),
      discountPercent: 0,
      taxRate: Number(p.taxGroup?.rate ?? 0),
    }])
  }

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

  const totals = items.reduce((acc, item) => {
    const c = calcLine(item)
    return { subtotal: acc.subtotal + c.base, discount: acc.discount + c.disc, tax: acc.tax + c.tax, total: acc.total + c.total }
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 })

  const handleSave = async (sendAfter = false) => {
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      const res = await quotationApi.create({
        customerId: selectedCustomer?.id ?? null,
        outletId,
        validUntil,
        notes,
        termsConditions: terms,
        items: items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPercent: i.discountPercent,
          taxRate: i.taxRate,
        })),
      })
      if (sendAfter) {
        await quotationApi.updateStatus(res.data.data.id, 'SENT')
      }
      toast.success(sendAfter ? 'Quotation sent' : 'Quotation saved as draft')
      onCreated()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to create quotation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 left-[220px] bg-black/20 z-50 flex items-stretch">
      <div className="bg-gray-50 w-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Quotation</h2>
            <p className="text-xs text-gray-500 mt-0.5">Create a price quotation for a customer</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-5 gap-0 h-full">
            {/* Left: details */}
            <div className="col-span-2 border-r bg-white p-5 space-y-5">
              {/* Customer */}
              <CustomerSearchInput
                label="Customer"
                value={selectedCustomer}
                onSelect={setSelectedCustomer}
                onClear={() => setSelectedCustomer(null)}
              />

              {/* Valid Until */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  <Calendar size={11} className="inline mr-1" />Valid Until
                </label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="e.g. Special rates for bulk order…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-none" />
              </div>

              {/* Terms */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Terms & Conditions</label>
                <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-none" />
              </div>
            </div>

            {/* Right: line items */}
            <div className="col-span-3 p-5 flex flex-col gap-4">
              <ProductSearch onSelect={addProduct} />

              {/* Items list */}
              {items.length === 0 ? (
                <div className="flex-1 flex items-center justify-center flex-col gap-2 text-gray-300 border-2 border-dashed border-gray-200 rounded-xl py-16">
                  <FileText size={36} />
                  <p className="text-sm">Search and add products above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-12 gap-1 px-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    <div className="col-span-4">Product</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-center">Price</div>
                    <div className="col-span-2 text-center">Disc%</div>
                    <div className="col-span-1 text-center">Tax%</div>
                    <div className="col-span-1" />
                  </div>

                  {items.map(item => {
                    const { total } = calcLine(item)
                    return (
                      <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="grid grid-cols-12 gap-1 items-center">
                          <div className="col-span-4">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                            <p className="text-[11px] text-gray-400">{item.productSku}</p>
                          </div>
                          <div className="col-span-2">
                            <input type="number" min="1" value={item.quantity}
                              onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                              className="w-full text-center text-sm border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400" />
                          </div>
                          <div className="col-span-2">
                            <input type="number" min="0" value={item.unitPrice}
                              onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                              className="w-full text-center text-sm border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400" />
                          </div>
                          <div className="col-span-2">
                            <input type="number" min="0" max="100" value={item.discountPercent}
                              onChange={e => updateItem(item.id, 'discountPercent', Number(e.target.value))}
                              className="w-full text-center text-sm border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400" />
                          </div>
                          <div className="col-span-1">
                            <input type="number" min="0" max="100" value={item.taxRate}
                              onChange={e => updateItem(item.id, 'taxRate', Number(e.target.value))}
                              className="w-full text-center text-sm border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400" />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button onClick={() => removeItem(item.id)}
                              className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1.5 flex justify-end">
                          <span className="text-xs font-semibold text-primary-700">
                            ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Totals */}
              {items.length > 0 && (
                <div className="bg-white rounded-xl border p-4 mt-auto">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>₹{totals.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>− ₹{totals.discount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {totals.tax > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Tax</span>
                        <span>₹{totals.tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 text-base pt-1.5 border-t">
                      <span>Total</span>
                      <span>₹{totals.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 bg-white border-t flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => handleSave(false)} disabled={saving || items.length === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            Save as Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={saving || items.length === 0}
            className="px-5 py-2 text-sm font-medium bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Save & Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── View Quotation Modal ──────────────────────────────────────────────────────

function ViewQuotationModal({ id, onClose, onStatusChange }: { id: number; onClose: () => void; onStatusChange: () => void }) {
  const qc = useQueryClient()
  const { outletId } = useAuthStore()
  const [updating, setUpdating]         = useState(false)
  const [emailSending, setEmailSending] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationApi.getById(id).then(r => r.data.data),
  })

  const changeStatus = async (status: string) => {
    setUpdating(true)
    try {
      await quotationApi.updateStatus(id, status)
      toast.success(`Quotation ${status.toLowerCase()}`)
      qc.invalidateQueries({ queryKey: ['quotation', id] })
      onStatusChange()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const handleSendEmail = async () => {
    setEmailSending(true)
    try {
      await integrationApi.sendQuotationEmail(id, outletId!)
      toast.success(`Email sent to ${data?.customer?.email}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to send email')
    } finally { setEmailSending(false) }
  }

  const q = data

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">{q?.quotationNumber ?? '…'}</h2>
            {q?.status && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[q.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {q.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : q ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Customer</p>
                <p className="text-sm font-semibold text-gray-900">{q.customer?.name ?? 'Walk-in'}</p>
                {q.customer?.phone && <p className="text-xs text-gray-400">{q.customer.phone}</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Valid Until</p>
                <p className="text-sm font-semibold text-gray-900">
                  {q.validUntil ? format(new Date(q.validUntil), 'dd MMM yyyy') : '—'}
                </p>
                <p className="text-xs text-gray-400">Created: {format(new Date(q.createdAt), 'dd MMM yyyy')}</p>
              </div>
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Product</th>
                      <th className="px-4 py-2.5 text-center">Qty</th>
                      <th className="px-4 py-2.5 text-right">Unit Price</th>
                      <th className="px-4 py-2.5 text-center">Disc%</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {q.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          {item.productSku && <p className="text-xs text-gray-400">{item.productSku}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">₹{Number(item.unitPrice).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500">{item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">₹{Number(item.lineTotal).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{Number(q.subtotal).toLocaleString('en-IN')}</span></div>
                {Number(q.discountAmount) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>− ₹{Number(q.discountAmount).toLocaleString('en-IN')}</span></div>}
                {Number(q.taxAmount) > 0 && <div className="flex justify-between text-gray-600"><span>Tax</span><span>₹{Number(q.taxAmount).toLocaleString('en-IN')}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 border-t pt-1.5"><span>Total</span><span>₹{Number(q.totalAmount).toLocaleString('en-IN')}</span></div>
              </div>
            </div>

            {/* Notes & Terms */}
            {q.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-700">{q.notes}</p>
              </div>
            )}
            {q.termsConditions && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Terms & Conditions</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{q.termsConditions}</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Actions footer */}
        {q && (
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between shrink-0 rounded-b-2xl">
            <span className="text-xs text-gray-400">
              {q.items?.length} item(s) · ₹{Number(q.totalAmount).toLocaleString('en-IN')}
            </span>
            <div className="flex gap-2">
              {q.status === 'DRAFT' && (
                <button onClick={() => changeStatus('SENT')} disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Send size={12} /> Send
                </button>
              )}
              {q.status === 'SENT' && (
                <>
                  <button onClick={() => changeStatus('ACCEPTED')} disabled={updating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    <CheckCircle size={12} /> Accept
                  </button>
                  <button onClick={() => changeStatus('REJECTED')} disabled={updating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                    <Ban size={12} /> Reject
                  </button>
                </>
              )}
              {q.status === 'ACCEPTED' && (
                <button onClick={() => changeStatus('CONVERTED')} disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  <ArrowRightCircle size={12} /> Convert to Order
                </button>
              )}
              {q.customer?.email && (
                <button disabled={emailSending} onClick={handleSendEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  title={`Send email to ${q.customer.email}`}>
                  {emailSending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                  Send Email
                </button>
              )}
              {(updating || emailSending) && <Loader2 size={16} className="animate-spin text-gray-400 self-center" />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function QuotationsPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1
  const qc = useQueryClient()
  const [search, setSearch]           = useState('')
  const [statusTab, setStatusTab]     = useState('ALL')
  const [page, setPage]               = useState(0)
  const [showCreate, setShowCreate]   = useState(false)
  const [viewId, setViewId]           = useState<number | null>(null)
  const PAGE_SIZE = 15

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', oid, statusTab, page],
    queryFn: () => quotationApi.getByOutlet(oid, {
      status: statusTab === 'ALL' ? undefined : statusTab,
      page, size: PAGE_SIZE, sort: 'createdAt,desc',
    }).then(r => r.data.data),
    enabled: !!oid,
  })

  const quotations: any[]   = data?.content ?? []
  const totalPages: number  = data?.totalPages ?? 0
  const totalElements: number = data?.totalElements ?? 0

  const filtered = quotations.filter(q =>
    !search ||
    q.quotationNumber?.toLowerCase().includes(search.toLowerCase()) ||
    q.customer?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleStatusChange = () => qc.invalidateQueries({ queryKey: ['quotations'] })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quotations</h1>
          <p className="text-xs text-gray-500 mt-0.5 max-w-[180px]">Price quotations for customers</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={15} /> New Quotation
        </button>
      </div>

      {/* Status tabs + Search in one row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {STATUS_TABS.map(s => (
            <button key={s} onClick={() => { setStatusTab(s); setPage(0) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusTab === s ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search quotation # or customer…"
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        </div>
        {totalElements > 0 && (
          <span className="text-xs text-gray-400 whitespace-nowrap">{totalElements} quotation{totalElements !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Quotation #</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-center">Items</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Valid Until</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(8).fill(0).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <FileText size={36} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">
                    {search ? 'No quotations match your search' : 'No quotations yet'}
                  </p>
                  {!search && (
                    <button onClick={() => setShowCreate(true)}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                      Create first quotation →
                    </button>
                  )}
                </td>
              </tr>
            ) : filtered.map((q: any) => (
              <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm font-mono font-medium text-primary-600">{q.quotationNumber}</span>
                </td>
                <td className="px-4 py-3">
                  {q.customer ? (
                    <div>
                      <p className="text-sm text-gray-900">{q.customer.name}</p>
                      <p className="text-xs text-gray-400">{q.customer.phone}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Walk-in</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-700">{q.items?.length ?? 0}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  ₹{Number(q.totalAmount ?? 0).toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {q.validUntil ? format(new Date(q.validUntil), 'dd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[q.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {q.createdAt ? format(new Date(q.createdAt), 'dd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => setViewId(q.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="View">
                    <Eye size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-xs text-gray-500">Page {page + 1} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`w-7 h-7 text-xs rounded-lg border transition-colors ${pg === page ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                    {pg + 1}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateQuotationPanel
          outletId={oid}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['quotations'] })}
        />
      )}

      {viewId !== null && (
        <ViewQuotationModal
          id={viewId}
          onClose={() => setViewId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
