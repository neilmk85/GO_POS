import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Edit2, Key, ToggleLeft, ToggleRight, X, Loader2,
  User, Mail, Phone, Building2, Eye, EyeOff, Check, AlertCircle,
  UserCheck, UserX, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { staffApi, rolesApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ─── Permissions ───────────────────────────────────────────────────────────────

export const PERMISSION_GROUPS = [
  {
    group: 'Point of Sale',
    icon: '🛒',
    items: [
      { key: 'POS_ACCESS',        label: 'POS Access',         desc: 'Open and use the POS screen' },
      { key: 'PROCESS_SALES',     label: 'Process Sales',      desc: 'Complete sales transactions' },
      { key: 'PROCESS_RETURNS',   label: 'Process Returns',    desc: 'Accept returns and issue refunds' },
      { key: 'APPLY_DISCOUNTS',   label: 'Apply Discounts',    desc: 'Apply item and bill discounts' },
      { key: 'OPEN_PRICE',        label: 'Open Price Edit',    desc: 'Modify item price at time of sale' },
    ],
  },
  {
    group: 'Products & Inventory',
    icon: '📦',
    items: [
      { key: 'VIEW_PRODUCTS',     label: 'View Products',      desc: 'Browse the product catalogue' },
      { key: 'MANAGE_PRODUCTS',   label: 'Manage Products',    desc: 'Add, edit and delete products' },
      { key: 'VIEW_INVENTORY',    label: 'View Inventory',     desc: 'View stock levels' },
      { key: 'MANAGE_INVENTORY',  label: 'Manage Inventory',   desc: 'Adjust stock and transfers' },
    ],
  },
  {
    group: 'Customers',
    icon: '👥',
    items: [
      { key: 'VIEW_CUSTOMERS',    label: 'View Customers',     desc: 'View customer list and profiles' },
      { key: 'MANAGE_CUSTOMERS',  label: 'Manage Customers',   desc: 'Add and edit customer records' },
    ],
  },
  {
    group: 'Sales & Orders',
    icon: '🧾',
    items: [
      { key: 'VIEW_ORDERS',       label: 'View Orders',        desc: 'View order history' },
      { key: 'MANAGE_ORDERS',     label: 'Manage Orders',      desc: 'Create and modify orders' },
      { key: 'VIEW_PAYMENTS',     label: 'View Payments',      desc: 'View payment records' },
    ],
  },
  {
    group: 'Purchases',
    icon: '🏪',
    items: [
      { key: 'VIEW_PURCHASES',    label: 'View Purchases',     desc: 'View purchase orders and bills' },
      { key: 'MANAGE_PURCHASES',  label: 'Manage Purchases',   desc: 'Create and manage purchase orders' },
    ],
  },
  {
    group: 'Reports & Finance',
    icon: '📊',
    items: [
      { key: 'VIEW_REPORTS',      label: 'View Reports',       desc: 'Access sales and financial reports' },
      { key: 'VIEW_SHIFTS',       label: 'View Shifts',        desc: 'View shift summaries' },
      { key: 'MANAGE_SHIFTS',     label: 'Manage Shifts',      desc: 'Open and close shifts' },
    ],
  },
  {
    group: 'Administration',
    icon: '⚙️',
    items: [
      { key: 'MANAGE_DISCOUNTS',  label: 'Manage Discounts',   desc: 'Create discount rules and coupons' },
      { key: 'MANAGE_STAFF',      label: 'Manage Staff',       desc: 'Add and manage staff accounts' },
      { key: 'MANAGE_INCENTIVES', label: 'Manage Incentives',  desc: 'Configure staff incentive rules' },
      { key: 'MANAGE_SETTINGS',   label: 'System Settings',    desc: 'Access and change system settings' },
    ],
  },
]

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key))

// ─── Built-in roles (display only, not editable) ───────────────────────────────

export const BUILT_IN_ROLES: {
  value: string; label: string; color: string; permissions: string[]
}[] = [
  {
    value: 'CASHIER',
    label: 'Cashier',
    color: 'bg-green-100 text-green-700',
    permissions: ['POS_ACCESS', 'PROCESS_SALES', 'PROCESS_RETURNS', 'VIEW_CUSTOMERS', 'VIEW_PRODUCTS', 'MANAGE_SHIFTS', 'VIEW_SHIFTS'],
  },
  {
    value: 'MANAGER',
    label: 'Manager',
    color: 'bg-blue-100 text-blue-700',
    permissions: ['POS_ACCESS', 'PROCESS_SALES', 'PROCESS_RETURNS', 'APPLY_DISCOUNTS', 'OPEN_PRICE',
      'VIEW_CUSTOMERS', 'MANAGE_CUSTOMERS', 'VIEW_PRODUCTS', 'MANAGE_PRODUCTS',
      'VIEW_INVENTORY', 'MANAGE_INVENTORY', 'VIEW_ORDERS', 'MANAGE_ORDERS',
      'VIEW_PAYMENTS', 'VIEW_REPORTS', 'MANAGE_SHIFTS', 'VIEW_SHIFTS', 'MANAGE_DISCOUNTS', 'MANAGE_STAFF'],
  },
  {
    value: 'ACCOUNTANT',
    label: 'Accountant',
    color: 'bg-purple-100 text-purple-700',
    permissions: ['VIEW_REPORTS', 'VIEW_PAYMENTS', 'VIEW_ORDERS', 'VIEW_PURCHASES', 'VIEW_SHIFTS'],
  },
  {
    value: 'ADMIN',
    label: 'Admin',
    color: 'bg-red-100 text-red-700',
    permissions: ALL_PERMISSIONS.filter(p => p !== 'MANAGE_SETTINGS'),
  },
  {
    value: 'SUPER_ADMIN',
    label: 'Super Admin',
    color: 'bg-orange-100 text-orange-700',
    permissions: ALL_PERMISSIONS,
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getRoleColor(value: string, customRoles: any[]): string {
  const builtin = BUILT_IN_ROLES.find(r => r.value === value)
  if (builtin) return builtin.color
  const custom = customRoles.find(r => r.name === value)
  return custom?.color ?? 'bg-gray-100 text-gray-600'
}

function getRoleLabel(value: string, customRoles: any[]): string {
  const builtin = BUILT_IN_ROLES.find(r => r.value === value)
  if (builtin) return builtin.label
  const custom = customRoles.find(r => r.name === value)
  return custom?.displayName ?? value
}

function RoleBadge({ role, customRoles }: { role: string; customRoles: any[] }) {
  const color = getRoleColor(role, customRoles)
  const label = getRoleLabel(role, customRoles)
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
  )
}

// ─── Staff Form Modal ──────────────────────────────────────────────────────────

interface StaffMember {
  id: number
  name: string
  email: string
  phone?: string
  roles: string[]
  outletId?: number
  outletName?: string
  active: boolean
}

function StaffModal({
  staff, onClose, onDone
}: {
  staff: StaffMember | null
  onClose: () => void
  onDone: () => void
}) {
  const isEdit = !!staff
  const { outletId } = useAuthStore()

  const [name, setName] = useState(staff?.name ?? '')
  const [email, setEmail] = useState(staff?.email ?? '')
  const [phone, setPhone] = useState(staff?.phone ?? '')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(staff?.roles?.length ? staff.roles : ['CASHIER'])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: customRoles = [] } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => rolesApi.getAll().then(r => r.data.data ?? []),
    staleTime: 60_000,
  })

  // All available roles: built-in (excluding SUPER_ADMIN) + custom
  const allRoles = [
    ...BUILT_IN_ROLES.filter(r => r.value !== 'SUPER_ADMIN').map(r => ({
      value: r.value, label: r.label, color: r.color, isBuiltIn: true,
    })),
    ...(customRoles as any[]).map(r => ({
      value: r.name, label: r.displayName, color: r.color ?? 'bg-gray-100 text-gray-600', isBuiltIn: false,
    })),
  ]

  function toggleRole(value: string) {
    setSelectedRoles(prev =>
      prev.includes(value)
        ? prev.length > 1 ? prev.filter(r => r !== value) : prev
        : [...prev, value]
    )
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (!email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email address'
    if (!isEdit) {
      if (!password) e.password = 'Password is required'
      else if (password.length < 6) e.password = 'Password must be at least 6 characters'
      if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setLoading(true)
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        roles: selectedRoles,
        outletId: outletId ?? undefined,
      }
      if (!isEdit) payload.password = password
      if (isEdit) {
        await staffApi.update(staff!.id, payload)
        toast.success('Staff member updated')
      } else {
        await staffApi.create(payload)
        toast.success('Staff member created')
      }
      onDone()
    } catch (err: any) {
      const fieldErrors = err.response?.data?.errors ?? {}
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
      } else {
        toast.error(err.response?.data?.message ?? 'Failed to save')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{isEdit ? `Editing ${staff.name}` : 'Create a new staff account'}</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="overflow-auto flex-1 px-6 py-5 space-y-4">
          {/* Avatar preview */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-2xl font-bold">
              {name ? name.charAt(0).toUpperCase() : <User size={28} />}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul Sharma"
                className={`w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.name ? 'border-red-400' : 'border-gray-300'}`} />
            </div>
            {errors.name && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="rahul@example.com"
                className={`w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.email ? 'border-red-400' : 'border-gray-300'}`} />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
          </div>

          {/* Roles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Roles <span className="text-red-500">*</span></label>
              <span className="text-xs text-gray-400">Select one or more</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {allRoles.map(r => {
                const active = selectedRoles.includes(r.value)
                return (
                  <button key={r.value} onClick={() => toggleRole(r.value)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      active ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      active ? 'bg-gradient-to-r from-violet-600 to-blue-600 border-primary-600' : 'border-gray-300'
                    }`}>
                      {active && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.color}`}>{r.label}</span>
                    {!r.isBuiltIn && (
                      <span className="ml-auto text-xs text-primary-400 font-medium">custom</span>
                    )}
                  </button>
                )
              })}
            </div>
            {selectedRoles.length > 0 && (
              <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Selected roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRoles.map(rv => {
                    const found = allRoles.find(r => r.value === rv)
                    return (
                      <span key={rv} className={`text-xs px-2 py-0.5 rounded-full font-medium ${found?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {found?.label ?? rv}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Password */}
          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters"
                    className={`w-full border rounded-lg pl-9 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.password ? 'border-red-400' : 'border-gray-300'}`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
                    className={`w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.confirmPassword ? 'border-red-400' : 'border-gray-300'}`} />
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.confirmPassword}</p>}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Staff'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reset Password Modal ──────────────────────────────────────────────────────

function ResetPasswordModal({ staff, onClose, onDone }: { staff: StaffMember; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReset() {
    if (!password) { setError('Password is required'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setError(''); setLoading(true)
    try {
      await staffApi.resetPassword(staff.id, password)
      toast.success(`Password reset for ${staff.name}`)
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><Key size={18} className="text-primary-600" /> Reset Password</h3>
            <p className="text-xs text-gray-500 mt-0.5">For {staff.name}</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={handleReset} disabled={loading}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />} Reset Password
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Staff Card ────────────────────────────────────────────────────────────────

function StaffCard({ s, customRoles, onEdit, onResetPwd, onToggleActive }: {
  s: StaffMember; customRoles: any[]
  onEdit: () => void; onResetPwd: () => void; onToggleActive: () => void
}) {
  return (
    <div className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${s.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${s.active ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
        {s.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900">{s.name}</span>
          {s.roles.map(r => <RoleBadge key={r} role={r} customRoles={customRoles} />)}
          {!s.active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11} /> {s.email}</span>
          {s.phone && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone size={11} /> {s.phone}</span>}
          {s.outletName && <span className="flex items-center gap-1 text-xs text-gray-500"><Building2 size={11} /> {s.outletName}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} title="Edit" className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 transition-colors"><Edit2 size={15} /></button>
        <button onClick={onResetPwd} title="Reset password" className="p-2 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-gray-50 transition-colors"><Key size={15} /></button>
        <button onClick={onToggleActive} title={s.active ? 'Deactivate' : 'Activate'}
          className={`p-2 rounded-lg hover:bg-gray-50 transition-colors ${s.active ? 'text-green-500 hover:text-red-500' : 'text-gray-400 hover:text-green-500'}`}>
          {s.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
        </button>
      </div>
    </div>
  )
}

// ─── Staff Tab ─────────────────────────────────────────────────────────────────

function StaffTab() {
  const qc = useQueryClient()
  const { outletId } = useAuthStore()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null)
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null)

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['staff-all', outletId],
    queryFn: () => (outletId ? staffApi.getByOutlet(outletId) : staffApi.getAll()).then(r => r.data.data ?? []),
  })

  const { data: customRoles = [] } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => rolesApi.getAll().then(r => r.data.data ?? []),
    staleTime: 60_000,
  })

  async function toggleActive(s: StaffMember) {
    try {
      await staffApi.toggleActive(s.id)
      toast.success(s.active ? `${s.name} deactivated` : `${s.name} activated`)
      qc.invalidateQueries({ queryKey: ['staff-all'] })
      qc.invalidateQueries({ queryKey: ['staff-list'] })
    } catch { toast.error('Failed to update status') }
  }

  // All role options for filter chips
  const allRoleOptions = [
    ...BUILT_IN_ROLES.map(r => ({ value: r.value, label: r.label })),
    ...(customRoles as any[]).map(r => ({ value: r.name, label: r.displayName })),
  ]

  const filtered = (staffList as StaffMember[]).filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search)
    const matchRole = roleFilter === 'ALL' || s.roles.includes(roleFilter)
    const matchStatus = statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && s.active) ||
      (statusFilter === 'INACTIVE' && !s.active)
    return matchSearch && matchRole && matchStatus
  })

  const activeCount = (staffList as StaffMember[]).filter(s => s.active).length

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600"><User size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{(staffList as StaffMember[]).length}</p><p className="text-xs text-gray-500">Total Staff</p></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600"><UserCheck size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{activeCount}</p><p className="text-xs text-gray-500">Active</p></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500"><UserX size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{(staffList as StaffMember[]).length - activeCount}</p><p className="text-xs text-gray-500">Inactive</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none w-64" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setRoleFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${roleFilter === 'ALL' ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            All Roles
          </button>
          {allRoleOptions.map(r => (
            <button key={r.value} onClick={() => setRoleFilter(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${roleFilter === r.value ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-auto">
          {[{ key: 'ALL', label: 'All' }, { key: 'ACTIVE', label: 'Active' }, { key: 'INACTIVE', label: 'Inactive' }].map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s.key ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end mb-3">
        <button onClick={() => { setEditTarget(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg">
          <Plus size={15} /> Add Staff Member
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 size={24} className="animate-spin mr-2" /> Loading staff…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
          <User size={48} className="mb-3" />
          <p className="text-sm text-gray-400">{search || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No staff match your filters' : 'No staff members yet'}</p>
          {!search && roleFilter === 'ALL' && statusFilter === 'ALL' && (
            <button onClick={() => { setEditTarget(null); setShowModal(true) }}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg">
              <Plus size={15} /> Add First Staff Member
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <StaffCard key={s.id} s={s} customRoles={customRoles as any[]}
              onEdit={() => { setEditTarget(s); setShowModal(true) }}
              onResetPwd={() => setResetTarget(s)}
              onToggleActive={() => toggleActive(s)} />
          ))}
        </div>
      )}

      {showModal && (
        <StaffModal staff={editTarget} onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); qc.invalidateQueries({ queryKey: ['staff-all'] }); qc.invalidateQueries({ queryKey: ['staff-list'] }) }} />
      )}
      {resetTarget && (
        <ResetPasswordModal staff={resetTarget} onClose={() => setResetTarget(null)} onDone={() => setResetTarget(null)} />
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function StaffPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User size={24} className="text-primary-600" /> Staff Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage staff accounts and assign roles</p>
        </div>
      </div>
      <StaffTab />
    </div>
  )
}
