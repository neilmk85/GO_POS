import { useEffect, useState, useRef } from 'react'
import { X, Printer, CheckCircle2 } from 'lucide-react'
import { outletApi } from '@/services/api'
import { Outlet } from '@/types'

interface InvoiceProps {
  order: any
  customer: any | null
  staffName: string | null
  outletId: number
  onClose: () => void
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', CARD: 'Card', UPI: 'UPI', WALLET: 'Wallet',
}

export default function InvoiceModal({ order, customer, staffName, outletId, onClose }: InvoiceProps) {
  const [outlet, setOutlet] = useState<Outlet | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    outletApi.getById(outletId).then(r => setOutlet(r.data.data)).catch(() => {})
  }, [outletId])

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const items: any[]    = order.items    || []
  const payments: any[] = order.payments || []
  const subtotal        = parseFloat(order.subtotal    || 0)
  const discount        = parseFloat(order.discountAmount || 0)
  const tax             = parseFloat(order.taxAmount   || 0)
  const total           = parseFloat(order.totalAmount || 0)
  const paid            = parseFloat(order.paidAmount  || 0)
  const change          = parseFloat(order.changeAmount || 0)

  // GST label: show % if all items share the same rate
  const taxRates = [...new Set(items.map((i: any) => parseFloat(i.taxRate || 0)).filter(r => r > 0))]
  const gstLabel = taxRates.length === 1 ? `GST (${taxRates[0]}%)` : 'GST'

  // Rounding off: difference between rounded and exact total
  const roundedTotal = Math.round(total)
  const roundOff     = parseFloat((roundedTotal - total).toFixed(2))

  function handlePrint() {
    const content = contentRef.current
    if (!content) return

    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) return

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Invoice - ${order.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; color: #111; background: #fff; padding: 16px; max-width: 380px; margin: 0 auto; }
          .center { text-align: center; }
          .bold   { font-weight: bold; }
          .large  { font-size: 16px; }
          .xlarge { font-size: 20px; font-weight: bold; }
          .divider { border-top: 1px dashed #999; margin: 8px 0; }
          .divider-solid { border-top: 2px solid #111; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .row-right { text-align: right; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 11px; color: #555; padding-bottom: 4px; }
          td { padding: 3px 0; font-size: 12px; vertical-align: top; }
          td.right { text-align: right; }
          .total-row { font-weight: bold; font-size: 14px; }
          .badge { display: inline-block; background: #111; color: #fff; padding: 1px 6px; border-radius: 3px; font-size: 11px; margin-top: 4px; }
          .footer { margin-top: 12px; text-align: center; font-size: 11px; color: #666; }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.onload = function(){ window.print(); window.close(); }</script>
      </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[92vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-500" />
            <span className="font-bold text-gray-900">Payment Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable invoice */}
        <div className="overflow-y-auto flex-1 px-1 py-2">

          {/* ── Print content ──────────────────────────────────────── */}
          <div ref={contentRef} className="px-4 py-3 font-mono text-[12px] text-gray-900">

            {/* Outlet header */}
            <div className="center text-center mb-3">
              <p className="xlarge text-[17px] font-extrabold leading-tight">{outlet?.name || 'Store'}</p>
              {outlet?.address && <p className="text-gray-500 text-[11px] mt-0.5">{outlet.address}{outlet.city ? `, ${outlet.city}` : ''}</p>}
              {outlet?.phone  && <p className="text-gray-500 text-[11px]">Ph: {outlet.phone}</p>}
              {outlet?.gstin  && <p className="text-gray-500 text-[11px]">GSTIN: {outlet.gstin}</p>}
              {outlet?.receiptHeader && (
                <p className="text-gray-600 text-[11px] mt-1 italic whitespace-pre-wrap">{outlet.receiptHeader}</p>
              )}
            </div>

            <div className="divider border-t border-dashed border-gray-300 my-2" />

            {/* Order meta */}
            <div className="space-y-0.5 mb-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Order#</span>
                <span className="font-bold tracking-wide">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span>{orderDate}</span>
              </div>
              {staffName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Cashier</span>
                  <span>{staffName}</span>
                </div>
              )}
              {customer && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer</span>
                  <span className="truncate max-w-[160px] text-right">{customer.name}</span>
                </div>
              )}
              {customer?.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone</span>
                  <span>{customer.phone}</span>
                </div>
              )}
            </div>

            <div className="divider border-t border-dashed border-gray-300 my-2" />

            {/* Items */}
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left pb-1 text-gray-500 font-semibold">Item</th>
                  <th className="text-right pb-1 text-gray-500 font-semibold">Qty</th>
                  <th className="text-right pb-1 text-gray-500 font-semibold">Rate</th>
                  <th className="text-right pb-1 text-gray-500 font-semibold">Amt</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => {
                  const qty   = parseFloat(item.quantity   || 0)
                  const price = parseFloat(item.unitPrice  || 0)
                  const disc  = parseFloat(item.discountAmount || 0)
                  const line  = parseFloat(item.lineTotal  || 0)
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1 pr-1">
                        <span className="block leading-tight">{item.productName}</span>
                        {item.variantName && <span className="text-gray-400 text-[10px]">{item.variantName}</span>}
                        {disc > 0 && <span className="text-green-600 text-[10px] block">-₹{disc.toFixed(2)} disc</span>}
                      </td>
                      <td className="py-1 text-right align-top">{qty % 1 === 0 ? qty : qty.toFixed(2)}</td>
                      <td className="py-1 text-right align-top">₹{price.toFixed(2)}</td>
                      <td className="py-1 text-right align-top font-medium">₹{line.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="divider border-t border-dashed border-gray-300 my-2" />

            {/* Totals */}
            <div className="space-y-0.5 text-[12px]">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{order.couponCode ? `Discount (${order.couponCode})` : 'Discount'}</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{gstLabel}</span><span>+₹{tax.toFixed(2)}</span>
                </div>
              )}
              {roundOff !== 0 && (
                <div className="flex justify-between text-gray-500 text-[11px]">
                  <span>Round Off</span><span>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-[14px] pt-1 border-t border-gray-900 mt-1">
                <span>TOTAL</span><span>₹{roundedTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="divider border-t border-dashed border-gray-300 my-2" />

            {/* Payments */}
            <div className="space-y-0.5 text-[12px]">
              {payments.map((p: any, i: number) => (
                <div key={i} className="flex justify-between text-gray-600">
                  <span>{PAYMENT_LABELS[p.paymentMethod] || p.paymentMethod}{p.referenceNumber ? ` (${p.referenceNumber})` : ''}</span>
                  <span>₹{parseFloat(p.amount || 0).toFixed(2)}</span>
                </div>
              ))}
              {change > 0 && (
                <div className="flex justify-between font-bold text-blue-700">
                  <span>Change</span><span>₹{change.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-[11px] text-gray-400">
              <p>━━━━━━━━━━━━━━━━━━━━━━━━</p>
              {outlet?.receiptFooter
                ? <p className="mt-1 text-gray-500 whitespace-pre-wrap">{outlet.receiptFooter}</p>
                : <p className="mt-1 font-semibold text-gray-500">Thank you for your visit!</p>
              }
            </div>

          </div>
          {/* ── End print content ──────────────────────────────────── */}

        </div>

        {/* New order button */}
        <div className="px-5 py-3.5 border-t shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-bold rounded-xl text-sm transition-colors"
          >
            New Order
          </button>
        </div>
      </div>
    </div>
  )
}
