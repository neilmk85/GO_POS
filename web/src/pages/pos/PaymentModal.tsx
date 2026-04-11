import { useState } from 'react'
import { X, DollarSign, CreditCard, Smartphone, Wallet, Plus, Trash2, Check, Loader2, Mail, MessageSquare, FileX } from 'lucide-react'

export interface PaymentEntry {
  method: string
  amount: string
  reference: string
  creditNoteId?: number
}

const METHODS = [
  { method: 'CASH',        label: 'Cash',        icon: <DollarSign  size={18} />, color: 'text-green-600  border-green-300  bg-green-50' },
  { method: 'CARD',        label: 'Card',        icon: <CreditCard  size={18} />, color: 'text-blue-600   border-blue-300   bg-blue-50' },
  { method: 'UPI',         label: 'UPI',         icon: <Smartphone  size={18} />, color: 'text-purple-600 border-purple-300 bg-purple-50' },
  { method: 'WALLET',      label: 'Wallet',      icon: <Wallet      size={18} />, color: 'text-orange-600 border-orange-300 bg-orange-50' },
  { method: 'CREDIT_NOTE', label: 'Credit Note', icon: <FileX       size={18} />, color: 'text-blue-700   border-blue-400   bg-blue-50' },
]

interface Props {
  total: number
  onClose: () => void
  onConfirm: (payments: any[], options: any) => Promise<void>
  creditNotes?: any[]
}

export default function PaymentModal({ total, onClose, onConfirm, creditNotes = [] }: Props) {
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { method: 'CASH', amount: total.toFixed(2), reference: '' },
  ])
  const [sendSms,      setSendSms]      = useState(true)
  const [sendEmail,    setSendEmail]    = useState(false)
  const [sendWhatsapp, setSendWhatsapp] = useState(false)
  const [loading, setLoading] = useState(false)

  const paid      = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const remaining = parseFloat((total - paid).toFixed(2))
  const cashPaid  = payments.filter(p => p.method === 'CASH').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const change    = Math.max(0, parseFloat((cashPaid - total).toFixed(2)))
  const canConfirm = paid >= total

  // For each credit-note payment row, compute leftover balance after applying
  function creditNoteLeftover(p: PaymentEntry): number | null {
    if (p.method !== 'CREDIT_NOTE' || !p.creditNoteId) return null
    const note = creditNotes.find(n => n.id === p.creditNoteId)
    if (!note) return null
    const noteBalance = parseFloat(String(note.remainingAmount ?? 0))
    const applied = parseFloat(p.amount) || 0
    const leftover = noteBalance - applied
    return leftover > 0 ? parseFloat(leftover.toFixed(2)) : null
  }

  function updatePayment(idx: number, field: keyof PaymentEntry, val: string | number | undefined) {
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }

  function selectCreditNote(idx: number, note: any) {
    const noteBalance = parseFloat(String(note.remainingAmount ?? 0))
    // cap at what's still owed on this row (remaining balance + what this row already has)
    const rowCurrentAmount = parseFloat(payments[idx].amount) || 0
    const stillOwed = Math.max(0, remaining + rowCurrentAmount)
    const applicable = Math.min(noteBalance, stillOwed)
    setPayments(prev => prev.map((p, i) => i === idx
      ? { ...p, creditNoteId: note.id, amount: applicable.toFixed(2), reference: note.creditNoteNumber }
      : p
    ))
  }

  function addPayment() {
    const leftover = Math.max(0, remaining).toFixed(2)
    setPayments(prev => [...prev, { method: 'CARD', amount: leftover, reference: '' }])
  }

  function removePayment(idx: number) {
    setPayments(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleConfirm() {
    setLoading(true)
    try {
      const finalPayments = payments
        .filter(p => parseFloat(p.amount) > 0)
        .map(p => ({
          paymentMethod: p.method,
          amount: parseFloat(p.amount),
          referenceNumber: p.reference.trim() || undefined,
          creditNoteId: p.creditNoteId,
        }))
      await onConfirm(finalPayments, { sendSmsReceipt: sendSms, sendEmailReceipt: sendEmail, sendWhatsappReceipt: sendWhatsapp })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={22} /></button>
        </div>

        <div className="overflow-auto flex-1 px-6 py-4 space-y-4">
          {/* Amount Due */}
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Amount Due</p>
            <p className="text-4xl font-bold text-gray-900">₹{total.toFixed(2)}</p>
            {change > 0 && (
              <div className="mt-2 bg-green-100 rounded-lg px-3 py-1.5 inline-flex items-center gap-2">
                <span className="text-green-700 text-sm font-medium">Change to return: ₹{change.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Available credit notes banner */}
          {creditNotes.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-700">Customer has credit notes</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {creditNotes.length} active · ₹{creditNotes.reduce((s, n) => s + parseFloat(String(n.remainingAmount ?? 0)), 0).toFixed(2)} available
                </p>
              </div>
              <FileX size={20} className="text-blue-400" />
            </div>
          )}

          {/* Payment rows */}
          <div className="space-y-3">
            {payments.map((p, idx) => {
              const cnLeftover = creditNoteLeftover(p)
              return (
                <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  {/* Method selector */}
                  <div className={`grid gap-1.5 ${creditNotes.length > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
                    {METHODS.filter(m => m.method !== 'CREDIT_NOTE' || creditNotes.length > 0).map(m => (
                      <button key={m.method} onClick={() => {
                        updatePayment(idx, 'method', m.method)
                        if (m.method !== 'CREDIT_NOTE') updatePayment(idx, 'creditNoteId', undefined)
                      }}
                        className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          p.method === m.method ? m.color + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {m.icon}<span>{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Credit note picker */}
                  {p.method === 'CREDIT_NOTE' && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500 font-medium">Select credit note</p>
                      {creditNotes.map(note => {
                        const noteBalance = parseFloat(String(note.remainingAmount ?? 0))
                        const selected = p.creditNoteId === note.id
                        return (
                          <button key={note.id} onClick={() => selectCreditNote(idx, note)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                              selected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/50'
                            }`}>
                            <span className="font-mono text-xs text-gray-600">{note.creditNoteNumber}</span>
                            <span className={`font-semibold ${selected ? 'text-blue-700' : 'text-gray-700'}`}>
                              ₹{noteBalance.toFixed(2)} available
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Amount */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                      <input type="number" min="0" step="0.01"
                        value={p.amount}
                        onChange={e => updatePayment(idx, 'amount', e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    {/* Quick amounts for cash */}
                    {p.method === 'CASH' && (
                      <div className="flex gap-1">
                        {[50, 100, 500].map(amt => (
                          <button key={amt} onClick={() => updatePayment(idx, 'amount', amt.toString())}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium">
                            {amt}
                          </button>
                        ))}
                        <button onClick={() => updatePayment(idx, 'amount', Math.ceil(total / 100) * 100 + '')}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium">
                          Exact
                        </button>
                      </div>
                    )}
                    {payments.length > 1 && (
                      <button onClick={() => removePayment(idx)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {/* Credit note leftover balance */}
                  {cnLeftover !== null && (
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-blue-700 font-medium">Remaining credit after this sale</span>
                      <span className="text-sm font-bold text-blue-700">₹{cnLeftover.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Reference for card/upi */}
                  {(p.method === 'CARD' || p.method === 'UPI' || p.method === 'WALLET') && (
                    <input value={p.reference} onChange={e => updatePayment(idx, 'reference', e.target.value)}
                      placeholder={p.method === 'CARD' ? 'Card approval code (optional)' : p.method === 'UPI' ? 'UPI transaction ID (optional)' : 'Reference (optional)'}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-gray-400"
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Split payment button */}
          {remaining > 0 && (
            <button onClick={addPayment}
              className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
              <Plus size={15} /> Add another payment method
              <span className="text-xs text-gray-400">(₹{remaining.toFixed(2)} remaining)</span>
            </button>
          )}

          {/* Paid / remaining summary */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Total Due</span><span className="font-medium">₹{total.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Total Paid</span><span className="font-medium">₹{paid.toFixed(2)}</span></div>
            {remaining > 0 && <div className="flex justify-between text-red-600 font-medium"><span>Remaining</span><span>₹{remaining.toFixed(2)}</span></div>}
            {change > 0  && <div className="flex justify-between text-green-700 font-bold"><span>Change</span><span>₹{change.toFixed(2)}</span></div>}
          </div>

          {/* Receipt options */}
          <div className="border rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Send Receipt</p>
            {[
              { key: 'sms',      label: 'SMS',      icon: <MessageSquare size={13} />, val: sendSms,      set: setSendSms },
              { key: 'email',    label: 'Email',    icon: <Mail size={13} />,          val: sendEmail,    set: setSendEmail },
              { key: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare size={13} />, val: sendWhatsapp, set: setSendWhatsapp },
            ].map(({ key, label, icon, val, set }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                <span className="flex items-center gap-1.5 text-sm text-gray-700">{icon}{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Confirm button */}
        <div className="px-6 py-4 border-t shrink-0">
          <button onClick={handleConfirm} disabled={!canConfirm || loading}
            className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-lg transition-colors">
            {loading ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />}
            {loading ? 'Processing…' : canConfirm ? `Confirm ₹${total.toFixed(2)}` : `Need ₹${remaining.toFixed(2)} more`}
          </button>
        </div>
      </div>
    </div>
  )
}
