import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import AppLayout from '@/layouts/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import POSPage from '@/pages/pos/POSPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import SalesReportPage from '@/pages/reports/SalesReportPage'
import PurchaseReportPage from '@/pages/reports/PurchaseReportPage'
import InventoryReportPage from '@/pages/reports/InventoryReportPage'
import GstReportPage from '@/pages/reports/GstReportPage'
import DebtorsReportPage from '@/pages/reports/DebtorsReportPage'
import PaymentReportPage from '@/pages/reports/PaymentReportPage'
import CreditorsReportPage from '@/pages/reports/CreditorsReportPage'
import ProductsPage from '@/pages/products/ProductsPage'
import ProductForm from '@/pages/products/ProductForm'
import CustomersPage from '@/pages/customers/CustomersPage'
import InventoryPage from '@/pages/inventory/InventoryPage'
import CategoriesPage from '@/pages/inventory/CategoriesPage'
import UomConversionPage from '@/pages/inventory/UomConversionPage'
import BulkPurchasePage from '@/pages/inventory/BulkPurchasePage'
import DirectPurchasePage from '@/pages/purchases/DirectPurchasePage'
import DiscountsPage from '@/pages/discounts/DiscountsPage'
import TransfersPage from '@/pages/inventory/TransfersPage'
import OrdersPage from '@/pages/orders/OrdersPage'
import CreateOrderPage from '@/pages/orders/CreateOrderPage'
import SalesOrdersPage from '@/pages/orders/SalesOrdersPage'
import CreateSalesOrderPage from '@/pages/orders/CreateSalesOrderPage'
import SalesOrderDetailPage from '@/pages/orders/SalesOrderDetailPage'
import EditSalesOrderPage from '@/pages/orders/EditSalesOrderPage'
import PaymentsReceivedPage from '@/pages/sales/PaymentsReceivedPage'
import ReturnsPage from '@/pages/sales/ReturnsPage'
import CreditNotesPage from '@/pages/sales/CreditNotesPage'
import DeliveryChallansPage from '@/pages/sales/DeliveryChallansPage'
import QuotationsPage from '@/pages/sales/QuotationsPage'
import InvoicesPage from '@/pages/sales/InvoicesPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import PurchasesPage from '@/pages/purchases/PurchasesPage'
import IncentivesPage from '@/pages/incentives/IncentivesPage'
import StaffPage from '@/pages/staff/StaffPage'
import ProfilePage from '@/pages/profile/ProfilePage'
import ActivityLogsPage from '@/pages/activity/ActivityLogsPage'
import ExpensesPage from '@/pages/expenses/ExpensesPage'
import ExpenseCategoriesPage from '@/pages/expenses/ExpenseCategoriesPage'
import InvoiceViewPage from '@/pages/public/InvoiceViewPage'
import PriceListsPage from '@/pages/pricing/PriceListsPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <AppLayout>{children}</AppLayout> : <Navigate to="/login" />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/invoice/:invoiceNumber" element={<InvoiceViewPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/pos" />} />
          <Route path="/pos" element={<ProtectedRoute><POSPage /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
          <Route path="/products/new" element={<ProtectedRoute><ProductForm /></ProtectedRoute>} />
          <Route path="/products/:id/edit" element={<ProtectedRoute><ProductForm /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
          <Route path="/inventory/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
          <Route path="/inventory/uom" element={<ProtectedRoute><UomConversionPage /></ProtectedRoute>} />
          <Route path="/inventory/bulk-purchase" element={<ProtectedRoute><BulkPurchasePage /></ProtectedRoute>} />
          <Route path="/customers/*" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="/orders/new" element={<ProtectedRoute><CreateOrderPage /></ProtectedRoute>} />
          <Route path="/sales-orders" element={<ProtectedRoute><SalesOrdersPage /></ProtectedRoute>} />
          <Route path="/sales-orders/new" element={<ProtectedRoute><CreateSalesOrderPage /></ProtectedRoute>} />
          <Route path="/sales-orders/:id" element={<ProtectedRoute><SalesOrderDetailPage /></ProtectedRoute>} />
          <Route path="/sales-orders/:id/edit" element={<ProtectedRoute><EditSalesOrderPage /></ProtectedRoute>} />
          <Route path="/sales/payments-received" element={<ProtectedRoute><PaymentsReceivedPage /></ProtectedRoute>} />
          <Route path="/sales/returns" element={<ProtectedRoute><ReturnsPage /></ProtectedRoute>} />
          <Route path="/sales/credit-notes" element={<ProtectedRoute><CreditNotesPage /></ProtectedRoute>} />
          <Route path="/sales/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
          <Route path="/sales/quotations" element={<ProtectedRoute><QuotationsPage /></ProtectedRoute>} />
          <Route path="/sales/delivery-challans" element={<ProtectedRoute><DeliveryChallansPage /></ProtectedRoute>} />
          <Route path="/discounts/*" element={<ProtectedRoute><DiscountsPage /></ProtectedRoute>} />
          <Route path="/transfers/*" element={<ProtectedRoute><TransfersPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/reports/sales" element={<ProtectedRoute><SalesReportPage /></ProtectedRoute>} />
          <Route path="/reports/purchases" element={<ProtectedRoute><PurchaseReportPage /></ProtectedRoute>} />
          <Route path="/reports/inventory" element={<ProtectedRoute><InventoryReportPage /></ProtectedRoute>} />
          <Route path="/reports/gst" element={<ProtectedRoute><GstReportPage /></ProtectedRoute>} />
          <Route path="/reports/payments" element={<ProtectedRoute><PaymentReportPage /></ProtectedRoute>} />
          <Route path="/reports/debtors" element={<ProtectedRoute><DebtorsReportPage /></ProtectedRoute>} />
          <Route path="/reports/creditors" element={<ProtectedRoute><CreditorsReportPage /></ProtectedRoute>} />
          <Route path="/settings/*" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/purchases/direct" element={<ProtectedRoute><DirectPurchasePage /></ProtectedRoute>} />
          <Route path="/purchases/*" element={<ProtectedRoute><PurchasesPage /></ProtectedRoute>} />
          <Route path="/incentives" element={<ProtectedRoute><IncentivesPage /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute><StaffPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/activity-logs" element={<ProtectedRoute><ActivityLogsPage /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
          <Route path="/expenses/categories" element={<ProtectedRoute><ExpenseCategoriesPage /></ProtectedRoute>} />
          <Route path="/price-lists" element={<ProtectedRoute><PriceListsPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
