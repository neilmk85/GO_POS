import { X, Printer, Mail, MessageSquare } from 'lucide-react'
import { Order } from '@/types'

interface Props { order: Order; onClose: () => void }

export default function OrderDetailModal({ order, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold">Order #{order.orderNumber}</h2>
            <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><Printer size={16} /></button>
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><Mail size={16} /></button>
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><MessageSquare size={16} /></button>
            <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {order.customer && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-900">{order.customer.name}</p>
              <p className="text-sm text-gray-500">{order.customer.phone}</p>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left py-2">Item</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Price</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items?.map(item => (
                <tr key={item.id}>
                  <td className="py-2">{item.productName}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">₹{item.unitPrice}</td>
                  <td className="py-2 text-right font-medium">₹{item.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(() => {
            const orderItems: any[] = order.items ?? []
            const rates = [...new Set(orderItems.map((i: any) => parseFloat(i.taxRate || 0)).filter((r: number) => r > 0))]
            const gstLbl = rates.length === 1 ? `GST (${rates[0]}%)` : 'GST'
            const totalAmt = parseFloat(order.totalAmount || 0)
            const roundedAmt = Math.round(totalAmt)
            const roundOff = parseFloat((roundedAmt - totalAmt).toFixed(2))
            return (
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
                {order.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{order.discountAmount}</span></div>}
                {parseFloat(order.taxAmount || 0) > 0 && <div className="flex justify-between text-gray-600"><span>{gstLbl}</span><span>₹{order.taxAmount}</span></div>}
                {roundOff !== 0 && <div className="flex justify-between text-gray-400 text-xs"><span>Round Off</span><span>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-base"><span>Total</span><span>₹{roundedAmt.toFixed(2)}</span></div>
              </div>
            )
          })()}
          <div className="border-t pt-3">
            <p className="text-xs text-gray-500 uppercase mb-2">Payments</p>
            {order.payments?.map(p => (
              <div key={p.id} className="flex justify-between text-sm"><span className="text-gray-600">{p.paymentMethod}</span><span className="font-medium">₹{p.amount}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
