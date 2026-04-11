import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, UserPlus, X, Plus, Minus, Trash2, CreditCard, Loader2, Tag, Ticket,
  Star, Heart, ShoppingBag, Zap, PauseCircle, RotateCcw, ChevronDown,
  ChevronUp, User, Gift, Percent, Edit2, Check,
  AlertCircle, Banknote, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { productApi, orderApi, staffApi, discountApi, creditNoteApi } from '@/services/api'
import { Product, Customer } from '@/types'
import PaymentModal from './PaymentModal'
import CustomerSearchModal from './CustomerSearchModal'
import PaymentSuccessModal from './PaymentSuccessModal'

// ─── Local Storage Hook ────────────────────────────────────────────────────────

function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial } catch { return initial }
  })
  const set = useCallback((v: T) => {
    setVal(v)
    localStorage.setItem(key, JSON.stringify(v))
  }, [key])
  return [val, set]
}

// ─── Clock ─────────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <span className="text-sm font-mono text-gray-400">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}

// ─── Item Edit Panel ───────────────────────────────────────────────────────────

interface ItemEditPanelProps {
  item: any
  onClose: () => void
  touchMode: boolean
}

function ItemEditPanel({ item, onClose, touchMode }: ItemEditPanelProps) {
  const { updateItemPrice, updateDiscount } = useCartStore()
  const [price, setPrice] = useState(item.unitPrice.toString())
  const [disc, setDisc] = useState(item.discountPercent.toString())

  function apply() {
    const p = parseFloat(price)
    const d = parseFloat(disc)
    if (!isNaN(p) && p >= 0) updateItemPrice(item.productId, item.variantId, p)
    if (!isNaN(d) && d >= 0 && d <= 100) updateDiscount(item.productId, item.variantId, d)
    onClose()
  }

  return (
    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Unit Price (₹)</label>
          <input type="number" min="0" step="0.01" value={price}
            onChange={e => setPrice(e.target.value)}
            className={`w-full border border-gray-300 rounded-lg px-3 focus:ring-2 focus:ring-primary-500 focus:outline-none font-semibold ${touchMode ? 'py-3 text-base' : 'py-1.5 text-sm'}`} />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Discount %</label>
          <input type="number" min="0" max="100" step="0.5" value={disc}
            onChange={e => setDisc(e.target.value)}
            className={`w-full border border-gray-300 rounded-lg px-3 focus:ring-2 focus:ring-primary-500 focus:outline-none font-semibold ${touchMode ? 'py-3 text-base' : 'py-1.5 text-sm'}`} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-100">Cancel</button>
        <button onClick={apply} className="flex-1 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg text-xs font-medium hover:from-violet-700 hover:to-blue-700">Apply</button>
      </div>
    </div>
  )
}

// ─── Hold Modal ────────────────────────────────────────────────────────────────

function HoldModal({ onClose, onHold }: { onClose: () => void; onHold: (note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><PauseCircle size={18} className="text-amber-500" /> Hold Order</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)}
          rows={3} placeholder="Add a note for this order (optional)…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={() => { onHold(note); onClose() }}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5">
            <PauseCircle size={15} /> Hold Order
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Held Orders Panel ─────────────────────────────────────────────────────────

function HeldPanel({ onClose, touchMode }: { onClose: () => void; touchMode: boolean }) {
  const { heldOrders, restoreCart, deleteHeld } = useCartStore()

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-80 bg-white shadow-2xl flex flex-col h-full animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <PauseCircle size={18} className="text-amber-500" />
            Held Orders
            <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{heldOrders.length}</span>
          </h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {heldOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <PauseCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No held orders</p>
            </div>
          ) : heldOrders.map(h => (
            <div key={h.id} className="border border-gray-200 rounded-xl p-3 hover:border-primary-300 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{h.customer?.name ?? 'Walk-in'}</p>
                  {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                </div>
                <span className="text-xs text-gray-400">{new Date(h.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">{h.items.length} item{h.items.length !== 1 ? 's' : ''} · ₹{h.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}</p>
              <div className="flex gap-2">
                <button onClick={() => { restoreCart(h.id); onClose() }}
                  className={`flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-1 ${touchMode ? 'py-2.5 text-sm' : 'py-1.5 text-xs'}`}>
                  <RotateCcw size={13} /> Restore
                </button>
                <button onClick={() => deleteHeld(h.id)}
                  className={`px-3 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg ${touchMode ? 'py-2.5' : 'py-1.5'}`}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Product Tile ──────────────────────────────────────────────────────────────

interface TileProps {
  product: Product
  isFav: boolean
  touchMode: boolean
  onAdd: (p: Product) => void
  onToggleFav: (id: number) => void
}

function ProductTile({ product, isFav, touchMode, onAdd, onToggleFav }: TileProps) {
  return (
    <div
      onClick={() => onAdd(product)}
      className={`relative bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-200 rounded-xl cursor-pointer flex flex-col transition-colors group shadow-sm ${touchMode ? 'p-3' : 'p-2.5'}`}
    >
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name}
          className={`w-full object-cover rounded-lg mb-2 bg-gray-100 ${touchMode ? 'h-24' : 'h-16'}`} />
      ) : (
        <div className={`w-full rounded-lg mb-2 bg-gray-100 flex items-center justify-center ${touchMode ? 'h-24' : 'h-16'}`}>
          <ShoppingBag size={touchMode ? 24 : 18} className="text-gray-400" />
        </div>
      )}
      <p className={`font-medium text-gray-800 leading-tight line-clamp-2 flex-1 ${touchMode ? 'text-sm' : 'text-xs'}`}>{product.name}</p>
      <p className={`font-bold text-primary-600 mt-1 ${touchMode ? 'text-base' : 'text-sm'}`}>₹{product.sellingPrice}</p>
      {product.featured && (
        <span className="absolute top-1.5 left-1.5 bg-yellow-500 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-md">HOT</span>
      )}
      {(product.variants?.filter(v => v.active).length ?? 0) > 0 && (
        <span className="absolute bottom-1.5 left-1.5 bg-violet-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
          {product.variants!.filter(v => v.active).length} variants
        </span>
      )}
      <button
        onClick={e => { e.stopPropagation(); onToggleFav(product.id) }}
        className={`absolute top-1.5 right-1.5 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity ${isFav ? 'opacity-100 text-red-400' : 'text-gray-500 hover:text-red-400'}`}
      >
        <Heart size={13} fill={isFav ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

// ─── Variant Picker Modal ──────────────────────────────────────────────────────

function VariantPickerModal({
  product,
  onSelect,
  onClose,
  touchMode,
}: {
  product: Product
  onSelect: (product: Product, variantId: number, variantName: string, price: number) => void
  onClose: () => void
  touchMode: boolean
}) {
  const variants = product.variants?.filter(v => v.active) ?? []
  const basePrice = product.sellingPrice

  // Group by attr1Value
  const byAttr1 = variants.reduce<Record<string, typeof variants>>((acc, v) => {
    const key = v.attribute1Value || 'Default'
    if (!acc[key]) acc[key] = []
    acc[key].push(v)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Select a variant</p>
          </div>
          <button onClick={onClose} className="ml-3"><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(byAttr1).map(([attr1, vars]) => (
            <div key={attr1}>
              {vars[0].attribute1Name && (
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{vars[0].attribute1Name}: {attr1}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {vars.map(v => {
                  const price = basePrice + parseFloat(v.priceAdjustment?.toString() ?? '0')
                  return (
                    <button
                      key={v.id}
                      onClick={() => onSelect(product, v.id, v.name, price)}
                      className={`flex flex-col items-start p-3 border-2 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-all text-left ${touchMode ? 'min-h-[72px]' : 'min-h-[60px]'}`}
                    >
                      <span className="font-semibold text-gray-900 text-sm">{v.attribute2Value || v.name}</span>
                      {v.attribute2Name && v.attribute2Value && (
                        <span className="text-xs text-gray-400">{v.attribute2Name}</span>
                      )}
                      <span className="text-primary-600 font-bold mt-1">₹{price.toFixed(2)}</span>
                      {v.sku && <span className="text-xs text-gray-400 mt-0.5">{v.sku}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 pb-4 border-t pt-3">
          <button onClick={onClose} className="w-full py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Staff Picker Modal ────────────────────────────────────────────────────────

function StaffPickerModal({
  outletId, currentStaffId, onSelect, onClose
}: {
  outletId: number
  currentStaffId: number | null
  onSelect: (id: number, name: string) => void
  onClose: () => void
}) {
  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['staff-list', outletId],
    queryFn: () => staffApi.getByOutlet(outletId).then(r => r.data.data ?? []),
    staleTime: 120_000,
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <User size={18} className="text-primary-600" /> Select Sales Staff
          </h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-3 max-h-80 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading staff…
            </div>
          ) : staffList.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No staff members found</p>
          ) : (staffList as any[]).map(s => (
            <button key={s.id}
              onClick={() => { onSelect(s.id, s.name); onClose() }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                currentStaffId === s.id ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
              }`}>
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-bold shrink-0">
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                <p className="text-xs text-gray-400">{s.roles?.join(', ') ?? 'Staff'}</p>
              </div>
              {currentStaffId === s.id && <Check size={16} className="text-primary-600 shrink-0" />}
            </button>
          ))}
        </div>
        <div className="px-5 pb-4">
          <button onClick={onClose}
            className="w-full py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [successData, setSuccessData] = useState<{ orderNumber: string; invoiceId: number | null; invoiceNumber: string | null; total: number } | null>(null)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [showHeldPanel, setShowHeldPanel] = useState(false)
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null)
  const [couponInput, setCouponInput] = useState('')
  const [couponValidating, setCouponValidating] = useState(false)
  const [showCouponDropdown, setShowCouponDropdown] = useState(false)
  const couponInputRef = useRef<HTMLInputElement>(null)
  const couponDropdownRef = useRef<HTMLDivElement>(null)
  const [loyaltyRedeem, setLoyaltyRedeem] = useState('')
  const [showBillDiscEditor, setShowBillDiscEditor] = useState(false)
  const [billDiscInput, setBillDiscInput] = useState('')
  const [billDiscTypeInput, setBillDiscTypeInput] = useState<'percent' | 'flat'>('flat')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [showStaffPicker, setShowStaffPicker] = useState(false)
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null)
  const [customerCreditNotes, setCustomerCreditNotes] = useState<any[]>([])
  const [touchMode, setTouchMode] = useLocalStorage('pos-touch-mode', false)
  const [favoriteIds, setFavoriteIds] = useLocalStorage<number[]>('pos-favorite-ids', [])

  const {
    items, customer, couponCode, couponDiscountAmount, billDiscount, billDiscountType, heldOrders,
    salesStaffId, salesStaffName,
    addItem, updateQuantity, removeItem, clearCart, setCustomer,
    setCouponCode, setCouponDiscountAmount, setBillDiscount, holdCart, setSalesStaff,
    getSubtotal, getTotalDiscount, getTotalTax, getBillDiscountAmount, getTotal,
  } = useCartStore()
  const { outletId, user } = useAuthStore()
  const qc = useQueryClient()

  // Auto-set logged-in user as default sales staff on mount
  useEffect(() => {
    if (!salesStaffId && user) {
      setSalesStaff(user.id, user.name)
    }
  }, [user])

  // Load products for tile grid
  const { data: productsData } = useQuery({
    queryKey: ['pos-products', activeCategoryId],
    queryFn: () => activeCategoryId
      ? productApi.getByCategory(activeCategoryId).then(r => r.data.data?.content ?? r.data.data ?? [])
      : productApi.getAll({ active: true, size: 200 }).then(r => r.data.data?.content ?? r.data.data ?? []),
    staleTime: 60_000,
  })

  const allProducts: Product[] = productsData ?? []

  const { data: allCoupons = [] } = useQuery({
    queryKey: ['pos-coupons'],
    queryFn: () => discountApi.getAllCoupons().then(r => (r.data.data ?? []).filter((c: any) =>
      c.active && (!c.expiryDate || new Date(c.expiryDate) > new Date())
    )),
    staleTime: 60_000,
  })

  const couponSuggestions = couponInput.trim().length > 0
    ? allCoupons.filter((c: any) =>
        c.code.includes(couponInput.trim().toUpperCase()) ||
        (c.description && c.description.toLowerCase().includes(couponInput.toLowerCase()))
      ).slice(0, 6)
    : allCoupons.slice(0, 6)

  // Extract unique categories from products
  const categories = Array.from(
    new Map(allProducts.filter(p => p.category).map(p => [p.category!.id, p.category!])).values()
  )

  const favoriteProducts = allProducts.filter(p => favoriteIds.includes(p.id))
  const displayProducts = searchQuery
    ? searchResults
    : activeCategoryId === -1
    ? favoriteProducts
    : allProducts

  useEffect(() => { searchInputRef.current?.focus() }, [])

  useEffect(() => {
    if (!showCouponDropdown) return
    const handler = (e: MouseEvent) => {
      if (couponDropdownRef.current && !couponDropdownRef.current.contains(e.target as Node) &&
          couponInputRef.current && !couponInputRef.current.contains(e.target as Node)) {
        setShowCouponDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCouponDropdown])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (!query.trim()) { setSearchResults([]); return }

    // Barcode exact match
    if (/^\d{8,13}$/.test(query)) {
      try {
        const res = await productApi.getByBarcode(query)
        if (res.data.data) {
          addProductToCart(res.data.data)
          setSearchQuery(''); setSearchResults([])
          return
        }
      } catch {}
    }

    setSearching(true)
    try {
      const res = await productApi.search(query)
      setSearchResults(res.data.data || [])
    } finally {
      setSearching(false)
    }
  }

  function addProductToCart(product: Product, variantId?: number, variantName?: string, variantPrice?: number) {
    const activeVariants = product.variants?.filter(v => v.active) ?? []
    if (activeVariants.length > 0 && !variantId) {
      setVariantPickerProduct(product)
      return
    }
    const price = variantPrice ?? product.sellingPrice
    const discPct = customer?.discountPercent ?? 0
    addItem({
      productId: product.id,
      variantId,
      productName: variantName ? `${product.name} – ${variantName}` : product.name,
      sku: product.sku,
      quantity: 1,
      unitPrice: price,
      discountPercent: discPct,
      discountAmount: price * discPct / 100,
      taxRate: product.taxGroup?.totalRate || 0,
      taxAmount: price * (1 - discPct / 100) * (product.taxGroup?.totalRate || 0) / 100,
      lineTotal: price,
      imageUrl: product.imageUrl,
    })
    setSearchResults([]); setSearchQuery('')
    setVariantPickerProduct(null)
    searchInputRef.current?.focus()
    toast.success(`${product.name}${variantName ? ` (${variantName})` : ''} added`, { duration: 800 })
  }

  function toggleFavorite(id: number) {
    setFavoriteIds(favoriteIds.includes(id) ? favoriteIds.filter(f => f !== id) : [...favoriteIds, id])
  }

  async function applyCoupon(overrideCode?: string) {
    const code = (overrideCode ?? couponInput).trim().toUpperCase()
    if (!code) return
    setShowCouponDropdown(false)
    const afterItemDiscount = getSubtotal() - getTotalDiscount()
    if (afterItemDiscount <= 0) { toast.error('Add items to cart first'); return }
    setCouponValidating(true)
    try {
      const res = await discountApi.validateCoupon({ code, orderAmount: afterItemDiscount, customerId: customer?.id ?? null })
      const { discountAmount, valueDisplay } = res.data.data
      setCouponCode(code)
      setCouponInput(code)
      setCouponDiscountAmount(discountAmount)
      toast.success(`${code} applied — ${valueDisplay} (₹${discountAmount.toFixed(2)} off)`, { duration: 3000 })
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid coupon code')
    } finally {
      setCouponValidating(false)
    }
  }

  function applyBillDiscount() {
    const v = parseFloat(billDiscInput)
    if (isNaN(v) || v < 0) return
    setBillDiscount(v, billDiscTypeInput)
    setShowBillDiscEditor(false)
  }

  async function handleCheckout(payments: any[], options: any) {
    const checkoutData = {
      outletId,
      customerId: customer?.id,
      shiftId: useCartStore.getState().shiftId,
      salesStaffId: salesStaffId ?? undefined,
      couponCode: couponCode || undefined,
      billDiscount: billDiscount || undefined,
      billDiscountType: billDiscount ? billDiscountType : undefined,
      loyaltyPointsToRedeem: loyaltyRedeem ? parseInt(loyaltyRedeem) : undefined,
      items: items.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountPercent: i.discountPercent,
      })),
      payments,
      ...options,
    }
    try {
      const res = await orderApi.checkout(checkoutData)
      const completedOrder = res.data.data
      const paidTotal = total  // capture before clearCart resets
      clearCart()
      setCouponCode('')
      setBillDiscount(0, 'flat')
      setLoyaltyRedeem('')
      setCustomerCreditNotes([])
      setShowPayment(false)
      qc.invalidateQueries({ queryKey: ['credit-notes'] })
      setSuccessData({
        orderNumber: completedOrder?.orderNumber ?? '',
        invoiceId: completedOrder?.invoiceId ?? null,
        invoiceNumber: completedOrder?.invoiceNumber ?? null,
        total: paidTotal,
      })
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Checkout failed. Please try again.'
      toast.error(msg)
      throw err  // re-throw so PaymentModal can reset its loading state
    }
  }

  const subtotal   = getSubtotal()
  const itemDisc   = getTotalDiscount()
  const billDiscAmt = getBillDiscountAmount()
  const tax        = getTotalTax()
  const total      = getTotal()
  const itemKey    = (i: any) => `${i.productId}-${i.variantId ?? ''}`

  // GST label: show % if all cart items share the same tax rate
  const cartTaxRates = [...new Set(items.map(i => i.taxRate).filter(r => r > 0))]
  const gstLabel = cartTaxRates.length === 1 ? `GST (${cartTaxRates[0]}%)` : 'GST'

  // Rounding off for the cart total
  const roundedTotal = Math.round(total)
  const roundOff     = parseFloat((roundedTotal - total).toFixed(2))
  const segColors: Record<string, string> = {
    VIP: 'bg-purple-100 text-purple-700', GOLD: 'bg-yellow-100 text-yellow-700',
    SILVER: 'bg-gray-100 text-gray-600', WHOLESALE: 'bg-blue-100 text-blue-700',
    REGULAR: 'bg-green-100 text-green-700',
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={`flex bg-gray-100 ${touchMode ? 'h-screen' : 'h-screen'}`}>

      {/* ── Left Panel: Products ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 shrink-0 shadow-sm">
          {/* Staff selector */}
          <button
            onClick={() => setShowStaffPicker(true)}
            className="flex items-center gap-2 mr-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
              <User size={14} className="text-white" />
            </div>
            <div className="leading-tight text-left">
              <p className="text-xs font-semibold text-gray-900">{salesStaffName || user?.name || 'Select Staff'}</p>
              <p className="text-xs text-gray-500">{user?.outletName ?? 'Outlet'}</p>
            </div>
            <ChevronRight size={12} className="text-gray-400 group-hover:text-gray-600 ml-0.5" />
          </button>
          <LiveClock />
          <div className="flex-1" />
          {/* Touch mode toggle */}
          <button
            onClick={() => setTouchMode(!touchMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${touchMode ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Zap size={13} /> Touch
          </button>
          {/* Held orders */}
          <button
            onClick={() => setShowHeldPanel(true)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <PauseCircle size={13} /> Held
            {heldOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {heldOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Search bar */}
        <div className="bg-white px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchQuery(''); setSearchResults([]) } }}
              placeholder="Search products by name, barcode or SKU…"
              className={`w-full bg-gray-100 border border-gray-200 rounded-xl pl-9 pr-4 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none ${touchMode ? 'py-3 text-base' : 'py-2 text-sm'}`}
            />
            {searching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
            {searchQuery && !searching && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Category cards */}
        {!searchQuery && (
          <div className="bg-white px-4 py-2.5 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide border-b border-gray-100">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${activeCategoryId === null ? 'bg-teal-500 text-white border-teal-500 shadow-lg scale-105' : 'bg-teal-50 text-teal-600 border-teal-100 shadow-md hover:bg-teal-100'}`}
            >
              All
            </button>
            {favoriteProducts.length > 0 && (
              <button
                onClick={() => setActiveCategoryId(-1)}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border shadow-md flex items-center gap-1.5 transition-all ${activeCategoryId === -1 ? 'bg-teal-500 text-white border-teal-500 shadow-lg scale-105' : 'bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-100'}`}
              >
                <Heart size={11} fill={activeCategoryId === -1 ? 'white' : 'currentColor'} /> Favorites
              </button>
            )}
            {categories.map(cat => {
              const isActive = activeCategoryId === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(isActive ? null : cat.id)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${isActive ? 'bg-teal-500 text-white border-teal-500 shadow-lg scale-105' : 'bg-teal-50 text-teal-600 border-teal-100 shadow-md hover:bg-teal-100'}`}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Product grid */}
        <div className="flex-1 overflow-auto p-4">
          {displayProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingBag size={48} className="mb-3 opacity-30" />
              <p className="text-sm">{searchQuery ? 'No products found' : 'No products available'}</p>
            </div>
          ) : (
            <div className={`grid gap-3 ${touchMode ? 'grid-cols-3 xl:grid-cols-4' : 'grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'}`}>
              {displayProducts.map(product => (
                <ProductTile
                  key={product.id}
                  product={product}
                  isFav={favoriteIds.includes(product.id)}
                  touchMode={touchMode}
                  onAdd={addProductToCart}
                  onToggleFav={toggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Cart & Order ─────────────────────────────────────────── */}
      <div className={`bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-2xl ${touchMode ? 'w-[420px]' : 'w-[380px]'}`}>

        {/* Customer card */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          {customer ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm truncate">{customer.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${segColors[customer.segment] ?? 'bg-gray-100 text-gray-600'}`}>
                      {customer.segment}
                    </span>
                  </div>
                  {customer.phone && <p className="text-xs text-gray-500 mt-0.5">{customer.phone}</p>}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <Star size={11} fill="currentColor" /> {customer.loyaltyPoints.toLocaleString()} pts
                    </span>
                    {customer.outstandingDue > 0 && (
                      <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                        <AlertCircle size={11} /> ₹{customer.outstandingDue.toFixed(2)} due
                      </span>
                    )}
                    {customer.discountPercent > 0 && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <Percent size={11} /> {customer.discountPercent}% off
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => { setCustomer(null); setCustomerCreditNotes([]) }} className="ml-2 text-gray-400 hover:text-red-500 shrink-0">
                  <X size={15} />
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCustomerSearch(true)}
              className={`w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors ${touchMode ? 'py-3 text-sm' : 'py-2 text-xs'}`}>
              <UserPlus size={15} /> Add Customer (optional)
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 py-8">
              <ShoppingBag size={48} className="mb-3 opacity-40" />
              <p className="text-sm text-gray-400">Tap a product to add it</p>
            </div>
          ) : items.map(item => {
            const key = itemKey(item)
            const lineNet = item.unitPrice * item.quantity - item.discountAmount
            return (
              <div key={key} className="border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                <div className={`flex items-center gap-2 ${touchMode ? 'p-3' : 'p-2'}`}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.productName} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <ShoppingBag size={14} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-gray-900 truncate ${touchMode ? 'text-sm' : 'text-xs'}`}>{item.productName}</p>
                    <p className="text-xs text-gray-400">
                      ₹{item.unitPrice}
                      {item.discountPercent > 0 && <span className="text-green-600 ml-1">-{item.discountPercent}%</span>}
                    </p>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                      className={`rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center ${touchMode ? 'w-8 h-8' : 'w-6 h-6'}`}>
                      <Minus size={touchMode ? 14 : 11} />
                    </button>
                    <span className={`text-center font-bold text-gray-900 ${touchMode ? 'w-8 text-sm' : 'w-6 text-xs'}`}>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                      className={`rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center ${touchMode ? 'w-8 h-8' : 'w-6 h-6'}`}>
                      <Plus size={touchMode ? 14 : 11} />
                    </button>
                  </div>
                  <span className={`font-bold text-gray-900 text-right shrink-0 ${touchMode ? 'w-20 text-sm' : 'w-16 text-xs'}`}>₹{lineNet.toFixed(2)}</span>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => setEditingItemKey(editingItemKey === key ? null : key)}
                      className="text-gray-400 hover:text-primary-500">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => removeItem(item.productId, item.variantId)}
                      className="text-gray-300 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {editingItemKey === key && (
                  <div className="px-2 pb-2">
                    <ItemEditPanel item={item} onClose={() => setEditingItemKey(null)} touchMode={touchMode} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Bill discount, coupon, loyalty */}
        {items.length > 0 && (
          <div className="px-4 pb-2 space-y-2 border-t border-gray-100 pt-3 shrink-0">
            {/* Bill Discount */}
            <div>
              <button onClick={() => setShowBillDiscEditor(!showBillDiscEditor)}
                className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 font-medium py-1">
                <span className="flex items-center gap-1.5"><Tag size={12} /> Bill Discount
                  {billDiscount > 0 && <span className="text-green-600 font-semibold ml-1">({billDiscountType === 'percent' ? `${billDiscount}%` : `₹${billDiscount}`} applied)</span>}
                </span>
                {showBillDiscEditor ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showBillDiscEditor && (
                <div className="flex gap-2 mt-1">
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                    <button onClick={() => setBillDiscTypeInput('percent')}
                      className={`px-2.5 py-1.5 font-medium ${billDiscTypeInput === 'percent' ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>%</button>
                    <button onClick={() => setBillDiscTypeInput('flat')}
                      className={`px-2.5 py-1.5 font-medium ${billDiscTypeInput === 'flat' ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>₹</button>
                  </div>
                  <input type="number" min="0" step="any" value={billDiscInput} onChange={e => setBillDiscInput(e.target.value)}
                    placeholder={billDiscTypeInput === 'percent' ? 'e.g. 10' : 'e.g. 50'}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none" />
                  <button onClick={applyBillDiscount}
                    className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg text-xs font-medium hover:from-violet-700 hover:to-blue-700 flex items-center gap-1">
                    <Check size={12} /> Apply
                  </button>
                  {billDiscount > 0 && (
                    <button onClick={() => { setBillDiscount(0, 'flat'); setBillDiscInput('') }}
                      className="px-2 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50">
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Coupon */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Ticket size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    ref={couponInputRef}
                    value={couponInput}
                    onChange={e => { setCouponInput(e.target.value.toUpperCase()); setShowCouponDropdown(true) }}
                    onFocus={() => !couponCode && setShowCouponDropdown(true)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { applyCoupon(); e.preventDefault() }
                      if (e.key === 'Escape') setShowCouponDropdown(false)
                    }}
                    placeholder="Search coupon code..."
                    disabled={!!couponCode}
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:outline-none uppercase font-mono disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                {!couponCode ? (
                  <button onClick={() => applyCoupon()} disabled={couponValidating || !couponInput.trim()}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1 min-w-[52px] justify-center">
                    {couponValidating ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Apply'}
                  </button>
                ) : (
                  <button onClick={() => { setCouponCode(''); setCouponInput('') }}
                    className="px-2 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {showCouponDropdown && !couponCode && couponSuggestions.length > 0 && (
                <div ref={couponDropdownRef}
                  className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-52 overflow-y-auto">
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Available Coupons</p>
                  </div>
                  {couponSuggestions.map((c: any) => {
                    const discDisplay = c.valueType === 'PERCENTAGE' ? `${c.value}% OFF` : `₹${c.value} OFF`
                    return (
                      <button
                        key={c.id}
                        onMouseDown={e => { e.preventDefault(); setCouponInput(c.code); applyCoupon(c.code) }}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-teal-50 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-md bg-teal-100 flex items-center justify-center shrink-0">
                            <Ticket size={11} className="text-teal-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono font-bold text-xs text-gray-800 tracking-wider">{c.code}</p>
                            {c.description && <p className="text-[10px] text-gray-400 truncate">{c.description}</p>}
                          </div>
                        </div>
                        <span className="shrink-0 ml-2 text-xs font-bold text-teal-600 bg-teal-50 group-hover:bg-teal-100 px-2 py-0.5 rounded-full">
                          {discDisplay}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {couponCode && (
                <div className="flex items-center justify-between text-xs bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1.5 mt-1.5">
                  <span className="flex items-center gap-1 text-teal-700 font-medium">
                    <Check size={11} /> <span className="font-mono">{couponCode}</span> applied
                  </span>
                  <span className="text-teal-600 font-bold">-₹{couponDiscountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Loyalty redemption */}
            {customer && customer.loyaltyPoints > 0 && (
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Gift size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-500" />
                  <input type="number" min="0" max={customer.loyaltyPoints} value={loyaltyRedeem}
                    onChange={e => setLoyaltyRedeem(e.target.value)}
                    placeholder={`Redeem points (max ${customer.loyaltyPoints.toLocaleString()})`}
                    className="w-full border border-amber-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none bg-amber-50" />
                </div>
                {loyaltyRedeem && (
                  <button onClick={() => setLoyaltyRedeem('')}
                    className="px-2 py-1.5 border border-gray-200 text-gray-400 rounded-lg text-xs hover:bg-gray-50">
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Totals summary */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {itemDisc > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Item Discounts</span>
              <span>-₹{itemDisc.toFixed(2)}</span>
            </div>
          )}
          {billDiscAmt > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Bill Discount</span>
              <span>-₹{billDiscAmt.toFixed(2)}</span>
            </div>
          )}
          {couponDiscountAmount > 0 && (
            <div className="flex justify-between text-teal-600">
              <span className="flex items-center gap-1"><Ticket size={11} /> Coupon ({couponCode})</span>
              <span>-₹{couponDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>{gstLabel}</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
          )}
          {roundOff !== 0 && (
            <div className="flex justify-between text-gray-400 text-xs">
              <span>Round Off</span>
              <span>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
            </div>
          )}
          <div className={`flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-200 ${touchMode ? 'text-xl' : 'text-lg'}`}>
            <span>Total</span>
            <span className="text-primary-600">₹{roundedTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className={`px-4 pb-4 pt-2 grid grid-cols-3 gap-2 shrink-0`}>
          <button
            onClick={() => items.length > 0 && setShowHoldModal(true)}
            disabled={items.length === 0}
            className={`flex flex-col items-center justify-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-medium rounded-xl transition-colors disabled:opacity-40 ${touchMode ? 'py-3 text-sm' : 'py-2.5 text-xs'}`}
          >
            <PauseCircle size={touchMode ? 20 : 16} />
            Hold
          </button>
          <button
            onClick={() => { if (items.length > 0 && window.confirm('Clear cart?')) clearCart() }}
            disabled={items.length === 0}
            className={`flex flex-col items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-medium rounded-xl transition-colors disabled:opacity-40 ${touchMode ? 'py-3 text-sm' : 'py-2.5 text-xs'}`}
          >
            <Trash2 size={touchMode ? 20 : 16} />
            Clear
          </button>
          <button
            onClick={() => setShowPayment(true)}
            disabled={items.length === 0}
            className={`col-span-1 flex flex-col items-center justify-center gap-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors ${touchMode ? 'py-3 text-sm' : 'py-2.5 text-xs'}`}
          >
            <Banknote size={touchMode ? 20 : 16} />
            Charge
          </button>
        </div>

        {/* Full charge button for larger view */}
        <div className="px-4 pb-4 shrink-0">
          <button
            onClick={() => setShowPayment(true)}
            disabled={items.length === 0}
            className={`w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${touchMode ? 'py-4 text-xl' : 'py-3.5 text-lg'}`}
          >
            <CreditCard size={touchMode ? 24 : 20} />
            {items.length === 0 ? 'Add items to charge' : `Pay ₹${total.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* ── Modals & Panels ───────────────────────────────────────────────────── */}

      {showPayment && (
        <PaymentModal
          total={total}
          onClose={() => setShowPayment(false)}
          onConfirm={handleCheckout}
          creditNotes={customerCreditNotes}
        />
      )}

      {successData && (
        <PaymentSuccessModal
          orderNumber={successData.orderNumber}
          invoiceId={successData.invoiceId}
          invoiceNumber={successData.invoiceNumber}
          total={successData.total}
          onClose={() => { setSuccessData(null); setCustomer(null) }}
        />
      )}

      {showCustomerSearch && (
        <CustomerSearchModal
          onClose={() => setShowCustomerSearch(false)}
          onSelect={(c: Customer) => {
            setCustomer(c)
            setShowCustomerSearch(false)
            creditNoteApi.getByCustomer(c.id).then(r => {
              setCustomerCreditNotes((r.data.data ?? []).filter((n: any) => n.status === 'ACTIVE'))
            }).catch(() => {})
          }}
        />
      )}

      {showHoldModal && (
        <HoldModal
          onClose={() => setShowHoldModal(false)}
          onHold={(note) => { holdCart(note); toast.success('Order held') }}
        />
      )}

      {showHeldPanel && (
        <HeldPanel onClose={() => setShowHeldPanel(false)} touchMode={touchMode} />
      )}

      {showStaffPicker && outletId && (
        <StaffPickerModal
          outletId={outletId}
          currentStaffId={salesStaffId}
          onSelect={(id, name) => { setSalesStaff(id, name); toast.success(`Sales staff: ${name}`) }}
          onClose={() => setShowStaffPicker(false)}
        />
      )}

      {variantPickerProduct && (
        <VariantPickerModal
          product={variantPickerProduct}
          onSelect={(prod, variantId, variantName, price) => addProductToCart(prod, variantId, variantName, price)}
          onClose={() => setVariantPickerProduct(null)}
          touchMode={touchMode}
        />
      )}
    </div>
  )
}
