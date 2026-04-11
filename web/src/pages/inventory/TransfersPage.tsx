import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ArrowRight, CheckCircle, Truck, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { inventoryApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { StockTransfer } from '@/types'

const statusColors: Record<string, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  IN_TRANSIT: 'bg-purple-100 text-purple-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-800',
}

export default function TransfersPage() {
  const { outletId, user } = useAuthStore()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', outletId],
    queryFn: () => inventoryApi.getTransfers(outletId!, { page: 0, size: 50 }).then(r => r.data.data),
    enabled: !!outletId,
  })

  const transfers: StockTransfer[] = data?.content || []

  const handleAction = async (id: number, action: string) => {
    try {
      if (action === 'approve') await inventoryApi.approveTransfer(id, user!.id)
      else if (action === 'ship') await inventoryApi.shipTransfer(id)
      toast.success(`Transfer ${action}d successfully`)
      qc.invalidateQueries({ queryKey: ['transfers'] })
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Transfers</h1>
        <button className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm">
          <Plus size={18} /> New Transfer
        </button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : transfers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ArrowRight size={48} className="mx-auto mb-4 opacity-30" />
            <p>No stock transfers found</p>
          </div>
        ) : transfers.map((transfer) => (
          <div key={transfer.id} className="bg-white rounded-xl border shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-semibold text-gray-900">{transfer.transferNumber}</p>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  <span className="font-medium">{transfer.fromOutlet.name}</span>
                  <ArrowRight size={14} />
                  <span className="font-medium">{transfer.toOutlet.name}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{new Date(transfer.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[transfer.status] || ''}`}>
                  {transfer.status.replace(/_/g, ' ')}
                </span>
                {transfer.status === 'REQUESTED' && (
                  <button onClick={() => handleAction(transfer.id, 'approve')}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg">
                    <CheckCircle size={12} /> Approve
                  </button>
                )}
                {transfer.status === 'APPROVED' && (
                  <button onClick={() => handleAction(transfer.id, 'ship')}
                    className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded-lg">
                    <Truck size={12} /> Ship
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {transfer.items?.map((item) => (
                <div key={item.id} className="flex items-center gap-4 text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <Package size={14} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-gray-700">{item.product.name}</span>
                  <span className="text-gray-500">Requested: {item.requestedQuantity}</span>
                  {item.receivedQuantity > 0 && (
                    <span className="text-green-600">Received: {item.receivedQuantity}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
