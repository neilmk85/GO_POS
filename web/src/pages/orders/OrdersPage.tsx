import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, RotateCcw, Plus } from 'lucide-react'
import { orderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { Order } from '@/types'
import OrderDetailModal from './OrderDetailModal'

const statusColors: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
  HELD: 'bg-gray-100 text-gray-700',
  REFUNDED: 'bg-purple-100 text-purple-700',
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <button
          onClick={() => navigate('/orders/new')}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Create Order
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order number or customer..."
          className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full max-w-sm focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Order #</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-center">Items</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Payment</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : filtered.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm text-primary-600">{order.orderNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{order.customer?.name || 'Walk-in'}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-600">{order.items?.length || 0}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">₹{order.totalAmount}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {order.payments?.map(p => p.paymentMethod).join(', ')}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-700'}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setSelected(order)} className="text-blue-500 hover:text-blue-700">
                      <Eye size={16} />
                    </button>
                    {order.status === 'COMPLETED' && (
                      <button className="text-orange-400 hover:text-orange-600">
                        <RotateCcw size={16} />
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
