import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { inventoryApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

interface Props {
  inventory: any
  onClose: () => void
  onSaved: () => void
}

const reasons = ['DAMAGE', 'THEFT', 'EXPIRY', 'CORRECTION', 'OPENING_STOCK', 'AUDIT', 'OTHER']

export default function AdjustStockModal({ inventory, onClose, onSaved }: Props) {
  const { user, outletId } = useAuthStore()
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('CORRECTION')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quantity) { toast.error('Quantity required'); return }
    setLoading(true)
    try {
      await inventoryApi.adjust({
        productId: inventory.product?.id || inventory.productId,
        outletId: outletId,
        quantity: parseFloat(quantity),
        reason,
        notes,
        userId: user?.id,
      })
      toast.success('Stock adjusted')
      onSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to adjust stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Adjust Stock</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Product: <strong>{inventory.product?.name}</strong><br/>
          Current Stock: <strong>{inventory.quantityOnHand ?? '-'}</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Quantity (+ to add, - to reduce)</label>
            <input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 50 or -5"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm">
              {reasons.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 py-2.5 rounded-lg font-medium text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />} Adjust Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
