import { useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  Download, FileText, RefreshCw, ChevronDown, ChevronUp,
  FileSpreadsheet, Info, CheckCircle2, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { gstApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

type Tab = 'gstr1' | 'gstr3b' | 'hsn' | 'tally'

const TABS: { key: Tab; label: string }[] = [
  { key: 'gstr1', label: 'GSTR-1' },
  { key: 'gstr3b', label: 'GSTR-3B' },
  { key: 'hsn', label: 'HSN Summary' },
  { key: 'tally', label: 'Tally Export' },
]

function fmt(v: any) {
  if (v == null) return '—'
  const n = Number(v)
  return isNaN(n) ? String(v) : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function num(v: any) {
  if (v == null) return '—'
  const n = Number(v)
  return isNaN(n) ? String(v) : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function triggerDownload(promise: Promise<any>, filename: string) {
  const res = await promise
  const mime = filename.endsWith('.xml') ? 'application/xml' : 'text/csv'
  const url = URL.createObjectURL(new Blob([res.data], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function GstReportPage() {
  const { outletId } = useAuthStore()
  const [tab, setTab] = useState<Tab>('gstr1')

  // Period: default to current month
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const [data, setData] = useState<any>(null)
  const [hsnPurchaseData, setHsnPurchaseData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [b2bExpanded, setB2bExpanded] = useState(true)
  const [b2csExpanded, setB2csExpanded] = useState(true)
  const [hsnExpanded, setHsnExpanded] = useState(true)

  function setPreset(months: number) {
    const d = months === 0 ? new Date() : subMonths(new Date(), months - 1)
    setFrom(format(startOfMonth(d), 'yyyy-MM-dd'))
    setTo(format(endOfMonth(d), 'yyyy-MM-dd'))
  }

  async function fetchData() {
    if (!outletId) return
    setLoading(true)
    setData(null)
    try {
      if (tab === 'gstr1') {
        const res = await gstApi.getGstr1(outletId, from, to)
        setData(res.data.data)
      } else if (tab === 'gstr3b') {
        const res = await gstApi.getGstr3b(outletId, from, to)
        setData(res.data.data)
      } else if (tab === 'hsn') {
        const [saleRes, purchaseRes] = await Promise.all([
          gstApi.getHsnSummary(outletId, from, to),
          gstApi.getHsnPurchaseSummary(outletId, from, to),
        ])
        setData(saleRes.data.data)
        setHsnPurchaseData(purchaseRes.data.data ?? [])
      }
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport(type: 'gstr1' | 'gstr3b' | 'hsn' | 'hsn-purchase' | 'tally') {
    if (!outletId) return
    setExporting(true)
    try {
      if (type === 'gstr1') {
        await triggerDownload(gstApi.exportGstr1Csv(outletId, from, to), `GSTR1_${from}_${to}.csv`)
      } else if (type === 'gstr3b') {
        await triggerDownload(gstApi.exportGstr3bCsv(outletId, from, to), `GSTR3B_${from}_${to}.csv`)
      } else if (type === 'hsn') {
        await triggerDownload(gstApi.exportHsnCsv(outletId, from, to), `HSN_Summary_${from}_${to}.csv`)
      } else if (type === 'hsn-purchase') {
        await triggerDownload(gstApi.exportHsnPurchaseCsv(outletId, from, to), `HSN_Purchase_${from}_${to}.csv`)
      } else if (type === 'tally') {
        await triggerDownload(gstApi.tallyExport(outletId, from, to), `Tally_Export_${from}_${to}.xml`)
      }
      toast.success('File downloaded')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  // ── Period selector ────────────────────────────────────────────────────────

  const PeriodBar = () => (
    <div className="flex flex-wrap items-center gap-2">
      {['This Month', 'Last Month', 'Last 3M'].map((label, i) => (
        <button key={label} onClick={() => setPreset(i === 0 ? 0 : i === 1 ? 1 : 3)}
          className="px-2 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600 transition-colors">
          {label}
        </button>
      ))}
      <input type="date" value={from} onChange={e => setFrom(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1 text-xs" />
      <span className="text-gray-400 text-xs">–</span>
      <input type="date" value={to} onChange={e => setTo(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1 text-xs" />
      <button onClick={fetchData} disabled={loading}
        className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 active:scale-95 active:from-violet-800 active:to-blue-800 text-white px-3 py-1 rounded-md text-xs font-medium disabled:opacity-60 transition-all">
        <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Loading…' : 'Generate'}
      </button>
    </div>
  )

  // ── GSTR-1 view ────────────────────────────────────────────────────────────

  const Gstr1View = () => {
    const hasData = data !== null
    const b2b: any[] = data?.b2b || []
    const b2cs: any[] = data?.b2cs || []
    const hsn: any[] = data?.hsnSummary || []

    const placeholder = (cols: number) => (
      <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-gray-400">
        {loading ? 'Loading…' : 'Click Generate to load data'}
      </td></tr>
    )

    return (
      <div className="space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Taxable Value', value: hasData ? fmt(data.totalTaxableValue) : '—', gradient: 'bg-gradient-to-br from-slate-500 to-slate-700' },
            { label: 'CGST', value: hasData ? fmt(data.totalCgst) : '—', gradient: 'bg-gradient-to-br from-blue-400 to-blue-600' },
            { label: 'SGST', value: hasData ? fmt(data.totalSgst) : '—', gradient: 'bg-gradient-to-br from-teal-400 to-teal-600' },
            { label: 'IGST', value: hasData ? fmt(data.totalIgst) : '—', gradient: 'bg-gradient-to-br from-violet-400 to-violet-600' },
            { label: 'Grand Total', value: hasData ? fmt(data.grandTotal) : '—', gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-700' },
          ].map(c => (
            <div key={c.label} className={`${c.gradient} rounded-xl p-3 text-center shadow-sm`}>
              <p className="text-lg font-bold text-white">{c.value}</p>
              <p className="text-xs text-white/70 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Info size={13} />
            {hasData
              ? <><span>Total invoices: <strong>{data.totalInvoices}</strong> | Period: <strong>{data.period}</strong></span>
                  {data.outletGstin && <span>| GSTIN: <strong className="font-mono">{data.outletGstin}</strong></span>}</>
              : <span>Select a period and click Generate</span>
            }
          </div>
          <button onClick={() => handleExport('gstr1')} disabled={exporting || !hasData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40">
            <FileText size={14} className="text-green-600" /> Export CSV
          </button>
        </div>

        {/* B2B Section */}
        <div className="rounded-xl overflow-hidden shadow-lg">
          <button onClick={() => setB2bExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-800">B2B — Registered Business Customers (GSTIN)</span>
              {hasData && <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">{b2b.length} invoices</span>}
            </div>
            {b2bExpanded ? <ChevronUp size={15} className="text-blue-600" /> : <ChevronDown size={15} className="text-blue-600" />}
          </button>
          {b2bExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">GSTIN</th>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Invoice #</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Invoice Value</th>
                    <th className="px-3 py-2 text-right">Taxable</th>
                    <th className="px-3 py-2 text-right">CGST</th>
                    <th className="px-3 py-2 text-right">SGST</th>
                    <th className="px-3 py-2 text-right">IGST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!hasData || b2b.length === 0 ? placeholder(9) : b2b.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-600">{row.gstin}</td>
                      <td className="px-3 py-2 text-gray-800 font-medium">{row.customerName}</td>
                      <td className="px-3 py-2 text-gray-600">{row.invoiceNumber}</td>
                      <td className="px-3 py-2 text-gray-500">{row.invoiceDate}</td>
                      <td className="px-3 py-2 text-right font-semibold">{num(row.invoiceValue)}</td>
                      <td className="px-3 py-2 text-right">{num(row.taxableValue)}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{num(row.cgst)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{num(row.sgst)}</td>
                      <td className="px-3 py-2 text-right text-purple-700">{num(row.igst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* B2CS Section */}
        <div className="rounded-xl overflow-hidden shadow-lg">
          <button onClick={() => setB2csExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-green-800">B2CS — Unregistered Customers (Aggregate)</span>
              {hasData && <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">{b2cs.length} tax slab{b2cs.length !== 1 ? 's' : ''}</span>}
            </div>
            {b2csExpanded ? <ChevronUp size={15} className="text-green-600" /> : <ChevronDown size={15} className="text-green-600" />}
          </button>
          {b2csExpanded && (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">GST Rate %</th>
                  <th className="px-4 py-2 text-right">Taxable Value</th>
                  <th className="px-4 py-2 text-right">CGST</th>
                  <th className="px-4 py-2 text-right">SGST</th>
                  <th className="px-4 py-2 text-right">IGST</th>
                  <th className="px-4 py-2 text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!hasData || b2cs.length === 0 ? placeholder(6) : b2cs.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-800">{row.taxRate}%</td>
                    <td className="px-4 py-2 text-right">{num(row.taxableValue)}</td>
                    <td className="px-4 py-2 text-right text-blue-700">{num(row.cgst)}</td>
                    <td className="px-4 py-2 text-right text-green-700">{num(row.sgst)}</td>
                    <td className="px-4 py-2 text-right text-purple-700">{num(row.igst)}</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {num(Number(row.cgst) + Number(row.sgst) + Number(row.igst))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Inline HSN summary */}
        <div className="rounded-xl overflow-hidden shadow-lg">
          <button onClick={() => setHsnExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-amber-800">HSN / SAC Summary</span>
              {hasData && <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{hsn.length} code{hsn.length !== 1 ? 's' : ''}</span>}
            </div>
            {hsnExpanded ? <ChevronUp size={15} className="text-amber-600" /> : <ChevronDown size={15} className="text-amber-600" />}
          </button>
          {hsnExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">HSN Code</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">UOM</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Taxable</th>
                    <th className="px-3 py-2 text-right">CGST</th>
                    <th className="px-3 py-2 text-right">SGST</th>
                    <th className="px-3 py-2 text-right">Total Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!hasData || hsn.length === 0 ? placeholder(8) : hsn.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-semibold text-gray-800">{row.hsnCode}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate">{row.description}</td>
                      <td className="px-3 py-2 text-gray-500">{row.uom}</td>
                      <td className="px-3 py-2 text-right">{num(row.totalQuantity)}</td>
                      <td className="px-3 py-2 text-right">{num(row.taxableValue)}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{num(row.cgst)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{num(row.sgst)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{num(row.totalTax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── GSTR-3B view ───────────────────────────────────────────────────────────

  const Gstr3bView = () => {
    const hasData = data !== null
    const s31 = data?.section3_1_taxable || {}
    const itc = data?.section4_itc || {}
    const net = data?.netTaxPayable || {}
    const carry = data?.itcCarryForward || {}
    const hasCarry = hasData && Number(carry.total ?? 0) > 0
    const d = (v: any) => hasData ? num(v) : '—'

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Info size={13} />
            {hasData
              ? <><span>Period: <strong>{data.period}</strong> | Outlet: <strong>{data.outletName}</strong></span>
                  {data.outletGstin && <span>| GSTIN: <strong className="font-mono">{data.outletGstin}</strong></span>}
                  {data.billCount > 0 && <span className="text-emerald-600">| ITC from <strong>{data.billCount}</strong> purchase bill{data.billCount !== 1 ? 's' : ''}</span>}</>
              : <span>Select a period and click Generate</span>
            }
          </div>
          <button onClick={() => handleExport('gstr3b')} disabled={exporting || !hasData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40">
            <FileText size={14} className="text-green-600" /> Export CSV
          </button>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Gross Sales', value: hasData ? fmt(data.grossSales) : '—', gradient: 'bg-gradient-to-br from-emerald-400 to-emerald-600' },
            { label: 'Total Discount', value: hasData ? fmt(data.totalDiscount) : '—', gradient: 'bg-gradient-to-br from-rose-400 to-rose-600' },
            { label: 'Net Tax Payable', value: hasData ? fmt(net.total) : '—', gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-700' },
            { label: 'ITC Carry Forward', value: hasData ? fmt(carry.total ?? 0) : '—', gradient: hasCarry ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-slate-400 to-slate-600' },
          ].map(c => (
            <div key={c.label} className={`${c.gradient} rounded-xl p-4 text-center shadow-sm`}>
              <p className="text-xl font-bold text-white">{c.value}</p>
              <p className="text-xs text-white/70 mt-1">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Section 3.1 */}
        <div className="bg-white rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-blue-50 border-b">
            <h3 className="text-sm font-semibold text-blue-800">3.1 — Details of Outward Supplies and Inward Supplies liable to reverse charge</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left w-8">#</th>
                <th className="px-4 py-2 text-left">Nature of Supplies</th>
                <th className="px-4 py-2 text-right">Total Taxable Value</th>
                <th className="px-4 py-2 text-right">Integrated Tax</th>
                <th className="px-4 py-2 text-right">Central Tax</th>
                <th className="px-4 py-2 text-right">State/UT Tax</th>
                <th className="px-4 py-2 text-right">Cess</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs">(a)</td>
                <td className="px-4 py-3 text-gray-700">Outward taxable supplies (other than zero rated, nil and exempted)</td>
                <td className="px-4 py-3 text-right font-semibold">{d(s31.taxableValue)}</td>
                <td className="px-4 py-3 text-right text-purple-700">{d(s31.igst)}</td>
                <td className="px-4 py-3 text-right text-blue-700">{d(s31.cgst)}</td>
                <td className="px-4 py-3 text-right text-green-700">{d(s31.sgst)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{d(s31.cess)}</td>
              </tr>
              <tr className="text-gray-400 hover:bg-gray-50">
                <td className="px-4 py-3 text-xs">(b)</td>
                <td className="px-4 py-3">Outward taxable supplies (zero rated)</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">0.00</td>
              </tr>
              <tr className="text-gray-400 hover:bg-gray-50">
                <td className="px-4 py-3 text-xs">(c)</td>
                <td className="px-4 py-3">Other outward supplies (nil rated, exempted)</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
              </tr>
              <tr className="text-gray-400 hover:bg-gray-50">
                <td className="px-4 py-3 text-xs">(d)</td>
                <td className="px-4 py-3">Inward supplies (liable to reverse charge)</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">0.00</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 4 — ITC */}
        <div className="bg-white rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-amber-50 border-b">
            <h3 className="text-sm font-semibold text-amber-800">4 — Eligible ITC (Input Tax Credit)</h3>
            <p className="text-xs text-amber-600 mt-0.5">ITC from purchase invoices — link your purchase bills with tax details to populate this section automatically.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right">Integrated Tax</th>
                <th className="px-4 py-2 text-right">Central Tax</th>
                <th className="px-4 py-2 text-right">State/UT Tax</th>
                <th className="px-4 py-2 text-right">Cess</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-gray-400">
                <td className="px-4 py-3">4(A)(5) — All other ITC (from purchase bills)</td>
                <td className="px-4 py-3 text-right">{d(itc.igst)}</td>
                <td className="px-4 py-3 text-right">{d(itc.cgst)}</td>
                <td className="px-4 py-3 text-right">{d(itc.sgst)}</td>
                <td className="px-4 py-3 text-right">{d(itc.cess)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net Tax Payable */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Net Tax Payable (Output Tax − ITC)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'IGST', value: net.igst, gradient: 'bg-gradient-to-br from-violet-400 to-violet-600' },
              { label: 'CGST', value: net.cgst, gradient: 'bg-gradient-to-br from-blue-400 to-blue-600' },
              { label: 'SGST/UTGST', value: net.sgst, gradient: 'bg-gradient-to-br from-teal-400 to-teal-600' },
              { label: 'Cess', value: net.cess, gradient: 'bg-gradient-to-br from-slate-400 to-slate-600' },
              { label: 'Total Tax', value: net.total, gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-700' },
            ].map(c => (
              <div key={c.label} className={`${c.gradient} rounded-lg p-3 text-center shadow-sm`}>
                <p className="font-bold text-white">{hasData ? num(c.value) : '—'}</p>
                <p className="text-xs text-white/70 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── HSN Summary view ───────────────────────────────────────────────────────

  const HsnView = () => {
    const saleRows: any[] = Array.isArray(data) ? data : []
    const purchaseRows: any[] = Array.isArray(hsnPurchaseData) ? hsnPurchaseData : []
    const hasData = data !== null

    const saleTaxable = saleRows.reduce((s, r) => s + Number(r.taxableValue || 0), 0)
    const saleCgst = saleRows.reduce((s, r) => s + Number(r.cgst || 0), 0)
    const saleSgst = saleRows.reduce((s, r) => s + Number(r.sgst || 0), 0)
    const saleTax = saleRows.reduce((s, r) => s + Number(r.totalTax || 0), 0)

    const purTaxable = purchaseRows.reduce((s, r) => s + Number(r.taxableValue || 0), 0)
    const purCgst = purchaseRows.reduce((s, r) => s + Number(r.cgst || 0), 0)
    const purSgst = purchaseRows.reduce((s, r) => s + Number(r.sgst || 0), 0)
    const purTax = purchaseRows.reduce((s, r) => s + Number(r.totalTax || 0), 0)

    const PlaceholderRow = ({ cols }: { cols: number }) => (
      <tr>
        <td colSpan={cols} className="px-4 py-12 text-center text-gray-400 text-sm">
          {loading ? 'Loading data…' : 'Click Generate to load HSN data'}
        </td>
      </tr>
    )

    return (
      <div className="space-y-6">
        {/* ── HSN Sale Report ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">HSN Sale Report</h3>
            <button onClick={() => handleExport('hsn')} disabled={exporting || !hasData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40">
              <FileText size={14} className="text-green-600" /> Export CSV
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'HSN Codes', value: hasData ? saleRows.length : '—', gradient: 'bg-gradient-to-br from-slate-500 to-slate-700' },
              { label: 'Taxable Value', value: hasData ? fmt(saleTaxable) : '—', gradient: 'bg-gradient-to-br from-cyan-400 to-cyan-600' },
              { label: 'CGST + SGST', value: hasData ? fmt(saleCgst + saleSgst) : '—', gradient: 'bg-gradient-to-br from-blue-400 to-blue-600' },
              { label: 'Total Tax', value: hasData ? fmt(saleTax) : '—', gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-700' },
            ].map(c => (
              <div key={c.label} className={`${c.gradient} rounded-xl p-3 text-center shadow-sm`}>
                <p className="text-lg font-bold text-white">{c.value}</p>
                <p className="text-xs text-white/70 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">HSN/SAC Code</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">UOM</th>
                  <th className="px-4 py-3 text-right">Total Qty</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">CGST</th>
                  <th className="px-4 py-3 text-right">SGST</th>
                  <th className="px-4 py-3 text-right">IGST</th>
                  <th className="px-4 py-3 text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!hasData || saleRows.length === 0 ? (
                  <PlaceholderRow cols={10} />
                ) : (
                  <>
                    {saleRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-800">{row.hsnCode}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={row.description}>{row.description}</td>
                        <td className="px-4 py-3 text-gray-500">{row.uom}</td>
                        <td className="px-4 py-3 text-right">{num(row.totalQuantity)}</td>
                        <td className="px-4 py-3 text-right">{num(row.totalValue)}</td>
                        <td className="px-4 py-3 text-right font-medium">{num(row.taxableValue)}</td>
                        <td className="px-4 py-3 text-right text-blue-700">{num(row.cgst)}</td>
                        <td className="px-4 py-3 text-right text-green-700">{num(row.sgst)}</td>
                        <td className="px-4 py-3 text-right text-purple-700">{num(row.igst)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{num(row.totalTax)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold text-sm">
                      <td className="px-4 py-3 text-gray-700" colSpan={3}>Total</td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-right">{num(saleRows.reduce((s, r) => s + Number(r.totalValue || 0), 0))}</td>
                      <td className="px-4 py-3 text-right">{num(saleTaxable)}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{num(saleCgst)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{num(saleSgst)}</td>
                      <td className="px-4 py-3 text-right text-purple-700">0.00</td>
                      <td className="px-4 py-3 text-right">{num(saleTax)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── HSN Purchase Report ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">HSN Purchase Report</h3>
            <button onClick={() => handleExport('hsn-purchase')} disabled={exporting || !hasData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40">
              <FileText size={14} className="text-green-600" /> Export CSV
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'HSN Codes', value: hasData ? purchaseRows.length : '—', gradient: 'bg-gradient-to-br from-slate-500 to-slate-700' },
              { label: 'Taxable Value', value: hasData ? fmt(purTaxable) : '—', gradient: 'bg-gradient-to-br from-teal-400 to-teal-600' },
              { label: 'CGST + SGST', value: hasData ? fmt(purCgst + purSgst) : '—', gradient: 'bg-gradient-to-br from-emerald-400 to-emerald-600' },
              { label: 'Total Tax', value: hasData ? fmt(purTax) : '—', gradient: 'bg-gradient-to-br from-green-500 to-green-700' },
            ].map(c => (
              <div key={c.label} className={`${c.gradient} rounded-xl p-3 text-center shadow-sm`}>
                <p className="text-lg font-bold text-white">{c.value}</p>
                <p className="text-xs text-white/70 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">HSN/SAC Code</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">UOM</th>
                  <th className="px-4 py-3 text-right">Ordered Qty</th>
                  <th className="px-4 py-3 text-right">Received Qty</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">CGST</th>
                  <th className="px-4 py-3 text-right">SGST</th>
                  <th className="px-4 py-3 text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!hasData || purchaseRows.length === 0 ? (
                  <PlaceholderRow cols={10} />
                ) : (
                  <>
                    {purchaseRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-800">{row.hsnCode}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={row.description}>{row.description}</td>
                        <td className="px-4 py-3 text-gray-500">{row.uom}</td>
                        <td className="px-4 py-3 text-right">{num(row.totalOrderedQty)}</td>
                        <td className="px-4 py-3 text-right">{num(row.totalReceivedQty)}</td>
                        <td className="px-4 py-3 text-right">{num(row.totalValue)}</td>
                        <td className="px-4 py-3 text-right font-medium">{num(row.taxableValue)}</td>
                        <td className="px-4 py-3 text-right text-blue-700">{num(row.cgst)}</td>
                        <td className="px-4 py-3 text-right text-green-700">{num(row.sgst)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{num(row.totalTax)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold text-sm">
                      <td className="px-4 py-3 text-gray-700" colSpan={3}>Total</td>
                      <td className="px-4 py-3 text-right">{num(purchaseRows.reduce((s, r) => s + Number(r.totalOrderedQty || 0), 0))}</td>
                      <td className="px-4 py-3 text-right">{num(purchaseRows.reduce((s, r) => s + Number(r.totalReceivedQty || 0), 0))}</td>
                      <td className="px-4 py-3 text-right">{num(purchaseRows.reduce((s, r) => s + Number(r.totalValue || 0), 0))}</td>
                      <td className="px-4 py-3 text-right">{num(purTaxable)}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{num(purCgst)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{num(purSgst)}</td>
                      <td className="px-4 py-3 text-right">{num(purTax)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── Tally Export view ──────────────────────────────────────────────────────

  const TallyView = () => (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">About Tally Export</p>
            <p className="text-sm text-amber-700 mt-1">
              This generates a Tally-compatible XML file containing all completed sales vouchers for the selected period.
              The XML follows the standard Tally TDL import format supported by Tally ERP 9 and Tally Prime.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-4">How to import into Tally</h3>
        <ol className="space-y-3">
          {[
            { step: '1', text: 'Select the date range and click "Export Tally XML" below.' },
            { step: '2', text: 'Open Tally ERP 9 or Tally Prime and select your company.' },
            { step: '3', text: 'Go to Gateway of Tally → Import Data → Vouchers (Tally ERP 9) or Company → Import → Master & Transactions (Tally Prime).' },
            { step: '4', text: 'Browse and select the downloaded XML file.' },
            { step: '5', text: 'Ensure the following ledgers exist in Tally before importing: "Sales Account", "Output CGST X%", "Output SGST X%", "Discount Allowed", and individual customer ledgers (or "Cash").' },
            { step: '6', text: 'After import, verify vouchers in Tally under Day Book.' },
          ].map(item => (
            <li key={item.step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{item.step}</span>
              <p className="text-sm text-gray-700">{item.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Required Tally Ledgers</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { ledger: 'Sales Account', group: 'Sales Accounts', note: 'Main sales credit ledger' },
            { ledger: 'Output CGST 9%', group: 'Duties & Taxes', note: 'For 18% GST items (9% CGST)' },
            { ledger: 'Output SGST 9%', group: 'Duties & Taxes', note: 'For 18% GST items (9% SGST)' },
            { ledger: 'Output CGST 6%', group: 'Duties & Taxes', note: 'For 12% GST items (6% CGST)' },
            { ledger: 'Output SGST 6%', group: 'Duties & Taxes', note: 'For 12% GST items (6% SGST)' },
            { ledger: 'Output CGST 2.5%', group: 'Duties & Taxes', note: 'For 5% GST items (2.5% CGST)' },
            { ledger: 'Discount Allowed', group: 'Indirect Expenses', note: 'For sale discounts (if any)' },
            { ledger: 'Cash', group: 'Cash-in-hand', note: 'For walk-in / cash sales' },
          ].map(item => (
            <div key={item.ledger} className="flex items-start gap-2 border rounded-lg p-2.5">
              <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800 text-xs">{item.ledger}</p>
                <p className="text-[10px] text-gray-500">Group: {item.group}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{item.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => handleExport('tally')}
          disabled={exporting}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 transition-colors"
        >
          <Download size={16} className={exporting ? 'animate-bounce' : ''} />
          {exporting ? 'Generating XML…' : 'Export Tally XML'}
        </button>
        <p className="text-xs text-gray-400">Downloads all completed sales in the selected period as Tally-compatible XML</p>
      </div>
    </div>
  )

  // ── Empty state ────────────────────────────────────────────────────────────

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <FileSpreadsheet size={48} className="text-gray-200 mb-4" />
      <p className="text-gray-500 font-medium">Select a period and click <strong>Generate Report</strong></p>
      <p className="text-gray-400 text-sm mt-1">GST data will be computed from completed sales orders</p>
    </div>
  )

  return (
    <div className="p-6">
      {/* Compact header: title + tabs + period controls in one row */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold text-gray-900 shrink-0">GST Reports</h1>

        <div className="flex gap-1 bg-gray-100 rounded-full p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setData(null) }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                tab === t.key
                  ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <PeriodBar />
        </div>
      </div>

      {/* Tab content */}
      {tab === 'gstr1' && <Gstr1View />}
      {tab === 'gstr3b' && <Gstr3bView />}
      {tab === 'hsn' && <HsnView />}
      {tab === 'tally' && <TallyView />}
    </div>
  )
}
