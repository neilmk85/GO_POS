import { useLocation } from 'react-router-dom'
import { Building2, ShoppingBag, PackageCheck, Receipt, CreditCard, FileX } from 'lucide-react'
import VendorsTab from './tabs/VendorsTab'
import PurchaseOrdersTab from './tabs/PurchaseOrdersTab'
import PurchaseReceivesTab from './tabs/PurchaseReceivesTab'
import BillsTab from './tabs/BillsTab'
import PaymentsMadeTab from './tabs/PaymentsMadeTab'
import VendorCreditsTab from './tabs/VendorCreditsTab'
import PurchaseReturnsPage from './PurchaseReturnsPage'

const SEGMENT_META: Record<string, { icon: React.ElementType; title: string }> = {
  'vendors':         { icon: Building2,    title: 'Vendors' },
  'purchase-orders': { icon: ShoppingBag,  title: 'Purchase Orders' },
  'receive':         { icon: PackageCheck, title: 'Purchase Receives' },
  'bills':           { icon: Receipt,      title: 'Bills' },
  'payments':        { icon: CreditCard,   title: 'Payments Made' },
  'vendor-credits':  { icon: FileX,        title: 'Vendor Credits' },
}

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

  const meta = SEGMENT_META[segment] ?? { icon: ShoppingBag, title: 'Purchases' }
  const Icon = meta.icon

  return (
    <div className="p-6">
      {/* Hero Header */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] mb-6">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
        </div>
        {/* Top row */}
        <div className="relative flex items-center px-8 py-6">
          <div className="flex items-center gap-4">
            <Icon size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Purchases</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">{meta.title}</h1>
            </div>
          </div>
        </div>
      </div>
      {renderContent()}
    </div>
  )
}
