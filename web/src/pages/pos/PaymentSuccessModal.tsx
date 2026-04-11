import { useState, useRef } from 'react'
import { CheckCircle2, FileText, Printer, X, Loader2, ArrowRight } from 'lucide-react'
import { invoiceApi } from '@/services/api'
import { useNavigate } from 'react-router-dom'

interface Props {
  orderNumber: string
  invoiceId: number | null
  invoiceNumber: string | null
  total: number
  onClose: () => void
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', CARD: 'Card', UPI: 'UPI', WALLET: 'Wallet',
}

export default function PaymentSuccessModal({ orderNumber, invoiceId, invoiceNumber, total, onClose }: Props) {
  const [printing, setPrinting] = useState(false)
  const navigate = useNavigate()

  async function handlePrint() {
    if (!invoiceId) return
    setPrinting(true)
    try {
      const res = await invoiceApi.getById(invoiceId)
      const inv = res.data.data
      printInvoice(inv)
    } catch {
      // silent — still close
    } finally {
      setPrinting(false)
    }
  }

  function printInvoice(inv: any) {
    const win = window.open('', '_blank', 'width=720,height=900')
    if (!win) return

    const items = (inv.items ?? []).map((it: any) => `
      <tr>
        <td>${it.productName}${it.productSku ? `<br/><small style="color:#6b7280">${it.productSku}</small>` : ''}</td>
        <td class="cen">${it.quantity}</td>
        <td class="num">₹${(it.unitPrice ?? 0).toFixed(2)}</td>
        <td class="cen">${(it.discountPercent ?? 0) > 0 ? it.discountPercent + '%' : '—'}</td>
        <td class="cen">${(it.taxRate ?? 0) > 0 ? it.taxRate + '%' : '—'}</td>
        <td class="num"><b>₹${(it.lineTotal ?? 0).toFixed(2)}</b></td>
      </tr>`).join('')

    const payments = (inv.order?.payments ?? []).map((p: any) =>
      `<div class="pay-row"><span>${PAYMENT_LABELS[p.paymentMethod] ?? p.paymentMethod}${p.referenceNumber ? ` <small>(${p.referenceNumber})</small>` : ''}</span><span>₹${(p.amount ?? 0).toFixed(2)}</span></div>`
    ).join('')

    const change = inv.order?.changeAmount > 0
      ? `<div class="pay-row" style="color:#2563eb;font-weight:600"><span>Change Returned</span><span>₹${inv.order.changeAmount.toFixed(2)}</span></div>` : ''

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Invoice ${inv.invoiceNumber}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:32px;max-width:700px;margin:0 auto}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #111}
      .title{font-size:28px;font-weight:900;letter-spacing:-.5px;color:#111}
      .inv-num{font-size:13px;color:#6b7280;margin-top:4px}
      .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:20px 0;background:#f9fafb;padding:16px;border-radius:8px}
      .meta-item label{font-size:10px;text-transform:uppercase;color:#9ca3af;letter-spacing:.05em;display:block;margin-bottom:2px}
      .meta-item p{font-size:13px;color:#111;font-weight:500}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th{background:#f3f4f6;text-align:left;padding:9px 12px;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:.05em}
      td{padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:top}
      .num{text-align:right}.cen{text-align:center}
      .bottom{display:flex;gap:24px;margin-top:16px}
      .payments{flex:1;background:#f9fafb;padding:16px;border-radius:8px}
      .payments h4{font-size:11px;text-transform:uppercase;color:#9ca3af;letter-spacing:.05em;margin-bottom:10px}
      .pay-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#374151}
      .totals{width:240px;background:#f9fafb;padding:16px;border-radius:8px}
      .totals h4{font-size:11px;text-transform:uppercase;color:#9ca3af;letter-spacing:.05em;margin-bottom:10px}
      .t-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#6b7280}
      .t-grand{display:flex;justify-content:space-between;padding:8px 0 0;font-size:16px;font-weight:700;border-top:2px solid #111;margin-top:6px}
      .t-paid{display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#16a34a;font-weight:600}
      .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid}
      .PAID{background:#ecfdf5;color:#15803d;border-color:#bbf7d0}
      .PARTIAL{background:#fefce8;color:#a16207;border-color:#fde68a}
      .footer{margin-top:32px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px}
      @media print{@page{margin:16mm}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="title">INVOICE</div>
        <div class="inv-num">${inv.invoiceNumber}</div>
      </div>
      <span class="badge ${inv.status}">${inv.status}</span>
    </div>
    <div class="meta">
      <div class="meta-item"><label>POS Order #</label><p>${inv.order?.orderNumber ?? '—'}</p></div>
      <div class="meta-item"><label>Issue Date</label><p>${inv.issueDate ?? '—'}</p></div>
      <div class="meta-item"><label>Customer</label><p>${inv.customer?.name ?? 'Walk-in'}</p></div>
    </div>
    <table>
      <thead><tr>
        <th>Product</th><th class="cen">Qty</th><th class="num">Price</th>
        <th class="cen">Disc%</th><th class="cen">Tax%</th><th class="num">Total</th>
      </tr></thead>
      <tbody>${items}</tbody>
    </table>
    <div class="bottom">
      ${payments || change ? `<div class="payments"><h4>Payment Breakdown</h4>${payments}${change}</div>` : '<div style="flex:1"></div>'}
      <div class="totals">
        <h4>Summary</h4>
        <div class="t-row"><span>Subtotal</span><span>₹${(inv.subtotal ?? 0).toFixed(2)}</span></div>
        ${(inv.discountAmount ?? 0) > 0 ? `<div class="t-row" style="color:#16a34a"><span>Discount</span><span>−₹${(inv.discountAmount).toFixed(2)}</span></div>` : ''}
        ${(inv.taxAmount ?? 0) > 0 ? `<div class="t-row"><span>Tax</span><span>+₹${(inv.taxAmount).toFixed(2)}</span></div>` : ''}
        <div class="t-grand"><span>Total</span><span>₹${(inv.totalAmount ?? 0).toFixed(2)}</span></div>
        <div class="t-paid"><span>Paid</span><span>₹${(inv.paidAmount ?? 0).toFixed(2)}</span></div>
      </div>
    </div>
    <div class="footer">Thank you for your business!</div>
    <script>window.onload=function(){window.print();window.close()}</script>
    </body></html>`)
    win.document.close()
  }

  function handleViewInvoice() {
    onClose()
    navigate(`/sales/invoices?invoiceId=${invoiceId}`)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Success banner */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 pt-8 pb-10 text-center relative">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={36} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Payment Successful</h2>
          <p className="text-green-100 text-sm mt-1">₹{total.toFixed(2)} collected</p>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Order + Invoice details */}
        <div className="-mt-4 mx-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Order #</span>
            <span className="font-mono font-semibold text-gray-900">{orderNumber}</span>
          </div>
          {invoiceNumber && (
            <div className="flex justify-between text-gray-500">
              <span>Invoice #</span>
              <span className="font-mono font-semibold text-primary-600">{invoiceNumber}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-4 py-5 space-y-2.5">
          {invoiceId && (
            <>
              <button
                onClick={handlePrint}
                disabled={printing}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-colors"
              >
                {printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                Print Invoice
              </button>
              <button
                onClick={handleViewInvoice}
                className="w-full flex items-center justify-center gap-2 py-1.5 text-sm border border-primary-200 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <FileText size={14} /> View Invoice
                <ArrowRight size={12} className="ml-auto" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Start New Order
          </button>
        </div>
      </div>
    </div>
  )
}
