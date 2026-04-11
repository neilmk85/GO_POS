import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Tag, Ticket, Edit, Trash2, ToggleLeft, ToggleRight, Calendar, ShoppingCart, Percent, IndianRupee, AlertTriangle, Package, LayoutGrid, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { discountApi } from '@/services/api'
import { Discount, Coupon } from '@/types'
import DiscountForm from './DiscountForm'
import CouponForm from './CouponForm'

const APPLY_ON_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PRODUCT:  { label: 'Product',  bg: 'bg-sky-100',    text: 'text-sky-700',    dot: 'bg-sky-400' },
  CATEGORY: { label: 'Category', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  CART:     { label: 'Cart',     bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-400' },
  CUSTOMER: { label: 'Customer', bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-400' },
}

const DISCOUNT_TYPE_GRADIENT: Record<string, string> = {
  MANUAL:      'from-slate-500 to-slate-600',
  AUTOMATIC:   'from-sky-500 to-blue-600',
  PROMOTIONAL: 'from-violet-500 to-purple-600',
  FESTIVAL:    'from-rose-500 to-pink-600',
  LOYALTY:     'from-amber-500 to-orange-500',
}

// Compact list pill — shows first N names as chips; "+N more"/"manage" opens a fixed-position popover
function ItemPillList({ items, colorChip, colorHeader, onRemove }: {
  items: { id: number; name: string }[]
  colorChip: string
  colorHeader: string
  onRemove?: (ids: number[]) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [removing, setRemoving] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const openPopover = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 300) {
        setPopoverStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 6, left: rect.left, width: 264 })
      } else {
        setPopoverStyle({ position: 'fixed', top: rect.bottom + 6, left: rect.left, width: 264 })
      }
    }
    setSelected(new Set())
    setOpen(v => !v)
  }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allSelected = items.length > 0 && selected.size === items.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)))

  const handleDelete = async () => {
    if (!onRemove || selected.size === 0 || removing) return
    setRemoving(true)
    await onRemove([...selected])
    setSelected(new Set())
    setRemoving(false)
    setOpen(false)
  }

  const INLINE = 3
  const shown = items.slice(0, INLINE)
  const rest  = items.length - INLINE

  return (
    <div className="inline-flex flex-wrap gap-1 items-center">
      {shown.map(item => (
        <span key={item.id} className={`text-xs border px-2 py-0.5 rounded-full font-medium truncate max-w-[110px] ${colorChip}`}>
          {item.name}
        </span>
      ))}
      {(rest > 0 || (onRemove && items.length > 0)) && (
        <button
          ref={triggerRef}
          type="button"
          onClick={openPopover}
          className={rest > 0
            ? 'text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold px-2 py-0.5 rounded-full transition-colors'
            : 'text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors'
          }
        >
          {rest > 0 ? `+${rest} more` : 'manage'}
        </button>
      )}

      {open && (
        <div
          ref={popoverRef}
          style={popoverStyle}
          className="z-[9999] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
        >
          {/* Header */}
          <div className={`${colorHeader} px-3 py-2.5 flex items-center justify-between`}>
            <span className="text-white text-xs font-semibold">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white"><X size={13} /></button>
          </div>

          {/* Select all row */}
          {onRemove && (
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-red-500"
                />
                <span className="text-xs font-semibold text-gray-600">Select all</span>
              </label>
              {selected.size > 0 && (
                <button
                  onClick={handleDelete}
                  disabled={removing}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-2.5 py-1 rounded-lg transition-colors"
                >
                  {removing
                    ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Trash2 size={11} />
                  }
                  Delete {selected.size === items.length ? 'all' : `${selected.size} selected`}
                </button>
              )}
            </div>
          )}

          {/* Item list */}
          <div className="max-h-52 overflow-y-auto py-1">
            {items.map(item => (
              <label
                key={item.id}
                className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer select-none"
              >
                {onRemove
                  ? <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      className="w-4 h-4 rounded shrink-0 accent-red-500"
                    />
                  : <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 ml-1" />
                }
                <span className={`truncate ${selected.has(item.id) ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                  {item.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DiscountsPage() {
  const [tab, setTab] = useState<'discounts' | 'coupons'>('discounts')
  const [showDiscountForm, setShowDiscountForm] = useState(false)
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'discount' | 'coupon'; id: number; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const qc = useQueryClient()

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.type === 'discount') {
        await discountApi.deleteDiscount(deleteTarget.id)
        toast.success('Discount deleted')
        qc.invalidateQueries({ queryKey: ['discounts'] })
      } else {
        await discountApi.deleteCoupon(deleteTarget.id)
        toast.success('Coupon deleted')
        qc.invalidateQueries({ queryKey: ['coupons'] })
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // Remove one or more products/categories from a discount inline (without opening the form)
  const removeItemFromDiscount = async (discount: Discount, type: 'product' | 'category', itemIds: number[]) => {
    const removeSet = new Set(itemIds)
    const productIds  = (discount.products  || []).map(p => p.id).filter(id => type !== 'product'  || !removeSet.has(id))
    const categoryIds = (discount.categories || []).map(c => c.id).filter(id => type !== 'category' || !removeSet.has(id))
    await discountApi.update(discount.id, {
      name:           discount.name,
      description:    discount.description,
      discountType:   discount.discountType,
      applyOn:        discount.applyOn,
      valueType:      discount.valueType,
      value:          discount.value,
      minOrderAmount: discount.minOrderAmount ?? 0,
      startDate:      discount.startDate  || null,
      endDate:        discount.endDate    || null,
      active:         discount.active,
      stackable:      discount.stackable  ?? false,
      priority:       discount.priority   ?? 0,
      productIds,
      categoryIds,
    })
    qc.invalidateQueries({ queryKey: ['discounts'] })
  }

  const { data: discounts } = useQuery({
    queryKey: ['discounts'],
    queryFn: () => discountApi.getAll().then(r => r.data.data || []),
  })

  const { data: coupons } = useQuery({
    queryKey: ['coupons'],
    queryFn: () => discountApi.getAllCoupons().then(r => r.data.data || []),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Discounts & Offers</h1>
        <button
          onClick={() => tab === 'discounts' ? setShowDiscountForm(true) : setShowCouponForm(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
        >
          <Plus size={18} /> {tab === 'discounts' ? 'Add Discount' : 'Add Coupon'}
        </button>
      </div>

      <div className="flex gap-1.5 p-1.5 mb-6 w-fit bg-gradient-to-r from-sky-50 via-blue-50 to-teal-50 border border-sky-100 rounded-2xl shadow-sm">
        {[
          { key: 'discounts', label: 'Discounts & Offers', icon: <Tag size={14} />, active: 'from-sky-500 to-blue-600', glow: 'shadow-sky-200' },
          { key: 'coupons',   label: 'Coupon Codes',       icon: <Ticket size={14} />, active: 'from-teal-500 to-cyan-600', glow: 'shadow-teal-200' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              tab === t.key
                ? `bg-gradient-to-r ${t.active} text-white shadow-md ${t.glow}`
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/60'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'discounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(discounts || []).map((d: Discount) => {
            const applyOn = APPLY_ON_CONFIG[d.applyOn] || APPLY_ON_CONFIG.PRODUCT
            const gradient = DISCOUNT_TYPE_GRADIENT[d.discountType] || DISCOUNT_TYPE_GRADIENT.MANUAL
            return (
              <div key={d.id} className={`rounded-2xl overflow-hidden shadow-sm border border-gray-100 transition-all hover:shadow-md ${!d.active ? 'opacity-55' : ''}`}>
                {/* Gradient header */}
                <div className={`bg-gradient-to-br ${gradient} px-5 pt-4 pb-6 relative`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-white text-base leading-tight">{d.name}</p>
                      {d.description && <p className="text-white/70 text-xs mt-1 line-clamp-1">{d.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button onClick={() => { setEditingDiscount(d); setShowDiscountForm(true) }}
                        className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                        <Edit size={12} className="text-white" />
                      </button>
                      <button onClick={() => setDeleteTarget({ type: 'discount', id: d.id, name: d.name })}
                        className="w-7 h-7 rounded-full bg-white/20 hover:bg-red-500/60 flex items-center justify-center transition-colors">
                        <Trash2 size={12} className="text-white" />
                      </button>
                      {d.active
                        ? <ToggleRight size={22} className="text-white/90" />
                        : <ToggleLeft size={22} className="text-white/50" />}
                    </div>
                  </div>
                  {/* Big value badge */}
                  <div className="mt-3 inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-3 py-1.5">
                    {d.valueType === 'PERCENTAGE'
                      ? <Percent size={14} className="text-white" />
                      : <IndianRupee size={14} className="text-white" />}
                    <span className="text-white font-bold text-lg leading-none">
                      {d.valueType === 'PERCENTAGE' ? `${d.value}% OFF` : `₹${d.value} OFF`}
                    </span>
                  </div>
                </div>

                {/* Card body — lifted overlap effect */}
                <div className="bg-white px-5 pt-4 pb-4 -mt-2 rounded-t-2xl relative">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${applyOn.bg} ${applyOn.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${applyOn.dot}`} />
                      {applyOn.label}
                    </span>
                    {d.discountType && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">
                        {d.discountType.toLowerCase()}
                      </span>
                    )}
                    {!d.active && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-500 font-medium">Inactive</span>
                    )}
                  </div>
                  {(d.startDate || d.endDate) && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                      <Calendar size={11} />
                      <span>
                        {d.startDate && new Date(d.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {d.startDate && d.endDate && ' — '}
                        {d.endDate && new Date(d.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {d.minOrderAmount != null && d.minOrderAmount > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                      <ShoppingCart size={11} />
                      <span>Min order ₹{d.minOrderAmount}</span>
                    </div>
                  )}

                  {/* Products */}
                  {d.applyOn === 'PRODUCT' && d.products && d.products.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1.5">
                        <Package size={11} />
                        <span className="font-medium">
                          {d.products.length === 1 ? '1 product' : `${d.products.length} products`}
                        </span>
                      </div>
                      <ItemPillList
                        items={d.products}
                        colorChip="bg-sky-50 text-sky-700 border-sky-100"
                        colorHeader="bg-sky-500"
                        onRemove={(ids) => removeItemFromDiscount(d, 'product', ids)}
                      />
                    </div>
                  )}

                  {/* Categories */}
                  {d.applyOn === 'CATEGORY' && d.categories && d.categories.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1.5">
                        <LayoutGrid size={11} />
                        <span className="font-medium">
                          {d.categories.length === 1 ? '1 category' : `${d.categories.length} categories`}
                        </span>
                      </div>
                      <ItemPillList
                        items={d.categories}
                        colorChip="bg-emerald-50 text-emerald-700 border-emerald-100"
                        colorHeader="bg-emerald-500"
                        onRemove={(ids) => removeItemFromDiscount(d, 'category', ids)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {(!discounts || discounts.length === 0) && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Tag size={48} className="mx-auto mb-4 opacity-30" />
              <p>No discounts configured yet</p>
            </div>
          )}
        </div>
      )}

      {tab === 'coupons' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(coupons || []).map((c: Coupon) => {
            const isExpired = c.expiryDate && new Date(c.expiryDate) < new Date()
            const isActive = c.active && !isExpired
            const usagePct = c.usageLimit ? Math.min((c.timesUsed / c.usageLimit) * 100, 100) : null
            return (
              <div key={c.id} className={`rounded-2xl overflow-hidden shadow-sm border transition-all hover:shadow-lg hover:-translate-y-0.5 ${isActive ? 'border-cyan-100' : 'border-gray-100 opacity-60'}`}>
                {/* Gradient header */}
                <div className={`relative px-5 pt-5 pb-10 ${isActive ? 'bg-gradient-to-br from-teal-500 via-cyan-500 to-sky-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
                  {/* Decorative circles */}
                  <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
                  <div className="absolute -right-2 top-8 w-12 h-12 rounded-full bg-white/10" />
                  <div className="flex items-start justify-between relative">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Coupon Code</p>
                        <button
                          onClick={() => { setEditingCoupon(c); setShowCouponForm(true) }}
                          className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center transition-colors"
                        >
                          <Edit size={11} className="text-white" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ type: 'coupon', id: c.id, name: c.code })}
                          className="w-6 h-6 rounded-full bg-white/20 hover:bg-red-500/60 flex items-center justify-center transition-colors"
                        >
                          <Trash2 size={11} className="text-white" />
                        </button>
                      </div>
                      <code className="font-mono font-bold text-xl tracking-widest text-white drop-shadow-sm">{c.code}</code>
                      {c.description && <p className="text-white/70 text-xs mt-1 line-clamp-1">{c.description}</p>}
                    </div>
                    {/* Big value badge */}
                    <div className="shrink-0 ml-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl px-3 py-2 text-center">
                      <p className="text-white font-extrabold text-xl leading-none">
                        {c.valueType === 'PERCENTAGE' ? `${c.value}%` : `₹${c.value}`}
                      </p>
                      <p className="text-white/80 text-xs font-semibold">OFF</p>
                    </div>
                  </div>
                </div>

                {/* Ticket notch effect */}
                <div className={`relative -mt-2 mx-0 flex items-center ${isActive ? 'text-cyan-200' : 'text-gray-200'}`}>
                  <div className="w-4 h-4 rounded-full -ml-2 bg-white border-r border-dashed" style={{ borderColor: 'inherit' }} />
                  <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: 'inherit' }} />
                  <div className="w-4 h-4 rounded-full -mr-2 bg-white border-l border-dashed" style={{ borderColor: 'inherit' }} />
                </div>

                {/* Card body */}
                <div className="bg-white px-5 pt-3 pb-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className={`rounded-xl px-3 py-2 ${isActive ? 'bg-teal-50' : 'bg-gray-50'}`}>
                      <p className="text-gray-400 mb-0.5">Min Order</p>
                      <p className={`font-bold text-sm ${isActive ? 'text-teal-700' : 'text-gray-600'}`}>₹{c.minOrderAmount || 0}</p>
                    </div>
                    <div className={`rounded-xl px-3 py-2 ${isExpired ? 'bg-red-50' : isActive ? 'bg-sky-50' : 'bg-gray-50'}`}>
                      <p className="text-gray-400 mb-0.5">Expiry</p>
                      <p className={`font-bold text-sm ${isExpired ? 'text-red-500' : isActive ? 'text-sky-700' : 'text-gray-600'}`}>
                        {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No expiry'}
                      </p>
                    </div>
                  </div>

                  {/* Usage bar */}
                  {usagePct !== null && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span className="font-medium">Usage</span>
                        <span className="font-semibold text-gray-600">{c.timesUsed} / {c.usageLimit}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-gradient-to-r from-red-400 to-rose-500' : usagePct >= 60 ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-teal-400 to-cyan-400'}`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isActive ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                    {isExpired && <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-500 font-semibold">Expired</span>}
                    {c.maxDiscountAmount && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-sky-100 text-sky-600 font-medium">
                        Max ₹{c.maxDiscountAmount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {(!coupons || coupons.length === 0) && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Ticket size={48} className="mx-auto mb-4 opacity-30" />
              <p>No coupons created yet</p>
            </div>
          )}
        </div>
      )}

      {showDiscountForm && (
        <DiscountForm
          discount={editingDiscount}
          onClose={() => { setShowDiscountForm(false); setEditingDiscount(null) }}
          onSaved={() => { setShowDiscountForm(false); setEditingDiscount(null); qc.invalidateQueries({ queryKey: ['discounts'] }) }}
        />
      )}

      {showCouponForm && (
        <CouponForm
          coupon={editingCoupon}
          onClose={() => { setShowCouponForm(false); setEditingCoupon(null) }}
          onSaved={() => { setShowCouponForm(false); setEditingCoupon(null); qc.invalidateQueries({ queryKey: ['coupons'] }) }}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete {deleteTarget.type === 'discount' ? 'Discount' : 'Coupon'}?</h3>
                <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3 mb-5 font-medium">
              "{deleteTarget.name}"
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-red-600 hover:to-rose-700 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
