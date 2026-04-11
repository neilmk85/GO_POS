export interface User {
  id: number
  name: string
  email: string
  phone?: string
  roles: string[]
  outletId?: number
  outletName?: string
  active: boolean
}

export interface Outlet {
  id: number
  name: string
  code: string
  address?: string
  city?: string
  state?: string
  phone?: string
  gstin?: string
  active: boolean
  receiptHeader?: string
  receiptFooter?: string
  printReceiptByDefault?: boolean
  showTaxBreakdown?: boolean
  showBarcodeOnReceipt?: boolean
}

export interface Category {
  id: number
  name: string
  description?: string
  imageUrl?: string
  parentId?: number
  active: boolean
}

export interface TaxGroup {
  id: number
  name: string
  totalRate: number
  cgstRate?: number
  sgstRate?: number
  hsnCode?: string
  inclusive: boolean
  active: boolean
}

export interface ProductVariant {
  id: number
  productId: number
  name: string
  sku?: string
  barcode?: string
  attribute1Name?: string
  attribute1Value?: string
  attribute2Name?: string
  attribute2Value?: string
  priceAdjustment: number
  costPrice?: number
  imageUrl?: string
  active: boolean
}

export interface Product {
  id: number
  name: string
  description?: string
  sku?: string
  barcode?: string
  category?: Category
  taxGroup?: TaxGroup
  costPrice?: number
  sellingPrice: number
  mrp?: number
  minSellingPrice?: number
  unitOfMeasure: string
  productType: 'PHYSICAL' | 'SERVICE' | 'DIGITAL' | 'COMBO'
  trackInventory: boolean
  reorderLevel: number
  imageUrl?: string
  active: boolean
  featured: boolean
  variants?: ProductVariant[]
}

export interface PriceListItem {
  id: number
  priceListId: number
  productId: number
  variantId?: number
  product: { id: number; name: string; sku?: string; sellingPrice: number }
  variant?: { id: number; name: string; priceAdjustment: number }
  sellingPrice?: number
  discountPercent?: number
}

export interface PriceList {
  id: number
  name: string
  description?: string
  active: boolean
  priority: number
  startDate?: string
  endDate?: string
  segments: { segment: string }[]
  customers: { customerId: number; customer: { id: number; name: string; phone?: string } }[]
  items: PriceListItem[]
}

export interface Inventory {
  id: number
  product: Product
  outlet: Outlet
  quantityOnHand: number
  quantityReserved: number
  reorderLevel: number
}

export interface Customer {
  id: number
  name: string
  phone?: string
  phone2?: string
  email?: string
  address?: string
  city?: string
  state?: string
  gstin?: string
  segment: 'REGULAR' | 'SILVER' | 'GOLD' | 'VIP' | 'WHOLESALE'
  loyaltyPoints: number
  totalSpent: number
  creditLimit: number
  outstandingDue: number
  discountPercent: number
  active: boolean
  blacklisted: boolean
}

export interface CartItem {
  productId: number
  variantId?: number
  productName: string
  sku?: string
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  lineTotal: number
  imageUrl?: string
}

export interface Order {
  id: number
  orderNumber: string
  outlet: Outlet
  customer?: Customer
  status: string
  orderType: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  changeAmount: number
  loyaltyPointsEarned: number
  couponCode?: string
  items: OrderItem[]
  payments: Payment[]
  createdAt: string
}

export interface OrderItem {
  id: number
  productName: string
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
}

export interface Payment {
  id: number
  paymentMethod: string
  amount: number
  referenceNumber?: string
  status: string
}

export interface Discount {
  id: number
  name: string
  description?: string
  discountType: string
  applyOn: 'PRODUCT' | 'CATEGORY' | 'CART' | 'CUSTOMER'
  valueType: 'PERCENTAGE' | 'FLAT' | 'BUY_X_GET_Y'
  value: number
  minOrderAmount?: number
  startDate?: string
  endDate?: string
  active: boolean
  stackable?: boolean
  priority?: number
  products?: { id: number; name: string; sku?: string }[]
  categories?: { id: number; name: string }[]
}

export interface Coupon {
  id: number
  code: string
  description?: string
  valueType: 'PERCENTAGE' | 'FLAT'
  value: number
  minOrderAmount: number
  maxDiscountAmount?: number
  startDate?: string
  expiryDate?: string
  timesUsed: number
  usageLimit?: number
  usagePerCustomer?: number
  active: boolean
}

export interface CreditNote {
  id: number
  creditNoteNumber: string
  customer: Customer
  totalAmount: number
  usedAmount: number
  remainingAmount: number
  expiryDate?: string
  status: 'ACTIVE' | 'FULLY_USED' | 'EXPIRED' | 'CANCELLED'
  reason?: string
}

export interface Shift {
  id: number
  outlet: Outlet
  cashier: User
  openedAt: string
  closedAt?: string
  openingCash: number
  closingCash?: number
  expectedCash?: number
  cashVariance?: number
  totalSales: number
  totalOrders: number
  status: 'OPEN' | 'CLOSED'
}

export interface StockTransfer {
  id: number
  transferNumber: string
  fromOutlet: Outlet
  toOutlet: Outlet
  status: string
  items: StockTransferItem[]
  createdAt: string
}

export interface StockTransferItem {
  id: number
  product: Product
  requestedQuantity: number
  shippedQuantity: number
  receivedQuantity: number
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
  errors?: Record<string, string>
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}
