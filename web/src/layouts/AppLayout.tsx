import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Package, Users, BarChart3, Settings, LogOut,
  Tag, ArrowLeftRight, TrendingUp, ChevronLeft, ChevronRight,
  Store, FileText, Boxes, ShoppingBag,
  Building2, PackageCheck, Receipt, CreditCard, FileX,
  Wallet, RotateCcw, Truck, Trophy, UserCog, LineChart, ArrowRight, Activity,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import { outletApi } from '@/services/api'
import toast from 'react-hot-toast'

interface NavItem {
  path: string
  icon: React.ReactNode
  label: string
  roles?: string[]
}

interface NavGroup {
  key: string
  icon: React.ReactNode
  label: string
  roles?: string[]
  children: NavItem[]
}

type NavEntry = NavItem | NavGroup

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry
}

function isPathActive(current: string, path: string): boolean {
  return current === path || current.startsWith(path + '/')
}

const navEntries: NavEntry[] = [
  { path: '/pos', icon: <ShoppingCart size={18} />, label: 'POS' },
  {
    key: 'inventory',
    icon: <Boxes size={18} />,
    label: 'Inventory',
    children: [
      { path: '/products',             icon: <Package size={14} />,      label: 'Products' },
      { path: '/inventory',            icon: <Boxes size={14} />,        label: 'Stock' },
      { path: '/inventory/categories', icon: <Tag size={14} />,          label: 'Categories' },
      { path: '/inventory/uom',          icon: <ArrowRight size={14} />,   label: 'UoM Conversion' },
      { path: '/inventory/bulk-purchase', icon: <ShoppingBag size={14} />,  label: 'Bulk Purchase' },
    ],
  },
  {
    key: 'sales',
    icon: <Store size={18} />,
    label: 'Sales',
    children: [
      { path: '/sales-orders',              icon: <ShoppingBag size={14} />, label: 'Sales Orders' },
      { path: '/orders',                    icon: <FileText size={14} />,   label: 'Orders' },
      { path: '/customers',                 icon: <Users size={14} />,      label: 'Customers' },
      { path: '/sales/invoices',             icon: <Receipt size={14} />,    label: 'Invoices' },
      { path: '/sales/quotations',           icon: <FileText size={14} />,   label: 'Quotations' },
      { path: '/sales/payments-received',   icon: <Wallet size={14} />,     label: 'Payments Received' },
      { path: '/sales/returns',             icon: <RotateCcw size={14} />,  label: 'Returns' },
      { path: '/sales/credit-notes',        icon: <FileX size={14} />,      label: 'Credit Notes' },
      { path: '/sales/delivery-challans',   icon: <Truck size={14} />,      label: 'Delivery Challans' },
    ],
  },
  {
    key: 'purchases',
    icon: <ShoppingBag size={18} />,
    label: 'Purchases',
    children: [
      { path: '/purchases/vendors',         icon: <Building2 size={14} />,    label: 'Vendors' },
      { path: '/purchases/direct',          icon: <PackageCheck size={14} />, label: 'Direct Purchase' },
      { path: '/purchases/purchase-orders', icon: <ShoppingBag size={14} />,  label: 'Purchase Orders' },
      { path: '/purchases/receive',         icon: <PackageCheck size={14} />, label: 'Purchase Received' },
      { path: '/purchases/bills',           icon: <Receipt size={14} />,      label: 'Bills' },
      { path: '/purchases/payments',        icon: <CreditCard size={14} />,   label: 'Payments Made' },
      { path: '/purchases/vendor-credits',  icon: <FileX size={14} />,        label: 'Vendor Credits' },
      { path: '/purchases/returns',         icon: <RotateCcw size={14} />,    label: 'Purchase Returns' },
    ],
  },
  { path: '/discounts',   icon: <Tag size={18} />,           label: 'Discounts' },
  { path: '/price-lists', icon: <Tag size={18} />,           label: 'Price Lists', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
  { path: '/transfers',   icon: <ArrowLeftRight size={18} />, label: 'Stock Transfer' },
  {
    key: 'hr',
    icon: <UserCog size={18} />,
    label: 'HR',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    children: [
      { path: '/staff',      icon: <Users size={14} />,  label: 'Staff',      roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
      { path: '/incentives', icon: <Trophy size={14} />, label: 'Incentives', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
    ],
  },
  {
    key: 'reports',
    icon: <TrendingUp size={18} />,
    label: 'Reports',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
    children: [
      { path: '/reports',           icon: <BarChart3 size={14} />,   label: 'Overview' },
      { path: '/reports/sales',     icon: <LineChart size={14} />,   label: 'Sales' },
      { path: '/reports/purchases', icon: <ShoppingBag size={14} />, label: 'Purchases' },
      { path: '/reports/inventory', icon: <Boxes size={14} />,       label: 'Inventory' },
      { path: '/reports/gst',       icon: <FileText size={14} />,    label: 'GST Reports' },
      { path: '/reports/payments',  icon: <CreditCard size={14} />,  label: 'Payments' },
      { path: '/reports/debtors',   icon: <Users size={14} />,       label: 'Debtors' },
      { path: '/reports/creditors', icon: <Building2 size={14} />,   label: 'Creditors' },
    ],
  },
  {
    key: 'expenses',
    icon: <Receipt size={18} />,
    label: 'Expenses',
    children: [
      { path: '/expenses',            icon: <Wallet size={14} />,  label: 'All Expenses' },
      { path: '/expenses/categories', icon: <Tag size={14} />,     label: 'Categories' },
    ],
  },
  { path: '/activity-logs', icon: <Activity size={18} />, label: 'Activity Logs', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
  { path: '/settings', icon: <Settings size={18} />, label: 'Settings', roles: ['ADMIN', 'SUPER_ADMIN'] },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    inventory: false, purchases: false, sales: false, hr: false, reports: false, expenses: false,
  })
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, hasRole, outletId } = useAuthStore()

  const { data: outletData } = useQuery({
    queryKey: ['outlet-name', outletId],
    queryFn: async () => {
      const res = await outletApi.getById(outletId!)
      return res.data.data
    },
    enabled: !!outletId,
    staleTime: 5 * 60 * 1000,
  })

  const businessName = outletData?.name || user?.outletName || 'RetailPOS'

  useEffect(() => {
    setOpenGroups(prev => {
      const next = { ...prev }
      navEntries.forEach(entry => {
        if (isGroup(entry)) {
          const active = entry.children.some(
            c => location.pathname === c.path || location.pathname.startsWith(c.path + '/')
          )
          if (active) next[entry.key] = true
        }
      })
      return next
    })
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
    toast.success('Logged out')
  }

  const toggleGroup = (key: string) => setOpenGroups(g => ({ ...g, [key]: !g[key] }))
  const isVisible = (roles?: string[]) => !roles || roles.some(r => hasRole(r))

  const renderItem = (item: NavItem, indent = false) => {
    const active = indent
      ? location.pathname === item.path
      : isPathActive(location.pathname, item.path)

    return (
      <Link
        key={item.path}
        to={item.path}
        title={collapsed ? item.label : undefined}
        className={`relative flex items-center gap-3 rounded-lg mb-0.5 transition-all duration-150 ${
          indent ? 'px-2.5 py-1.5' : 'px-3 py-2.5 mx-2'
        } ${
          active
            ? 'bg-gradient-to-r from-violet-600 to-blue-600/20 text-white'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
        }`}
      >
        {active && !indent && (
          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary-400" />
        )}
        <span className={`shrink-0 ${active ? 'text-primary-400' : ''}`}>
          {item.icon}
        </span>
        {!collapsed && (
          <span className={`truncate font-medium ${indent ? 'text-[11.5px]' : 'text-[13px]'}`}>
            {item.label}
          </span>
        )}
      </Link>
    )
  }

  const renderGroup = (group: NavGroup) => {
    if (!isVisible(group.roles)) return null
    const isActive = group.children.some(c => isPathActive(location.pathname, c.path))
    const isOpen = openGroups[group.key]

    return (
      <div key={group.key} className="mx-2 mb-0.5">
        <button
          onClick={() => !collapsed && toggleGroup(group.key)}
          title={collapsed ? group.label : undefined}
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150 ${
            isActive
              ? 'bg-white/5 text-white'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
          }`}
        >
          <span className={`shrink-0 ${isActive ? 'text-primary-400' : ''}`}>
            {group.icon}
          </span>
          {!collapsed && (
            <>
              <span className="text-[13px] font-medium flex-1 text-left">{group.label}</span>
              <ChevronRight
                size={13}
                className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
              />
            </>
          )}
        </button>

        {!collapsed && isOpen && (
          <div className="mt-1 ml-[17px] pl-3 border-l border-white/[0.08] mb-1">
            {group.children.map(child => {
              if (!isVisible(child.roles)) return null
              return renderItem(child, true)
            })}
          </div>
        )}
      </div>
    )
  }

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-[64px]' : 'w-[220px]'
        } bg-[#0d1117] flex flex-col transition-all duration-300 ease-in-out shrink-0 border-r border-white/[0.06]`}
      >
        {/* Logo */}
        <div className={`flex items-center px-3 pt-4 pb-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 pl-1 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0 shadow-lg">
                <ShoppingCart size={13} className="text-white" />
              </div>
              <span className="font-bold text-white text-sm tracking-wide truncate" title={businessName}>{businessName}</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-colors"
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-1 overflow-y-auto">
          {navEntries.map(entry => {
            if (isGroup(entry)) return renderGroup(entry)
            if (!isVisible(entry.roles)) return null
            return renderItem(entry)
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-2.5 border-t border-white/[0.06]">
          {!collapsed && user && (
            <Link to="/profile" className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 mb-1 transition-colors group">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate leading-tight group-hover:text-primary-300 transition-colors">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">{user.outletName}</p>
              </div>
            </Link>
          )}
          {collapsed && user && (
            <div className="flex justify-center mb-1">
              <Link to="/profile" title={user.name} className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-[10px] font-bold hover:opacity-80 transition-opacity">
                {initials}
              </Link>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg px-2 py-1.5 w-full hover:bg-red-500/10 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut size={14} className="shrink-0" />
            {!collapsed && <span className="text-xs font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
