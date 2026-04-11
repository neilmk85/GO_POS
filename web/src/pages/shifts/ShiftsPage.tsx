import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Play, Square, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { shiftApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { Shift } from '@/types'

export default function ShiftsPage() {
  const { outletId, user } = useAuthStore()
  const [openingCash, setOpeningCash] = useState('0')
  const [closingCash, setClosingCash] = useState('0')
  const qc = useQueryClient()

  const { data: currentShift } = useQuery({
    queryKey: ['current-shift', user?.id],
    queryFn: () => shiftApi.getCurrent(user!.id).then(r => r.data.data).catch(() => null),
    enabled: !!user,
  })

  const { data: shiftHistory } = useQuery({
    queryKey: ['shifts', outletId],
    queryFn: () => shiftApi.getByOutlet(outletId!).then(r => r.data.data || []),
    enabled: !!outletId,
  })

  const handleOpenShift = async () => {
    try {
      await shiftApi.open({ outletId, cashierId: user!.id, openingCash: parseFloat(openingCash) })
      toast.success('Shift opened')
      qc.invalidateQueries({ queryKey: ['current-shift'] })
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to open shift')
    }
  }

  const handleCloseShift = async () => {
    if (!currentShift) return
    try {
      await shiftApi.close(currentShift.id, { closingCash: parseFloat(closingCash) })
      toast.success('Shift closed')
      qc.invalidateQueries({ queryKey: ['current-shift'] })
      qc.invalidateQueries({ queryKey: ['shifts'] })
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to close shift')
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Shift Management</h1>

      {/* Current Shift Status */}
      <div className={`rounded-xl p-6 mb-8 ${currentShift ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={24} className={currentShift ? 'text-green-600' : 'text-gray-400'} />
            <div>
              <p className="font-semibold text-gray-900">{currentShift ? 'Shift Active' : 'No Active Shift'}</p>
              {currentShift && (
                <p className="text-sm text-gray-600">
                  Started at {new Date(currentShift.openedAt).toLocaleTimeString()} · Opening Cash: ₹{currentShift.openingCash}
                </p>
              )}
            </div>
          </div>
          {currentShift ? (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">₹{currentShift.totalSales}</p>
                <p className="text-xs text-gray-500">{currentShift.totalOrders} orders</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={closingCash} onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="Closing cash"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                <button onClick={handleCloseShift} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  <Square size={14} /> Close Shift
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="Opening cash"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              <button onClick={handleOpenShift} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Play size={14} /> Open Shift
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shift History */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Shift History</h2>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Cashier</th>
              <th className="px-4 py-3 text-left">Opened</th>
              <th className="px-4 py-3 text-left">Closed</th>
              <th className="px-4 py-3 text-right">Opening Cash</th>
              <th className="px-4 py-3 text-right">Total Sales</th>
              <th className="px-4 py-3 text-right">Closing Cash</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(shiftHistory || []).map((s: Shift) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.cashier?.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(s.openedAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.closedAt ? new Date(s.closedAt).toLocaleString() : '-'}</td>
                <td className="px-4 py-3 text-sm text-right">₹{s.openingCash}</td>
                <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">₹{s.totalSales}</td>
                <td className="px-4 py-3 text-sm text-right">{s.closingCash ? `₹${s.closingCash}` : '-'}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {s.cashVariance != null && (
                    <span className={s.cashVariance >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {s.cashVariance >= 0 ? '+' : ''}₹{s.cashVariance?.toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
