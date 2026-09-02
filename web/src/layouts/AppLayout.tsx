import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Package, Users, Settings, LogOut,
  ChevronLeft, ChevronRight,
  Building2,
  MapPinOff, MapPin,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useMutation, useQuery } from '@tanstack/react-query'
import { outletApi, profileApi } from '@/services/api'
import toast from 'react-hot-toast'

interface NavItem {
  path: string
  icon: React.ReactNode
  label: string
  roles?: string[]
  highlight?: boolean
  disabled?: boolean
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
  { path: '/products',          icon: <Package size={18} />,  label: 'Products' },
  { path: '/customers',         icon: <Users size={18} />,    label: 'Customers' },
  { path: '/purchases/vendors', icon: <Building2 size={18} />, label: 'Vendors' },
  { path: '/settings',          icon: <Settings size={18} />, label: 'Settings', roles: ['ADMIN', 'SUPER_ADMIN'] },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true)
  const [hovered, setHovered] = useState(false)
  const isExpanded = !collapsed || hovered
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, hasRole, hasPermission, outletId, setOutOfOffice } = useAuthStore()

  const { data: outletData } = useQuery({
    queryKey: ['outlet-name', outletId],
    queryFn: async () => {
      const res = await outletApi.getById(outletId!)
      return res.data.data
    },
    enabled: !!outletId,
    staleTime: 5 * 60 * 1000,
  })

  const businessName = outletData?.name || user?.outletName || 'P&P Pipe Products'

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

  const outOfOfficeMutation = useMutation({
    mutationFn: (value: boolean) => profileApi.toggleOutOfOffice(value),
    onSuccess: (_, value) => {
      setOutOfOffice(value)
      toast.success(value ? 'Marked as out of office' : 'Marked as in office')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const toggleGroup = (key: string) => setOpenGroups(g => ({ ...g, [key]: !g[key] }))
  const isVisible = (roles?: string[]) => !roles || roles.some(r => hasRole(r))

  const renderItem = (item: NavItem, indent = false) => {
    if (item.disabled) {
      return (
        <div
          key={item.path}
          title={!isExpanded ? item.label : undefined}
          className={`relative flex items-center gap-3 rounded-lg mb-0.5 px-3 py-2.5 mx-2 cursor-not-allowed opacity-40`}
        >
          <span className="shrink-0 text-gray-400">{item.icon}</span>
          {isExpanded && (
            <span className="truncate text-[13px] font-bold text-gray-400">{item.label}</span>
          )}
        </div>
      )
    }

    const active = indent
      ? location.pathname === item.path
      : isPathActive(location.pathname, item.path)

    if (item.highlight) {
      return (
        <Link
          key={item.path}
          to={item.path}
          title={!isExpanded ? item.label : undefined}
          className={`group relative flex items-center gap-3 rounded-lg mb-0.5 px-3 py-2.5 mx-2 transition-all duration-150 ${
            active
              ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm shadow-violet-200'
              : 'text-gray-900 hover:bg-violet-50 hover:text-violet-700'
          }`}
        >
          {active && (
            <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-white/60" />
          )}
          <span className={`shrink-0 transition-colors ${active ? 'text-white' : 'text-gray-700 group-hover:text-violet-500'}`}>
            {item.icon}
          </span>
          {isExpanded && (
            <span className="truncate text-[13px] font-bold">{item.label}</span>
          )}
        </Link>
      )
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        title={!isExpanded ? item.label : undefined}
        className={`group relative flex items-center gap-3 rounded-lg mb-0.5 transition-all duration-150 ${
          indent ? 'px-2.5 py-1.5' : 'px-3 py-2.5 mx-2'
        } ${
          active
            ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm shadow-violet-200'
            : indent
              ? 'text-gray-500 hover:bg-violet-50 hover:text-violet-700'
              : 'text-gray-500 hover:bg-violet-50 hover:text-violet-700'
        }`}
      >
        {active && (
          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-white/60" />
        )}
        <span className={`shrink-0 transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-violet-500'}`}>
          {item.icon}
        </span>
        {isExpanded && (
          <span className={`truncate ${indent ? 'text-[11.5px]' : 'text-[13px] font-medium'}`}>
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
          onClick={() => isExpanded && toggleGroup(group.key)}
          title={!isExpanded ? group.label : undefined}
          className={`group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150 ${
            isActive
              ? 'text-violet-700'
              : 'text-gray-500 hover:bg-violet-50 hover:text-violet-700'
          }`}
        >
          <span className={`shrink-0 transition-colors ${isActive ? 'text-violet-500' : 'text-gray-400 group-hover:text-violet-500'}`}>
            {group.icon}
          </span>
          {isExpanded && (
            <>
              <span className={`text-[13px] flex-1 text-left ${isActive ? 'font-semibold' : 'font-medium'}`}>{group.label}</span>
              <ChevronRight
                size={13}
                className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''} ${isActive ? 'text-violet-400' : 'text-gray-300 group-hover:text-violet-400'}`}
              />
            </>
          )}
        </button>

        {isExpanded && isOpen && (
          <div className="mt-0.5 ml-[17px] pl-3 border-l-2 border-violet-100 mb-1">
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar — fixed overlay, never pushes content */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed left-0 top-0 h-full z-50 ${
          isExpanded ? 'w-[220px]' : 'w-[64px]'
        } bg-white flex flex-col transition-all duration-200 ease-in-out border-r border-violet-100 shadow-[6px_0_30px_-4px_rgba(109,40,217,0.15),2px_0_10px_-2px_rgba(148,163,184,0.12)]`}
      >
        {/* Logo */}
        <div className={`flex items-center px-3 pt-4 pb-3 border-b border-gray-100 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
          {isExpanded && (
            <div className="flex items-center gap-2.5 pl-1 min-w-0">
              <img src="/pp-logo.png" alt="P&P" className="h-8 w-auto object-contain shrink-0" />
              <span className="font-bold text-gray-800 text-sm tracking-wide truncate" title={businessName}>{businessName}</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Pin open' : 'Collapse'}
            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
          >
            {isExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navEntries.map(entry => {
            if (isGroup(entry)) return renderGroup(entry)
            if (!isVisible(entry.roles)) return null
            return renderItem(entry)
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-2.5 border-t border-gray-100">
          {isExpanded && user && (
            <Link to="/profile" className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-violet-50 mb-1 transition-colors group">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 truncate leading-tight group-hover:text-violet-700 transition-colors">{user.name}</p>
                <p className="text-[10px] text-gray-400 truncate leading-tight mt-0.5">{user.outletName}</p>
              </div>
            </Link>
          )}
          {!isExpanded && user && (
            <div className="flex justify-center mb-1">
              <Link to="/profile" title={user.name} className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold hover:opacity-80 transition-opacity shadow-sm">
                {initials}
              </Link>
            </div>
          )}
          {/* Out-of-office toggle — only for users with SET_OUT_OF_OFFICE permission */}
          {hasPermission('SET_OUT_OF_OFFICE') && (() => {
            const isOut = user?.outOfOffice ?? false
            return (
              <button
                onClick={() => !outOfOfficeMutation.isPending && outOfOfficeMutation.mutate(!isOut)}
                title={isExpanded ? undefined : isOut ? 'Out of Office — click to toggle' : 'In Office — click to toggle'}
                className={`flex items-center gap-2.5 transition-colors rounded-lg px-2 py-1.5 w-full mb-0.5 ${
                  isOut
                    ? 'text-orange-500 bg-orange-50 hover:bg-orange-100'
                    : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                } ${!isExpanded ? 'justify-center' : ''} ${outOfOfficeMutation.isPending ? 'opacity-50 cursor-wait' : ''}`}
              >
                {isOut ? <MapPinOff size={14} className="shrink-0" /> : <MapPin size={14} className="shrink-0" />}
                {isExpanded && (
                  <span className="text-xs font-medium flex-1 text-left">
                    {isOut ? 'Out of Office' : 'In Office'}
                  </span>
                )}
                {isExpanded && (
                  <span className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${isOut ? 'bg-orange-400' : 'bg-gray-200'}`}>
                    <span className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${isOut ? 'translate-x-3' : 'translate-x-0'}`} />
                  </span>
                )}
              </button>
            )
          })()}

          <button
            onClick={handleLogout}
            className={`flex items-center gap-2.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg px-2 py-1.5 w-full hover:bg-red-50 ${
              !isExpanded ? 'justify-center' : ''
            }`}
          >
            <LogOut size={14} className="shrink-0" />
            {isExpanded && <span className="text-xs font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto ml-[64px]">
        {children}
      </main>
    </div>
  )
}
