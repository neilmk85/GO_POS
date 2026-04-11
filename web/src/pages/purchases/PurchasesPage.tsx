import { useLocation, Navigate } from 'react-router-dom'
import VendorsTab from './tabs/VendorsTab'
import PurchaseOrdersTab from './tabs/PurchaseOrdersTab'
import PurchaseReceivesTab from './tabs/PurchaseReceivesTab'
import BillsTab from './tabs/BillsTab'
import PaymentsMadeTab from './tabs/PaymentsMadeTab'
import VendorCreditsTab from './tabs/VendorCreditsTab'
import PurchaseReturnsPage from './PurchaseReturnsPage'

export default function PurchasesPage() {
  const { pathname } = useLocation()
  const segment = pathname.split('/purchases/')[1]?.split('/')[0] ?? 'vendors'

  // Purchase Returns is a full standalone page (no card wrapper)
  if (segment === 'returns') return <PurchaseReturnsPage />

  const renderContent = () => {
    switch (segment) {
      case 'vendors':          return <VendorsTab />
      case 'purchase-orders':  return <PurchaseOrdersTab />
      case 'receive':          return <PurchaseReceivesTab />
      case 'bills':            return <BillsTab />
      case 'payments':         return <PaymentsMadeTab />
      case 'vendor-credits':   return <VendorCreditsTab />
      default:                 return <VendorsTab />
    }
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl border p-6 min-h-[500px]">
        {renderContent()}
      </div>
    </div>
  )
}
