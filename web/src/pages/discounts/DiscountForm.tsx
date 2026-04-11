import { useState, useRef, useEffect } from 'react'
import { X, Loader2, Search, Package, LayoutGrid, ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { discountApi, categoryApi, productApi } from '@/services/api'
import { Discount } from '@/types'
import DateTimePicker from '@/components/DateTimePicker'

interface Props {
  discount: Discount | null
  onClose: () => void
  onSaved: () => void
}

export default function DiscountForm({ discount, onClose, onSaved }: Props) {
  const existing = discount as any

  const [form, setForm] = useState({
    name:           existing?.name           || '',
    description:    existing?.description    || '',
    discountType:   existing?.discountType   || 'AUTOMATIC',
    applyOn:        existing?.applyOn        || 'PRODUCT',
    valueType:      existing?.valueType      || 'PERCENTAGE',
    value:          existing?.value          || 0,
    minOrderAmount: existing?.minOrderAmount ?? 0,
    startDate:      existing?.startDate      ? existing.startDate.slice(0, 16) : '',
    endDate:        existing?.endDate        ? existing.endDate.slice(0, 16)   : '',
    active:         existing?.active         ?? true,
    stackable:      existing?.stackable      ?? false,
    priority:       existing?.priority       ?? 0,
  })

  // Multi-select products
  const [selectedProducts, setSelectedProducts] = useState<{ id: number; name: string; sku?: string }[]>(
    existing?.products ?? []
  )
  // Multi-select categories
  const [selectedCategories, setSelectedCategories] = useState<{ id: number; name: string }[]>(
    existing?.categories ?? []
  )

  // Product search state
  const [productSearch, setProductSearch] = useState('')
  const [showProductDrop, setShowProductDrop] = useState(false)
  const [productResults, setProductResults] = useState<any[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const productInputRef = useRef<HTMLInputElement>(null)
  const productDropRef  = useRef<HTMLDivElement>(null)

  // Category dropdown state
  const [showCatDrop, setShowCatDrop] = useState(false)
  const catDropRef = useRef<HTMLDivElement>(null)
  const catBtnRef  = useRef<HTMLButtonElement>(null)

  const [loading, setLoading] = useState(false)

  // Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories-all'],
    queryFn:  () => categoryApi.getAll(true).then(r => r.data.data ?? []),
    staleTime: 60_000,
  })

  // Product search with debounce
  useEffect(() => {
    if (form.applyOn !== 'PRODUCT') return
    if (!productSearch.trim()) { setProductResults([]); return }
    setSearchingProducts(true)
    const t = setTimeout(() => {
      productApi.search(productSearch)
        .then(r => setProductResults(r.data.data ?? []))
        .finally(() => setSearchingProducts(false))
    }, 300)
    return () => clearTimeout(t)
  }, [productSearch, form.applyOn])

  // Close product dropdown on outside click
  useEffect(() => {
    if (!showProductDrop) return
    const handler = (e: MouseEvent) => {
      if (productDropRef.current && !productDropRef.current.contains(e.target as Node) &&
          productInputRef.current && !productInputRef.current.contains(e.target as Node)) {
        setShowProductDrop(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showProductDrop])

  // Close category dropdown on outside click
  useEffect(() => {
    if (!showCatDrop) return
    const handler = (e: MouseEvent) => {
      if (catDropRef.current && !catDropRef.current.contains(e.target as Node) &&
          catBtnRef.current && !catBtnRef.current.contains(e.target as Node)) {
        setShowCatDrop(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCatDrop])

  const addProduct = (p: any) => {
    if (!selectedProducts.find(x => x.id === p.id)) {
      setSelectedProducts(prev => [...prev, { id: p.id, name: p.name, sku: p.sku }])
    }
    setProductSearch('')
    setShowProductDrop(false)
  }

  const removeProduct = (id: number) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== id))
  }

  const toggleCategory = (cat: any) => {
    setSelectedCategories(prev =>
      prev.find(c => c.id === cat.id)
        ? prev.filter(c => c.id !== cat.id)
        : [...prev, { id: cat.id, name: cat.name }]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.applyOn === 'PRODUCT' && selectedProducts.length === 0) {
      toast.error('Please select at least one product'); return
    }
    if (form.applyOn === 'CATEGORY' && selectedCategories.length === 0) {
      toast.error('Please select at least one category'); return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        startDate:   form.startDate || null,
        endDate:     form.endDate   || null,
        productIds:  selectedProducts.map(p => p.id),
        categoryIds: selectedCategories.map(c => c.id),
      }
      if (discount) {
        await discountApi.update(discount.id, payload)
        toast.success('Discount updated')
      } else {
        await discountApi.create(payload)
        toast.success('Discount created')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">{discount ? 'Edit Discount' : 'Create Discount / Offer'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
              placeholder="e.g. Diwali Sale 20%"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>

          {/* Apply On + Discount Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apply On</label>
              <select
                value={form.applyOn}
                onChange={(e) => {
                  setForm({ ...form, applyOn: e.target.value as any })
                  setSelectedProducts([])
                  setSelectedCategories([])
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="PRODUCT">Product</option>
                <option value="CATEGORY">Category</option>
                <option value="CART">Cart (entire bill)</option>
                <option value="CUSTOMER">Customer segment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                {['AUTOMATIC', 'MANUAL', 'PROMOTIONAL', 'FESTIVAL', 'LOYALTY'].map(v => (
                  <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Multi-product selector */}
          {form.applyOn === 'PRODUCT' && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1.5"><Package size={13} /> Select Products *</span>
              </label>

              {/* Selected product chips */}
              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedProducts.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-1 bg-sky-100 text-sky-700 text-xs font-medium px-2.5 py-1 rounded-full">
                      {p.name}
                      <button type="button" onClick={() => removeProduct(p.id)} className="ml-0.5 hover:text-sky-900">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  ref={productInputRef}
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDrop(true) }}
                  onFocus={() => setShowProductDrop(true)}
                  placeholder="Search and add products..."
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
                {searchingProducts && <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
              </div>

              {showProductDrop && productResults.length > 0 && (
                <div ref={productDropRef}
                  className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {productResults
                    .filter(p => !selectedProducts.find(s => s.id === p.id))
                    .map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); addProduct(p) }}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary-50 text-left text-sm gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{p.name}</p>
                          {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                        </div>
                        <span className="text-xs font-semibold text-primary-600 shrink-0">₹{p.sellingPrice}</span>
                      </button>
                    ))}
                </div>
              )}

              {selectedProducts.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">Search and select one or more products</p>
              )}
            </div>
          )}

          {/* Multi-category selector */}
          {form.applyOn === 'CATEGORY' && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1.5"><LayoutGrid size={13} /> Select Categories *</span>
              </label>

              {/* Selected category chips */}
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedCategories.map(c => (
                    <span key={c.id} className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
                      {c.name}
                      <button type="button" onClick={() => toggleCategory(c)} className="ml-0.5 hover:text-emerald-900">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Dropdown toggle */}
              <button
                ref={catBtnRef}
                type="button"
                onClick={() => setShowCatDrop(v => !v)}
                className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 hover:border-primary-400 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <span className="text-gray-400">
                  {selectedCategories.length > 0 ? `${selectedCategories.length} selected` : 'Choose categories...'}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${showCatDrop ? 'rotate-180' : ''}`} />
              </button>

              {showCatDrop && (
                <div ref={catDropRef}
                  className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {(categories as any[]).map((cat: any) => {
                    const checked = !!selectedCategories.find(c => c.id === cat.id)
                    return (
                      <label key={cat.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(cat)}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <span className={`font-medium ${checked ? 'text-emerald-700' : 'text-gray-700'}`}>{cat.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {selectedCategories.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">Select one or more categories</p>
              )}
            </div>
          )}

          {/* Cart / Customer note */}
          {form.applyOn === 'CART' && (
            <div className="text-xs text-gray-500 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
              This discount applies automatically to the entire cart when the minimum order amount is met.
            </div>
          )}
          {form.applyOn === 'CUSTOMER' && (
            <div className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              This discount will apply automatically when a customer is selected at POS.
            </div>
          )}

          {/* Value Type + Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value Type</label>
              <select value={form.valueType} onChange={(e) => setForm({ ...form, valueType: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value * {form.valueType === 'PERCENTAGE' ? '(%)' : '(₹)'}
              </label>
              <input type="number" step="0.01" min="0" value={form.value}
                onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) })} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
          </div>

          {/* Min Order + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Amount (₹)</label>
              <input type="number" step="0.01" min="0" value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: parseFloat(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <input type="number" min="0" value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <DateTimePicker
              label="Start Date"
              value={form.startDate}
              onChange={(v) => setForm({ ...form, startDate: v })}
              max={form.endDate || undefined}
            />
            <DateTimePicker
              label="End Date"
              value={form.endDate}
              onChange={(v) => setForm({ ...form, endDate: v })}
              min={form.startDate || undefined}
            />
          </div>

          {/* Active + Stackable */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded" />
              <span className="text-sm text-gray-700">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded" />
              <span className="text-sm text-gray-700">Stackable</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 py-2.5 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {discount ? 'Update' : 'Create'} Discount
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
