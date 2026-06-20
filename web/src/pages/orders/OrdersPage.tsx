import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, RotateCcw, Plus, ShoppingBag } from 'lucide-react'
import { orderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { Order } from '@/types'
import OrderDetailModal from './OrderDetailModal'

const statusColors: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PENDING:   'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
  HELD:      'bg-gray-100 text-gray-700',
  REFUNDED:  'bg-purple-100 text-purple-700',
}

export default function OrdersPage() {
  const { outletId } = useAuthStore()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Order | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['orders', outletId],
    queryFn: () => orderApi.getByOutlet(outletId!, { page: 0, size: 50 }).then(r => r.data.data),
    enabled: !!outletId,
  })

  const orders: Order[] = data?.content || []
  const filtered = orders.filter(o =>
    o.orderNumber.includes(search) ||
    o.customer?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const completedCount = orders.filter(o => o.status === 'COMPLETED').length
  const pendingCount   = orders.filter(o => o.status === 'PENDING').length
  const totalRevenue   = orders.filter(o => o.status === 'COMPLETED').reduce((s, o) => s + (o.totalAmount ?? 0), 0)

  return (
    <div className="p-6">

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] mb-6">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
        </div>

        {/* Top row */}
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <ShoppingBag size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Commerce</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Orders</h1>
            </div>
          </div>
          <button
            onClick={() => navigate('/orders/new')}
            className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors"
          >
            <Plus size={16} /> Create Order
          </button>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{orders.length}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Orders</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{completedCount}</p>
            <p className="text-violet-200 text-xs mt-0.5">Completed</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className={`text-xl font-bold ${pendingCount > 0 ? 'text-amber-300' : 'text-white'}`}>{pendingCount}</p>
            <p className="text-violet-200 text-xs mt-0.5">Pending</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">₹{totalRevenue.toLocaleString()}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Revenue</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order number or customer..."
          className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg w-full max-w-md focus:ring-2 focus:ring-violet-500 focus:outline-none text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Order #</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Items</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Total</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Payment</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No orders found</td></tr>
            ) : filtered.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-sm text-violet-600 font-semibold">{order.orderNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{order.customer?.name || 'Walk-in'}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-600">{order.items?.length || 0}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">₹{order.totalAmount}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {order.payments?.map(p => p.paymentMethod).join(', ')}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-700'}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setSelected(order)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                      <Eye size={15} />
                    </button>
                    {order.status === 'COMPLETED' && (
                      <button className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors">
                        <RotateCcw size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <OrderDetailModal order={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
