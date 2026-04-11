import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Tag, Pencil, Trash2, Loader2, X, Search,
  Calendar, Users, Package, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, AlertCircle, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { priceListApi, customerApi, productApi } from '@/services/api'
import { PriceList } from '@/types'

const SEGMENTS = ['REGULAR', 'SILVER', 'GOLD', 'VIP', 'WHOLESALE']

const SEGMENT_COLORS: Record<string, string> = {
  REGULAR: 'bg-gray-100 text-gray-700',
  SILVER: 'bg-slate-100 text-slate-700',
  GOLD: 'bg-yellow-100 text-yellow-700',
  VIP: 'bg-purple-100 text-purple-700',
  WHOLESALE: 'bg-blue-100 text-blue-700',
}

// ─── Price List Form Modal ─────────────────────────────────────────────────────
interface FormState {
  name: string
  description: string
  active: boolean
  priority: number
  startDate: string
  endDate: string
  segments: string[]
  customerIds: number[]
  items: Array<{
    productId: number
    variantId?: number
    productName: string
    variantName?: string
    basePrice: number
    sellingPrice: string
    discountPercent: string
    mode: 'price' | 'discount'
  }>
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  active: true,
  priority: 0,
  startDate: '',
  endDate: '',
  segments: [],
  customerIds: [],
  items: [],
}

function PriceListModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: PriceList | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (!editing) return EMPTY_FORM
    return {
      name: editing.name,
      description: editing.description ?? '',
      active: editing.active,
      priority: editing.priority,
      startDate: editing.startDate ? editing.startDate.split('T')[0] : '',
      endDate: editing.endDate ? editing.endDate.split('T')[0] : '',
      segments: editing.segments.map(s => s.segment),
      customerIds: editing.customers.map(c => c.customerId),
      items: editing.items.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
        productName: i.product.name,
        variantName: i.variant?.name,
        basePrice: i.product.sellingPrice,
        sellingPrice: i.sellingPrice?.toString() ?? '',
        discountPercent: i.discountPercent?.toString() ?? '',
        mode: i.sellingPrice !== undefined && i.sellingPrice !== null ? 'price' : 'discount',
      })),
    }
  })

  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)

  const { data: productResults } = useQuery({
    queryKey: ['product-search-pl', productSearch],
    queryFn: () => productApi.search(productSearch).then(r => r.data.data ?? []),
    enabled: productSearch.length >= 2,
  })

  const { data: customerResults } = useQuery({
    queryKey: ['customer-search-pl', customerSearch],
    queryFn: () => customerApi.search(customerSearch).then(r => r.data.data ?? []),
    enabled: customerSearch.length >= 2,
  })

  function addProduct(p: any, variant?: any) {
    const existing = form.items.find(i => i.productId === p.id && i.variantId === variant?.id)
    if (existing) { toast.error('Product already in list'); return }
    setForm(f => ({
      ...f,
      items: [...f.items, {
        productId: p.id,
        variantId: variant?.id,
        productName: p.name,
        variantName: variant?.name,
        basePrice: parseFloat(p.sellingPrice),
        sellingPrice: '',
        discountPercent: '',
        mode: 'price',
      }],
    }))
    setProductSearch('')
    setShowProductSearch(false)
  }

  function removeItem(idx: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  function updateItem(idx: number, field: string, value: any) {
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }))
  }

  function addCustomer(c: any) {
    if (form.customerIds.includes(c.id)) return
    setForm(f => ({ ...f, customerIds: [...f.customerIds, c.id] }))
    setCustomerSearch('')
    setShowCustomerSearch(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (form.segments.length === 0 && form.customerIds.length === 0) {
      toast.error('Select at least one customer segment or specific customer')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        active: form.active,
        priority: form.priority,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        segments: form.segments,
        customerIds: form.customerIds,
        items: form.items
          .filter(i => i.mode === 'price' ? i.sellingPrice !== '' : i.discountPercent !== '')
          .map(i => ({
            productId: i.productId,
            variantId: i.variantId || null,
            sellingPrice: i.mode === 'price' && i.sellingPrice !== '' ? parseFloat(i.sellingPrice) : null,
            discountPercent: i.mode === 'discount' && i.discountPercent !== '' ? parseFloat(i.discountPercent) : null,
          })),
      }

      if (editing) {
        await priceListApi.update(editing.id, payload)
        toast.success('Price list updated')
      } else {
        await priceListApi.create(payload)
        toast.success('Price list created')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to save price list')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <Tag size={16} className="text-primary-600" />
            </div>
            <h2 className="font-bold text-gray-900">{editing ? 'Edit Price List' : 'New Price List'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Wholesale Pricing, VIP Members"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Priority</label>
              <input type="number" value={form.priority} min={0}
                onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              <p className="text-xs text-gray-400 mt-1">Higher priority lists are applied first</p>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))}>
                {form.active
                  ? <ToggleRight size={28} className="text-green-500" />
                  : <ToggleLeft size={28} className="text-gray-400" />}
              </button>
              <span className="text-sm font-medium text-gray-700">{form.active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1.5">
                <Calendar size={13} /> Start Date (optional)
              </label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1.5">
                <Calendar size={13} /> End Date (optional)
              </label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
          </div>

          {/* Customer segments */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-1.5">
              <Users size={13} /> Applies To — Customer Segments
            </label>
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map(seg => {
                const active = form.segments.includes(seg)
                return (
                  <button key={seg} type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      segments: active ? f.segments.filter(s => s !== seg) : [...f.segments, seg],
                    }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                      active
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {active && <Check size={11} />}
                    {seg}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">This price list automatically applies at checkout for customers in the selected segments.</p>
          </div>

          {/* Specific customers */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-1.5">
              <Users size={13} /> Specific Customers (optional)
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); setShowCustomerSearch(true) }}
                onFocus={() => setShowCustomerSearch(true)}
                placeholder="Search customer by name or phone…"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              {showCustomerSearch && customerResults && customerResults.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {(customerResults as any[]).map((c: any) => (
                    <button key={c.id} type="button" onClick={() => addCustomer(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-gray-400 text-xs">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.customerIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.customerIds.map(cid => {
                  const cust = (editing?.customers ?? []).find(c => c.customerId === cid)
                  return (
                    <span key={cid} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                      {cust?.customer.name ?? `Customer #${cid}`}
                      <button type="button" onClick={() => setForm(f => ({ ...f, customerIds: f.customerIds.filter(id => id !== cid) }))} className="hover:text-red-500"><X size={10} /></button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Product pricing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Package size={13} /> Product Pricing Rules
              </label>
              <button type="button" onClick={() => setShowProductSearch(s => !s)}
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
                <Plus size={12} /> Add Product
              </button>
            </div>

            {showProductSearch && (
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  autoFocus
                  placeholder="Search product by name or SKU…"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                {productResults && (productResults as any[]).length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {(productResults as any[]).map((p: any) => (
                      <div key={p.id}>
                        <button type="button" onClick={() => addProduct(p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-gray-400 text-xs">₹{p.sellingPrice}</span>
                        </button>
                        {p.variants?.filter((v: any) => v.active).map((v: any) => (
                          <button key={v.id} type="button" onClick={() => addProduct(p, v)}
                            className="w-full text-left pl-8 pr-3 py-1.5 text-xs hover:bg-blue-50 text-gray-600 flex items-center justify-between border-t border-gray-50">
                            <span>↳ {v.name}</span>
                            <span className="text-gray-400">₹{(parseFloat(p.sellingPrice) + parseFloat(v.priceAdjustment)).toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {form.items.length === 0 ? (
              <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                <Package size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No products added. Leave empty to skip product-specific pricing.</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Product / Variant</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Base Price</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Mode</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Value</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => (
                      <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          {item.variantName && <p className="text-gray-400">↳ {item.variantName}</p>}
                        </td>
                        <td className="px-3 py-2 text-gray-600">₹{item.basePrice.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <select value={item.mode}
                            onChange={e => updateItem(idx, 'mode', e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400">
                            <option value="price">Fixed Price</option>
                            <option value="discount">Discount %</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {item.mode === 'price' ? (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">₹</span>
                              <input type="number" value={item.sellingPrice}
                                onChange={e => updateItem(idx, 'sellingPrice', e.target.value)}
                                step="0.01" min="0" placeholder={item.basePrice.toFixed(2)}
                                className="w-24 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary-400 focus:outline-none" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input type="number" value={item.discountPercent}
                                onChange={e => updateItem(idx, 'discountPercent', e.target.value)}
                                step="0.5" min="0" max="100" placeholder="0"
                                className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary-400 focus:outline-none" />
                              <span className="text-gray-400">%</span>
                              {item.discountPercent && (
                                <span className="text-green-600 font-medium">
                                  → ₹{(item.basePrice * (1 - parseFloat(item.discountPercent) / 100)).toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeItem(idx)}
                            className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                            <Trash2 size={12} />
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editing ? 'Save Changes' : 'Create Price List'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PriceListsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PriceList | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data: priceLists = [], isLoading } = useQuery<PriceList[]>({
    queryKey: ['price-lists'],
    queryFn: () => priceListApi.getAll().then(r => r.data.data ?? []),
  })

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['price-lists'] })
    setShowModal(false)
    setEditing(null)
  }

  const handleEdit = (pl: PriceList) => {
    setEditing(pl)
    setShowModal(true)
  }

  const handleToggleActive = async (pl: PriceList) => {
    try {
      await priceListApi.toggleActive(pl.id)
      qc.invalidateQueries({ queryKey: ['price-lists'] })
      toast.success(pl.active ? 'Price list deactivated' : 'Price list activated')
    } catch { toast.error('Failed to update') }
  }

  const handleDelete = async (pl: PriceList) => {
    if (!confirm(`Delete price list "${pl.name}"? This cannot be undone.`)) return
    try {
      await priceListApi.delete(pl.id)
      qc.invalidateQueries({ queryKey: ['price-lists'] })
      toast.success('Price list deleted')
    } catch { toast.error('Failed to delete') }
  }

  const activeLists = priceLists.filter(p => p.active)
  const inactiveLists = priceLists.filter(p => !p.active)

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
              <Tag size={18} className="text-primary-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-none">Price Lists</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeLists.length} active · {inactiveLists.length} inactive
              </p>
            </div>
          </div>
          <button
            onClick={() => { setEditing(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Price List
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <strong>How price lists work:</strong> Assign a price list to customer segments (REGULAR, GOLD, VIP, etc.) or specific customers. At checkout, the highest-priority applicable price list is used to override product prices automatically.
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary-600" size={32} />
          </div>
        ) : priceLists.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <Tag size={48} className="mx-auto mb-4 text-gray-200" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No price lists yet</h3>
            <p className="text-gray-500 text-sm mb-4">Create a price list to offer special pricing to specific customer segments.</p>
            <button onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium">
              <Plus size={16} /> Create First Price List
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {priceLists.map(pl => (
              <div key={pl.id} className={`bg-white rounded-xl border transition-all ${pl.active ? 'border-gray-200' : 'border-gray-100 opacity-70'}`}>
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <button type="button" onClick={() => setExpanded(expanded === pl.id ? null : pl.id)}
                    className="text-gray-400 hover:text-gray-600 shrink-0">
                    {expanded === pl.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{pl.name}</h3>
                      {!pl.active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Inactive</span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Priority {pl.priority}</span>
                    </div>
                    {pl.description && <p className="text-sm text-gray-500 mt-0.5">{pl.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {pl.segments.map(s => (
                        <span key={s.segment} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEGMENT_COLORS[s.segment] ?? 'bg-gray-100 text-gray-600'}`}>
                          {s.segment}
                        </span>
                      ))}
                      {pl.customers.length > 0 && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                          {pl.customers.length} specific customer{pl.customers.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {pl.items.length > 0 && (
                        <span className="text-xs text-gray-400">{pl.items.length} product rule{pl.items.length !== 1 ? 's' : ''}</span>
                      )}
                      {pl.startDate && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(pl.startDate).toLocaleDateString()} – {pl.endDate ? new Date(pl.endDate).toLocaleDateString() : '∞'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => handleToggleActive(pl)}
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                      title={pl.active ? 'Deactivate' : 'Activate'}>
                      {pl.active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                    </button>
                    <button type="button" onClick={() => handleEdit(pl)}
                      className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => handleDelete(pl)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Expanded product rules */}
                {expanded === pl.id && pl.items.length > 0 && (
                  <div className="px-5 pb-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-2">Product Pricing Rules</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-1.5 px-2 font-medium text-gray-500">Product</th>
                            <th className="text-left py-1.5 px-2 font-medium text-gray-500">Base Price</th>
                            <th className="text-left py-1.5 px-2 font-medium text-gray-500">Special Price</th>
                            <th className="text-left py-1.5 px-2 font-medium text-gray-500">Saving</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pl.items.map(item => {
                            const base = item.product.sellingPrice
                            const special = item.sellingPrice ?? (item.discountPercent != null ? base * (1 - item.discountPercent / 100) : null)
                            const saving = special != null ? base - special : null
                            return (
                              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-1.5 px-2">
                                  <p className="font-medium text-gray-900">{item.product.name}</p>
                                  {item.variant && <p className="text-gray-400">↳ {item.variant.name}</p>}
                                  {item.product.sku && <p className="text-gray-400">{item.product.sku}</p>}
                                </td>
                                <td className="py-1.5 px-2 text-gray-600">₹{base.toFixed(2)}</td>
                                <td className="py-1.5 px-2 text-green-600 font-semibold">
                                  {item.sellingPrice != null
                                    ? `₹${item.sellingPrice.toFixed(2)}`
                                    : item.discountPercent != null
                                    ? `${item.discountPercent}% off → ₹${special?.toFixed(2)}`
                                    : '—'}
                                </td>
                                <td className="py-1.5 px-2">
                                  {saving != null && saving > 0 && (
                                    <span className="text-green-600 font-medium">−₹{saving.toFixed(2)}</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {pl.customers.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Specific Customers</p>
                        <div className="flex flex-wrap gap-1.5">
                          {pl.customers.map(c => (
                            <span key={c.customerId} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              {c.customer.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <PriceListModal
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
