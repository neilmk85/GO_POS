import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CartItem, Customer } from '@/types'

export interface HeldOrder {
  id: string
  items: CartItem[]
  customer: Customer | null
  couponCode: string
  billDiscount: number
  billDiscountType: 'percent' | 'flat'
  note: string
  heldAt: string
}

interface CartState {
  items: CartItem[]
  customer: Customer | null
  couponCode: string
  couponDiscountAmount: number
  billDiscount: number
  billDiscountType: 'percent' | 'flat'
  shiftId: number | null
  heldOrders: HeldOrder[]
  salesStaffId: number | null
  salesStaffName: string

  addItem: (item: CartItem) => void
  updateQuantity: (productId: number, variantId: number | undefined, quantity: number) => void
  updateDiscount: (productId: number, variantId: number | undefined, discountPercent: number) => void
  updateItemPrice: (productId: number, variantId: number | undefined, price: number) => void
  removeItem: (productId: number, variantId?: number) => void
  clearCart: () => void
  setCustomer: (customer: Customer | null) => void
  setCouponCode: (code: string) => void
  setCouponDiscountAmount: (amount: number) => void
  setBillDiscount: (value: number, type: 'percent' | 'flat') => void
  setShiftId: (id: number | null) => void
  setSalesStaff: (id: number | null, name: string) => void

  holdCart: (note?: string) => void
  restoreCart: (id: string) => void
  deleteHeld: (id: string) => void

  getSubtotal: () => number
  getTotalDiscount: () => number
  getTotalTax: () => number
  getBillDiscountAmount: () => number
  getTotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customer: null,
      couponCode: '',
      couponDiscountAmount: 0,
      billDiscount: 0,
      billDiscountType: 'flat',
      shiftId: null,
      heldOrders: [],
      salesStaffId: null,
      salesStaffName: '',

      addItem: (newItem) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === newItem.productId && i.variantId === newItem.variantId
          )
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === newItem.productId && i.variantId === newItem.variantId
                  ? { ...i, quantity: i.quantity + newItem.quantity }
                  : i
              ),
            }
          }
          return { items: [...state.items, newItem] }
        })
      },

      updateQuantity: (productId, variantId, quantity) => {
        if (quantity <= 0) { get().removeItem(productId, variantId); return }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, quantity, discountAmount: i.unitPrice * quantity * i.discountPercent / 100, taxAmount: i.unitPrice * (1 - i.discountPercent / 100) * quantity * i.taxRate / 100 }
              : i
          ),
        }))
      },

      updateDiscount: (productId, variantId, discountPercent) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, discountPercent, discountAmount: i.unitPrice * i.quantity * discountPercent / 100 }
              : i
          ),
        }))
      },

      updateItemPrice: (productId, variantId, price) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, unitPrice: price, discountAmount: price * i.quantity * i.discountPercent / 100, taxAmount: price * (1 - i.discountPercent / 100) * i.quantity * i.taxRate / 100 }
              : i
          ),
        }))
      },

      removeItem: (productId, variantId) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId)
          ),
        }))
      },

      clearCart: () => set({ items: [], customer: null, couponCode: '', couponDiscountAmount: 0, billDiscount: 0, billDiscountType: 'flat' }),

      setCustomer: (customer) => set((state) => {
        const discPct = customer?.discountPercent ?? 0
        return {
          customer,
          items: state.items.map(i => ({
            ...i,
            discountPercent: discPct,
            discountAmount: i.unitPrice * i.quantity * discPct / 100,
            taxAmount: i.unitPrice * (1 - discPct / 100) * i.quantity * i.taxRate / 100,
          })),
        }
      }),
      setCouponCode: (code) => set({ couponCode: code, couponDiscountAmount: 0 }),
      setCouponDiscountAmount: (amount) => set({ couponDiscountAmount: amount }),
      setBillDiscount: (value, type) => set({ billDiscount: value, billDiscountType: type }),
      setShiftId: (id) => set({ shiftId: id }),
      setSalesStaff: (id, name) => set({ salesStaffId: id, salesStaffName: name }),

      holdCart: (note = '') => {
        const { items, customer, couponCode, couponDiscountAmount, billDiscount, billDiscountType } = get()
        if (items.length === 0) return
        const held: HeldOrder = {
          id: Date.now().toString(),
          items, customer, couponCode, billDiscount, billDiscountType,
          note, heldAt: new Date().toISOString(),
        }
        set((state) => ({
          heldOrders: [...state.heldOrders, held],
          items: [], customer: null, couponCode: '', couponDiscountAmount: 0, billDiscount: 0, billDiscountType: 'flat',
        }))
      },

      restoreCart: (id) => {
        const held = get().heldOrders.find(h => h.id === id)
        if (!held) return
        set((state) => ({
          items: held.items, customer: held.customer,
          couponCode: held.couponCode, couponDiscountAmount: 0,
          billDiscount: held.billDiscount, billDiscountType: held.billDiscountType,
          heldOrders: state.heldOrders.filter(h => h.id !== id),
        }))
      },

      deleteHeld: (id) => {
        set((state) => ({ heldOrders: state.heldOrders.filter(h => h.id !== id) }))
      },

      getSubtotal: () => get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
      getTotalDiscount: () => get().items.reduce((sum, i) => sum + i.discountAmount, 0),
      getTotalTax: () => get().items.reduce((sum, i) => sum + i.taxAmount, 0),
      getBillDiscountAmount: () => {
        const { billDiscount, billDiscountType, getSubtotal, getTotalDiscount } = get()
        const base = getSubtotal() - getTotalDiscount()
        return billDiscountType === 'percent' ? base * billDiscount / 100 : billDiscount
      },
      getTotal: () => {
        const { getSubtotal, getTotalDiscount, getTotalTax, getBillDiscountAmount, couponDiscountAmount } = get()
        return getSubtotal() - getTotalDiscount() - getBillDiscountAmount() - couponDiscountAmount + getTotalTax()
      },
    }),
    { name: 'pos-cart', partialize: (s) => ({ heldOrders: s.heldOrders, shiftId: s.shiftId, salesStaffId: s.salesStaffId, salesStaffName: s.salesStaffName }) }
  )
)
