import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'
import { ApiResponse } from '@/types'

const BASE_URL = '/api'

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401, then retry original request
let isRefreshing = false
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = []

const drainQueue = (err: any, token: string | null) => {
  pendingQueue.forEach(p => err ? p.reject(err) : p.resolve(token!))
  pendingQueue = []
}

const clearSession = () => {
  localStorage.clear()
  toast.error('Session expired. Please log in again.')
  setTimeout(() => { window.location.href = '/login' }, 1500)
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    // Don't try to refresh the refresh call itself
    if (original.url?.includes('/auth/refresh')) {
      clearSession()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true

    const stored = localStorage.getItem('pos-auth')
    let refreshToken: string | null = null
    try {
      refreshToken = stored ? JSON.parse(stored)?.state?.refreshToken : null
    } catch { /* ignore parse error */ }

    if (!refreshToken) {
      clearSession()
      return Promise.reject(error)
    }

    try {
      const res = await axios.post(`${BASE_URL}/auth/refresh`, null, { params: { refreshToken } })
      const { accessToken, refreshToken: newRefresh } = res.data.data
      localStorage.setItem('accessToken', accessToken)

      // Patch the persisted zustand state so the store has the new tokens
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          parsed.state.accessToken  = accessToken
          parsed.state.refreshToken = newRefresh
          localStorage.setItem('pos-auth', JSON.stringify(parsed))
        } catch { /* ignore */ }
      }

      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`
      drainQueue(null, accessToken)
      original.headers.Authorization = `Bearer ${accessToken}`
      return api(original)
    } catch (refreshErr) {
      drainQueue(refreshErr, null)
      clearSession()
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  }
)

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<any>>('/auth/login', { email, password }),
  register: (data: any) => api.post<ApiResponse<any>>('/auth/register', data),
  refresh: (refreshToken: string) =>
    api.post<ApiResponse<any>>('/auth/refresh', null, { params: { refreshToken } }),
}

// Profile
export const profileApi = {
  get:    ()           => api.get<ApiResponse<any>>('/users/me'),
  update: (data: any)  => api.put<ApiResponse<any>>('/users/me', data),
}

// Categories
export const categoryApi = {
  getAll: (active?: boolean) =>
    api.get<ApiResponse<any[]>>('/categories', { params: active !== undefined ? { active } : {} }),
  getRoots: (active = true) =>
    api.get<ApiResponse<any[]>>('/categories/roots', { params: { active } }),
  getChildren: (id: number, active = true) =>
    api.get<ApiResponse<any[]>>(`/categories/${id}/children`, { params: { active } }),
  getById: (id: number) => api.get<ApiResponse<any>>(`/categories/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>('/categories', data),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/categories/${id}`, data),
  toggleActive: (id: number) => api.patch<ApiResponse<any>>(`/categories/${id}/toggle-active`),
  delete: (id: number) => api.delete<ApiResponse<any>>(`/categories/${id}`),
}

// Products
export const productApi = {
  getAll: (params?: any) => api.get<ApiResponse<any>>('/products', { params }),
  getById: (id: number) => api.get<ApiResponse<any>>(`/products/${id}`),
  getByBarcode: (barcode: string) => api.get<ApiResponse<any>>(`/products/barcode/${barcode}`),
  search: (q: string) => api.get<ApiResponse<any>>('/products/search', { params: { q } }),
  getUnits: () => api.get<ApiResponse<string[]>>('/products/units'),
  getByCategory: (categoryId: number) => api.get<ApiResponse<any>>(`/products/category/${categoryId}`),
  getLowStock: (outletId: number) => api.get<ApiResponse<any>>('/products/low-stock', { params: { outletId } }),
  create: (data: any, categoryId?: number, taxGroupId?: number) =>
    api.post<ApiResponse<any>>('/products', data, { params: { categoryId, taxGroupId } }),
  update: (id: number, data: any, categoryId?: number, taxGroupId?: number) =>
    api.put<ApiResponse<any>>(`/products/${id}`, data, { params: { categoryId, taxGroupId } }),
  importFile: (file: File, dryRun: boolean) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<ApiResponse<any>>('/products/import', form, {
      params: { dryRun },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  downloadTemplate: () => api.get('/products/import/template', { responseType: 'blob' }),
  exportCsv: () => api.get('/products/export/csv', { responseType: 'blob' }),
  exportExcel: () => api.get('/products/export/excel', { responseType: 'blob' }),
  toggleActive: (id: number) => api.patch<ApiResponse<any>>(`/products/${id}/toggle-active`),
  generateBarcode: () => api.get<ApiResponse<string>>('/products/generate-barcode'),
  delete: (id: number) => api.delete<ApiResponse<any>>(`/products/${id}`),
}

// Product Variants
export const variantApi = {
  getAll: (productId: number) =>
    api.get<ApiResponse<any[]>>(`/products/${productId}/variants`),
  create: (productId: number, data: any) =>
    api.post<ApiResponse<any>>(`/products/${productId}/variants`, data),
  update: (productId: number, variantId: number, data: any) =>
    api.put<ApiResponse<any>>(`/products/${productId}/variants/${variantId}`, data),
  delete: (productId: number, variantId: number) =>
    api.delete<ApiResponse<any>>(`/products/${productId}/variants/${variantId}`),
}

// Price Lists
export const priceListApi = {
  getAll: () => api.get<ApiResponse<any[]>>('/price-lists'),
  getById: (id: number) => api.get<ApiResponse<any>>(`/price-lists/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>('/price-lists', data),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/price-lists/${id}`, data),
  toggleActive: (id: number) => api.patch<ApiResponse<any>>(`/price-lists/${id}/toggle-active`),
  delete: (id: number) => api.delete<ApiResponse<any>>(`/price-lists/${id}`),
  resolvePrice: (productId: number, variantId?: number, customerId?: number) =>
    api.get<ApiResponse<{ price: number; source: string }>>('/price-lists/resolve/price', {
      params: { productId, variantId, customerId },
    }),
}

// UoM Conversion helpers
export const uomApi = {
  /** Fetch a product's full UoM config (reuses productApi.getById) */
  getProductUom: (productId: number) =>
    api.get<ApiResponse<any>>(`/products/${productId}`),
  /** Update just the UoM fields on a product */
  updateUom: (productId: number, data: {
    unitOfMeasure?: string
    purchaseUom?: string | null
    saleUom?: string | null
    purchaseFactor?: number
    saleFactor?: number
  }) => api.put<ApiResponse<any>>(`/products/${productId}`, data),
}

// Inventory
export const inventoryApi = {
  getStock: (productId: number, outletId: number) =>
    api.get<ApiResponse<any>>(`/inventory/product/${productId}/outlet/${outletId}`),
  getStockAllOutlets: (productId: number) =>
    api.get<ApiResponse<any>>(`/inventory/product/${productId}/all-outlets`),
  getAllByOutlet: (outletId: number) =>
    api.get<ApiResponse<any>>(`/inventory/outlet/${outletId}`),
  getLowStock: (outletId: number) =>
    api.get<ApiResponse<any>>('/inventory/low-stock', { params: { outletId } }),
  adjust: (data: any) => api.post<ApiResponse<any>>('/inventory/adjust', data),
  getAdjustments: (outletId: number, params?: any) =>
    api.get<ApiResponse<any>>('/inventory/adjustments', { params: { outletId, ...params } }),
  createTransfer: (data: any) => api.post<ApiResponse<any>>('/inventory/transfers', data),
  approveTransfer: (id: number, approvedById: number) =>
    api.put<ApiResponse<any>>(`/inventory/transfers/${id}/approve`, null, { params: { approvedById } }),
  shipTransfer: (id: number) => api.put<ApiResponse<any>>(`/inventory/transfers/${id}/ship`),
  receiveTransfer: (id: number, data: any) =>
    api.put<ApiResponse<any>>(`/inventory/transfers/${id}/receive`, data),
  getTransfers: (outletId: number, params?: any) =>
    api.get<ApiResponse<any>>('/inventory/transfers', { params: { outletId, ...params } }),
}

// Orders
export const orderApi = {
  checkout: (data: any) => api.post<ApiResponse<any>>('/orders/checkout', data),
  processReturn: (data: any) => api.post<ApiResponse<any>>('/orders/return', data),
  getReturns: (outletId: number, params?: { from?: string; to?: string }) =>
    api.get<ApiResponse<any>>(`/orders/returns/${outletId}`, { params }),
  getByOrderNumber: (orderNumber: string) =>
    api.get<ApiResponse<any>>(`/orders/${orderNumber}`),
  getByOutlet: (outletId: number, params?: any) =>
    api.get<ApiResponse<any>>(`/orders/outlet/${outletId}`, { params }),
  getByCustomer: (customerId: number, params?: any) =>
    api.get<ApiResponse<any>>(`/orders/customer/${customerId}`, { params }),
  holdOrder: (orderId: number) => api.put<ApiResponse<any>>(`/orders/${orderId}/hold`),
}

// Customers
export const customerApi = {
  getAll: (params?: any) => api.get<ApiResponse<any>>('/customers', { params }),
  getById: (id: number) => api.get<ApiResponse<any>>(`/customers/${id}`),
  getByPhone: (phone: string) => api.get<ApiResponse<any>>(`/customers/phone`, { params: { q: phone } }),
  search: (q: string) => api.get<ApiResponse<any>>('/customers/search', { params: { q } }),
  create: (data: any) => api.post<ApiResponse<any>>('/customers', data),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/customers/${id}`, data),
  getLoyaltyHistory: (id: number, params?: any) =>
    api.get<ApiResponse<any>>(`/customers/${id}/loyalty-history`, { params }),
  getWithDues: () => api.get<ApiResponse<any>>('/customers/with-dues'),
  importFile: (file: File, dryRun: boolean) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<ApiResponse<any>>('/customers/import', form, {
      params: { dryRun },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  downloadTemplate: () => api.get('/customers/import/template', { responseType: 'blob' }),
  exportCsv: () => api.get('/customers/export/csv', { responseType: 'blob' }),
  exportExcel: () => api.get('/customers/export/excel', { responseType: 'blob' }),
}

// Vendors
export const vendorApi = {
  getAll: () => api.get<ApiResponse<any>>('/vendors'),
  getById: (id: number) => api.get<ApiResponse<any>>(`/vendors/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>('/vendors', data),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/vendors/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<any>>(`/vendors/${id}`),
  importFile: (file: File, dryRun: boolean) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<ApiResponse<any>>('/vendors/import', form, {
      params: { dryRun },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  downloadTemplate: () => api.get('/vendors/import/template', { responseType: 'blob' }),
  exportCsv: () => api.get('/vendors/export/csv', { responseType: 'blob' }),
  exportExcel: () => api.get('/vendors/export/excel', { responseType: 'blob' }),
}

// Discounts
export const discountApi = {
  getAll: () => api.get<ApiResponse<any>>('/discounts'),
  create: (data: any) => api.post<ApiResponse<any>>('/discounts', data),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/discounts/${id}`, data),
  getProductDiscounts: (productId: number) =>
    api.get<ApiResponse<any>>(`/discounts/product/${productId}/active`),
  itemPreview: (productId: number, quantity: number, unitPrice: number) =>
    api.get<ApiResponse<{ discountPct: number; discountAmt: number; label: string }>>(
      `/discounts/item-preview?productId=${productId}&quantity=${quantity}&unitPrice=${unitPrice}`
    ),
  getAllCoupons: () => api.get<ApiResponse<any>>('/discounts/coupons'),
  validateCoupon: (data: { code: string; orderAmount: number; customerId?: number | null }) =>
    api.post<ApiResponse<{ code: string; description: string; discountAmount: number; valueDisplay: string }>>('/discounts/coupons/validate', data),
  createCoupon: (data: any) => api.post<ApiResponse<any>>('/discounts/coupons', data),
  updateCoupon: (id: number, data: any) => api.put<ApiResponse<any>>(`/discounts/coupons/${id}`, data),
  deleteDiscount: (id: number) => api.delete<ApiResponse<any>>(`/discounts/${id}`),
  deleteCoupon: (id: number) => api.delete<ApiResponse<any>>(`/discounts/coupons/${id}`),
}

// Credit Notes
export const creditNoteApi = {
  create: (data: any) => api.post<ApiResponse<any>>('/credit-notes', data),
  getAll: (outletId: number, page = 0, size = 100) =>
    api.get<ApiResponse<any>>('/credit-notes', { params: { outletId, page, size } }),
  getByCustomer: (customerId: number) =>
    api.get<ApiResponse<any>>(`/credit-notes/customer/${customerId}`),
  getActiveByCustomer: (customerId: number) =>
    api.get<ApiResponse<any>>(`/credit-notes/customer/${customerId}/active`),
  cancel: (id: number, reason: string) =>
    api.put<ApiResponse<any>>(`/credit-notes/${id}/cancel`, null, { params: { reason } }),
}

// Shifts
export const shiftApi = {
  open: (data: any) => api.post<ApiResponse<any>>('/shifts/open', data),
  close: (shiftId: number, data: any) => api.put<ApiResponse<any>>(`/shifts/${shiftId}/close`, data),
  getCurrent: (cashierId: number) => api.get<ApiResponse<any>>(`/shifts/current/${cashierId}`),
  getByOutlet: (outletId: number) => api.get<ApiResponse<any>>(`/shifts/outlet/${outletId}`),
}

// Reports
export const reportApi = {
  getSalesSummary:    (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/sales-summary', { params: { outletId, from, to } }),
  getTopProducts:     (outletId: number, from: string, to: string, limit = 10) =>
    api.get<ApiResponse<any>>('/reports/top-products', { params: { outletId, from, to, limit } }),
  getPaymentMethods:  (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/payment-methods', { params: { outletId, from, to } }),
  getDailyTrend:      (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/daily-trend', { params: { outletId, from, to } }),
  getSalesByCategory: (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/sales-by-category', { params: { outletId, from, to } }),
  getSalesByProduct:  (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/sales-by-product', { params: { outletId, from, to } }),
  getSalesByCustomer: (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/sales-by-customer', { params: { outletId, from, to } }),
  exportSalesCsv:     (outletId: number, from: string, to: string) =>
    api.get('/reports/export/sales-csv', { params: { outletId, from, to }, responseType: 'blob' }),
  getPurchaseSummary:    (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/purchase-summary', { params: { outletId, from, to } }),
  getPurchaseBySupplier: (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/purchase-by-supplier', { params: { outletId, from, to } }),
  getOutstandingPOs:     (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/outstanding-pos', { params: { outletId, from, to } }),
  getSaleReturns:        (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/sale-returns', { params: { outletId, from, to } }),
  getPurchaseReturns:    (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/purchase-returns', { params: { outletId, from, to } }),
  getOutstandingReceivable: (outletId: number) =>
    api.get<ApiResponse<any>>('/reports/outstanding-receivable', { params: { outletId } }),
  exportPurchaseCsv:     (outletId: number, from: string, to: string) =>
    api.get('/reports/export/purchase-csv', { params: { outletId, from, to }, responseType: 'blob' }),
  getPaymentMethodReport: (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/reports/payment-method-report', { params: { outletId, from, to } }),
  exportPaymentCsv: (outletId: number, from: string, to: string) =>
    api.get('/reports/export/payment-csv', { params: { outletId, from, to }, responseType: 'blob' }),
  getDebtorsLedger:      (outletId: number) =>
    api.get<ApiResponse<any>>('/reports/debtors-ledger', { params: { outletId } }),
  getCreditorsLedger:    (outletId: number) =>
    api.get<ApiResponse<any>>('/reports/creditors-ledger', { params: { outletId } }),
  exportDebtorsCsv:      (outletId: number) =>
    api.get('/reports/export/debtors-csv', { params: { outletId }, responseType: 'blob' }),
  exportCreditorsCsv:    (outletId: number) =>
    api.get('/reports/export/creditors-csv', { params: { outletId }, responseType: 'blob' }),
}

// Product Images
export const productImageApi = {
  getImages: (productId: number) =>
    api.get<ApiResponse<any[]>>(`/products/${productId}/images`),
  upload: (productId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<ApiResponse<any>>(`/products/${productId}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (productId: number, imageId: number) =>
    api.delete<ApiResponse<any>>(`/products/${productId}/images/${imageId}`),
  setPrimary: (productId: number, imageId: number) =>
    api.put<ApiResponse<any>>(`/products/${productId}/images/${imageId}/primary`),
}

// Tax Groups
export const taxGroupApi = {
  getAll: (active?: boolean) =>
    api.get<ApiResponse<any[]>>('/tax-groups', { params: active !== undefined ? { active } : {} }),
  getById: (id: number) => api.get<ApiResponse<any>>(`/tax-groups/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>('/tax-groups', data),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/tax-groups/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<any>>(`/tax-groups/${id}`),
}

// Staff / Users
export const staffApi = {
  getByOutlet: (outletId: number) => api.get<ApiResponse<any[]>>(`/users/outlet/${outletId}`),
  getAll: (params?: any) => api.get<ApiResponse<any[]>>('/users', { params }),
  getById: (id: number) => api.get<ApiResponse<any>>(`/users/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>('/users', data),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/users/${id}`, data),
  toggleActive: (id: number) => api.put<ApiResponse<any>>(`/users/${id}/toggle-active`),
  resetPassword: (id: number, password: string) =>
    api.put<ApiResponse<any>>(`/users/${id}/reset-password`, { password }),
}

// Roles
export const rolesApi = {
  getAll: () => api.get<ApiResponse<any[]>>('/roles'),
  create: (data: any) => api.post<ApiResponse<any>>('/roles', data),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/roles/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<any>>(`/roles/${id}`),
}

// Invoices
export const invoiceApi = {
  create: (data: any) => api.post<ApiResponse<any>>('/invoices', data),
  getByOutlet: (outletId: number, params?: any) =>
    api.get<ApiResponse<any>>('/invoices', { params: { outletId, ...params } }),
  getById: (id: number) => api.get<ApiResponse<any>>(`/invoices/${id}`),
  updateStatus: (id: number, status: string) =>
    api.patch<ApiResponse<any>>(`/invoices/${id}/status`, {}, { params: { status } }),
  recordPayment: (id: number, amount: number) =>
    api.patch<ApiResponse<any>>(`/invoices/${id}/payment`, {}, { params: { amount } }),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/invoices/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<any>>(`/invoices/${id}`),
}

// Quotations
export const quotationApi = {
  create: (data: any) => api.post<ApiResponse<any>>('/quotations', data),
  getByOutlet: (outletId: number, params?: any) =>
    api.get<ApiResponse<any>>('/quotations', { params: { outletId, ...params } }),
  getById: (id: number) => api.get<ApiResponse<any>>(`/quotations/${id}`),
  updateStatus: (id: number, status: string) =>
    api.patch<ApiResponse<any>>(`/quotations/${id}/status`, null, { params: { status } }),
}

// Purchase Returns
export const purchaseReturnApi = {
  create: (data: any) => api.post<ApiResponse<any>>('/purchase-returns', data),
  getByOutlet: (outletId: number, params?: any) =>
    api.get<ApiResponse<any>>('/purchase-returns', { params: { outletId, ...params } }),
}

// Purchase Orders
export const purchaseOrderApi = {
  getByOutlet: (outletId: number, params?: any) =>
    api.get<ApiResponse<any>>('/purchase-orders', { params: { outletId, ...params } }),
  getByPoNumber: (poNumber: string) =>
    api.get<ApiResponse<any>>(`/purchase-orders/${poNumber}`),
  create: (data: any) =>
    api.post<ApiResponse<any>>('/purchase-orders', data),
  createDirect: (data: any) =>
    api.post<ApiResponse<any>>('/purchase-orders/direct', data),
  update: (id: number, data: any) =>
    api.put<ApiResponse<any>>(`/purchase-orders/${id}`, data),
  updateStatus: (id: number, status: string) =>
    api.patch<ApiResponse<any>>(`/purchase-orders/${id}/status`, null, { params: { status } }),
  delete: (id: number) =>
    api.delete<ApiResponse<any>>(`/purchase-orders/${id}`),
}

// Purchase Bills
export const purchaseBillApi = {
  getByOutlet: (outletId: number, params?: any) =>
    api.get<ApiResponse<any>>('/purchase-bills', { params: { outletId, ...params } }),
  getById: (id: number) =>
    api.get<ApiResponse<any>>(`/purchase-bills/${id}`),
  getSummary: (outletId: number) =>
    api.get<ApiResponse<any>>('/purchase-bills/summary', { params: { outletId } }),
  create: (data: any) =>
    api.post<ApiResponse<any>>('/purchase-bills', data),
  convertFromPO: (poId: number, data: any) =>
    api.post<ApiResponse<any>>(`/purchase-bills/from-po/${poId}`, data),
  recordPayment: (id: number, amount: number) =>
    api.post<ApiResponse<any>>(`/purchase-bills/${id}/payment`, { amount }),
  delete: (id: number) =>
    api.delete<ApiResponse<any>>(`/purchase-bills/${id}`),
}

// Incentives
export const incentiveApi = {
  getRules: (outletId?: number) =>
    api.get<ApiResponse<any[]>>('/incentives/rules', { params: outletId ? { outletId } : {} }),
  createRule: (data: any) => api.post<ApiResponse<any>>('/incentives/rules', data),
  updateRule: (id: number, data: any) => api.put<ApiResponse<any>>(`/incentives/rules/${id}`, data),
  deleteRule: (id: number) => api.delete<ApiResponse<any>>(`/incentives/rules/${id}`),
  getPayouts: (outletId: number, month: number, year: number) =>
    api.get<ApiResponse<any[]>>('/incentives/payouts', { params: { outletId, month, year } }),
  getLeaderboard: (outletId: number, month: number, year: number) =>
    api.get<ApiResponse<any[]>>('/incentives/leaderboard', { params: { outletId, month, year } }),
  recalculate: (outletId: number, month: number, year: number) =>
    api.post<ApiResponse<any>>('/incentives/recalculate', { outletId, month, year }),
}

// Bulk Purchases
export const bulkPurchaseApi = {
  record: (data: any) => api.post<ApiResponse<any>>('/bulk-purchases', data),
  getHistory: (outletId: number, params?: any) =>
    api.get<ApiResponse<any>>('/bulk-purchases', { params: { outletId, ...params } }),
  getByProduct: (productId: number, outletId: number) =>
    api.get<ApiResponse<any>>(`/bulk-purchases/product`, { params: { productId, outletId } }),
  getStats: (outletId: number) =>
    api.get<ApiResponse<any>>('/bulk-purchases/stats', { params: { outletId } }),
  updateConversionStatus: (id: number, status: 'NOT_CONVERTED' | 'PARTIALLY_CONVERTED' | 'CONVERTED') =>
    api.patch<ApiResponse<any>>(`/bulk-purchases/${id}/conversion-status`, null, { params: { status } }),
  convert: (id: number, data: { targetProductId: number; fromBaseQty: number; saleQty: number; saleUom: string; notes?: string }) =>
    api.post<ApiResponse<any>>(`/bulk-purchases/${id}/convert`, data),
  getConversions: (id: number) =>
    api.get<ApiResponse<any>>(`/bulk-purchases/${id}/conversions`),
}

// Expense Categories
export const expenseCategoryApi = {
  getAll: (activeOnly = true) =>
    api.get<ApiResponse<any>>('/expense-categories', { params: { activeOnly } }),
  create: (data: { name: string; description?: string; color?: string; icon?: string; monthlyBudget?: number | null }) =>
    api.post<ApiResponse<any>>('/expense-categories', data),
  update: (id: number, data: { name: string; description?: string; color?: string; icon?: string; monthlyBudget?: number | null }) =>
    api.put<ApiResponse<any>>(`/expense-categories/${id}`, data),
  toggleActive: (id: number) =>
    api.patch<ApiResponse<any>>(`/expense-categories/${id}/toggle-active`),
  delete: (id: number) =>
    api.delete<ApiResponse<any>>(`/expense-categories/${id}`),
}

// Expenses
export const expenseApi = {
  getAll: (params: {
    outletId: number; from?: string; to?: string; categoryId?: number;
    paymentMode?: string; status?: string; itcEligible?: boolean;
    page?: number; size?: number; sort?: string;
  }) => api.get<ApiResponse<any>>('/expenses', { params }),
  getStats: (outletId: number, from?: string, to?: string) =>
    api.get<ApiResponse<any>>('/expenses/stats', { params: { outletId, from, to } }),
  create: (data: any) => api.post<ApiResponse<any>>('/expenses', data),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/expenses/${id}`, data),
  updateStatus: (id: number, status: string) =>
    api.patch<ApiResponse<any>>(`/expenses/${id}/status`, null, { params: { status } }),
  delete: (id: number) => api.delete<ApiResponse<any>>(`/expenses/${id}`),
  exportCsv: (params: { outletId: number; from?: string; to?: string; categoryId?: number; paymentMode?: string; status?: string }) =>
    api.get('/expenses/export/csv', { params, responseType: 'blob' }),
  generateRecurring: () => api.post<ApiResponse<any>>('/expenses/generate-recurring'),
}

// GST Reports
export const gstApi = {
  getGstr1: (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/gst/gstr1', { params: { outletId, from, to } }),
  getGstr3b: (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/gst/gstr3b', { params: { outletId, from, to } }),
  getHsnSummary: (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/gst/hsn-summary', { params: { outletId, from, to } }),
  exportGstr1Csv: (outletId: number, from: string, to: string) =>
    api.get('/gst/gstr1/export', { params: { outletId, from, to }, responseType: 'blob' }),
  exportGstr3bCsv: (outletId: number, from: string, to: string) =>
    api.get('/gst/gstr3b/export', { params: { outletId, from, to }, responseType: 'blob' }),
  exportHsnCsv: (outletId: number, from: string, to: string) =>
    api.get('/gst/hsn-summary/export', { params: { outletId, from, to }, responseType: 'blob' }),
  getHsnPurchaseSummary: (outletId: number, from: string, to: string) =>
    api.get<ApiResponse<any>>('/gst/hsn-purchase-summary', { params: { outletId, from, to } }),
  exportHsnPurchaseCsv: (outletId: number, from: string, to: string) =>
    api.get('/gst/hsn-purchase-summary/export', { params: { outletId, from, to }, responseType: 'blob' }),
  tallyExport: (outletId: number, from: string, to: string) =>
    api.get('/gst/tally-export', { params: { outletId, from, to }, responseType: 'blob' }),
}

export const outletApi = {
  getAll: () => api.get<ApiResponse<{ id: number; name: string; code: string }[]>>('/outlets'),
  getById: (id: number) => api.get<ApiResponse<any>>(`/outlets/${id}`),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/outlets/${id}`, data),
}

export const integrationApi = {
  getChannels: (outletId: number) =>
    api.get<ApiResponse<any>>('/integrations/channels', { params: { outletId } }),
  saveChannels: (outletId: number, data: any) =>
    api.put<ApiResponse<any>>('/integrations/channels', { outletId, ...data }),
  getTemplates: (outletId: number) =>
    api.get<ApiResponse<any>>('/integrations/templates', { params: { outletId } }),
  saveTemplates: (outletId: number, data: any) =>
    api.put<ApiResponse<any>>('/integrations/templates', { outletId, templates: data }),
  testChannel: (outletId: number, channel: string) =>
    api.post<ApiResponse<any>>('/integrations/test', { outletId, channel }),
  sendInvoiceEmail: (invoiceId: number, outletId: number) =>
    api.post<ApiResponse<any>>('/integrations/send/invoice-email', { invoiceId, outletId }),
  sendQuotationEmail: (quotationId: number, outletId: number) =>
    api.post<ApiResponse<any>>('/integrations/send/quotation-email', { quotationId, outletId }),
}

export const activityLogApi = {
  search: (outletId: number, params?: {
    module?: string; action?: string; userId?: number;
    from?: string; to?: string; search?: string; page?: number; size?: number;
  }) => api.get<ApiResponse<any>>('/activity-logs', { params: { outletId, ...params } }),

  getFilterOptions: (outletId: number) =>
    api.get<ApiResponse<any>>('/activity-logs/filters', { params: { outletId } }),
}

export const salesOrderApi = {
  create: (data: any) => api.post<ApiResponse<any>>('/sales-orders', data),
  getAll: (params?: any) => api.get<ApiResponse<any>>('/sales-orders', { params }),
  getById: (id: number) => api.get<ApiResponse<any>>(`/sales-orders/${id}`),
  update: (id: number, data: any) => api.put<ApiResponse<any>>(`/sales-orders/${id}`, data),
  confirm: (id: number) => api.patch<ApiResponse<any>>(`/sales-orders/${id}/confirm`),
  deliver: (id: number, data: any) => api.patch<ApiResponse<any>>(`/sales-orders/${id}/deliver`, data),
  generateInvoice: (id: number, data?: any) => api.post<ApiResponse<any>>(`/sales-orders/${id}/invoice`, data ?? {}),
  cancel: (id: number) => api.patch<ApiResponse<any>>(`/sales-orders/${id}/cancel`),
  delete: (id: number) => api.delete<ApiResponse<any>>(`/sales-orders/${id}`),
}

export default api
