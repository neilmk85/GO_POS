import { useState, useEffect, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Calendar, ChevronDown, Loader2, Building2, LayoutList } from 'lucide-react'
import { reportApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const PRESETS = [
  { label: 'Last 30d',     from: () => format(subDays(new Date(), 29), 'yyyy-MM-dd'),                                                                to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Month',   from: () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),                            to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Quarter', from: () => { const q = Math.floor(new Date().getMonth()/3)*3; return format(new Date(new Date().getFullYear(), q, 1), 'yyyy-MM-dd') }, to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Year',    from: () => format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),                                                to: () => format(new Date(), 'yyyy-MM-dd') },
]

function dmy(iso: string) { const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }
function fmt(v: any) {
  const n = parseFloat(v ?? 0)
  if (!n) return '—'
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtPlain(v: any) {
  const n = parseFloat(v ?? 0)
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DateRangePicker({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tmpFrom, setTmpFrom] = useState(from)
  const [tmpTo, setTmpTo] = useState(to)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setTmpFrom(from); setTmpTo(to); setOpen(true) }}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-violet-400 transition-colors shadow-sm">
        <Calendar size={14} className="text-violet-500" />
        {dmy(from)} – {dmy(to)}
        <ChevronDown size={13} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-72">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => { const f=p.from(),t=p.to(); setTmpFrom(f);setTmpTo(t);onChange(f,t);setOpen(false) }}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${from===p.from()&&to===p.to() ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-violet-100'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50" />
            <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50" />
          </div>
          <button onClick={() => { onChange(tmpFrom, tmpTo); setOpen(false) }} className="mt-3 w-full py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700">Apply</button>
        </div>
      )}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 border-l-4 ${color}`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TDSReportPage() {
  const navigate = useNavigate()
  const { outletId } = useAuthStore()
  const today = format(new Date(), 'yyyy-MM-dd')
  const yearStart = format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd')

  const [from, setFrom] = useState(yearStart)
  const [to, setTo] = useState(today)
  const [tab, setTab] = useState<'section' | 'party'>('section')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!outletId) return
    setLoading(true)
    reportApi.getTDSReport(outletId, from, to)
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [outletId, from, to])

  const bySection: any[] = data?.bySection ?? []
  const byParty: any[]   = data?.byParty   ?? []
  const totalBase = parseFloat(data?.totalBase ?? 0)
  const totalTDS  = parseFloat(data?.totalTds  ?? 0)

  const STATUS_COLORS: Record<string, string> = {
    'border-l-violet-500': 'border-l-violet-500',
    'border-l-blue-500':   'border-l-blue-500',
    'border-l-orange-500': 'border-l-orange-500',
    'border-l-green-500':  'border-l-green-500',
  }
  void STATUS_COLORS

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* Hero */}
      <div className="relative shadow-[0_8px_40px_rgba(109,40,217,0.25)]">
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>
        <div className="relative px-8 pt-6 pb-5">
          <div className="flex items-center gap-5">
            <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors">
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <FileText size={26} className="text-violet-200" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Reports</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">TDS Report</h1>
              <p className="text-sm text-blue-200 mt-0.5">Tax Deducted at Source — section-wise and party-wise</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-8 py-4 bg-white border-b border-gray-100 flex flex-wrap items-center gap-3">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <div className="ml-auto flex items-center bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setTab('section')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'section' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <LayoutList size={13} /> By Section
          </button>
          <button onClick={() => setTab('party')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'party' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Building2 size={13} /> By Party
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Base Amount" value={`₹ ${fmtPlain(totalBase)}`} color="border-l-violet-500" />
          <StatCard label="Total TDS Deducted" value={`₹ ${fmtPlain(totalTDS)}`} color="border-l-blue-500" />
          <StatCard label="Sections" value={String(bySection.length)} sub="active TDS sections" color="border-l-orange-500" />
          <StatCard label="Parties" value={String(byParty.length)} sub="vendors with TDS" color="border-l-green-500" />
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-20 flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-violet-400" />
            <p className="text-sm text-gray-400">Loading TDS data…</p>
          </div>
        ) : tab === 'section' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Section-wise TDS Summary</p>
              <p className="text-xs text-gray-500">Grouped by Income Tax section — {dmy(from)} to {dmy(to)}</p>
            </div>
            {bySection.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">No TDS deductions in this period</div>
            ) : (
              <table className="w-full text-sm">
                <thead style={{ background: 'linear-gradient(to right,#eff6ff,#eef2ff)', borderBottom: '1px solid #dbeafe' }}>
                  <tr>
                    {['Section','Description','Rate','Transactions','Base Amount','TDS Deducted','Deposited','Pending'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#1f2937', textAlign: ['Base Amount','TDS Deducted','Deposited','Pending','Transactions'].includes(h) ? 'right' : 'left' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bySection.map((s: any) => (
                    <tr key={s.sectionCode} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold">{s.sectionCode}</span>
                      </td>
                      <td className="px-5 py-4 text-gray-700">{s.description}</td>
                      <td className="px-5 py-4 text-gray-600">{parseFloat(s.rate).toFixed(2)}%</td>
                      <td className="px-5 py-4 text-right text-gray-600">{s.transactions}</td>
                      <td className="px-5 py-4 text-right font-medium text-gray-800">{fmt(s.totalBase)}</td>
                      <td className="px-5 py-4 text-right font-semibold text-blue-700">{fmt(s.totalTds)}</td>
                      <td className="px-5 py-4 text-right text-green-600">{fmt(s.deposited)}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={`font-semibold ${parseFloat(s.pending) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {fmt(s.pending)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50/80">
                  <tr>
                    <td colSpan={4} className="px-5 py-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider">Total</td>
                    <td className="px-5 py-3.5 text-right font-bold text-gray-900">{fmt(totalBase)}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-blue-700">{fmt(totalTDS)}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-green-600">
                      {fmt(bySection.reduce((s: number, r: any) => s + parseFloat(r.deposited ?? 0), 0))}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-red-600">
                      {fmt(bySection.reduce((s: number, r: any) => s + parseFloat(r.pending ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Party-wise TDS Summary</p>
              <p className="text-xs text-gray-500">TDS deducted per vendor — {dmy(from)} to {dmy(to)}</p>
            </div>
            {byParty.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">No TDS deductions in this period</div>
            ) : (
              <table className="w-full text-sm">
                <thead style={{ background: 'linear-gradient(to right,#eff6ff,#eef2ff)', borderBottom: '1px solid #dbeafe' }}>
                  <tr>
                    {['#','Vendor','PAN','Section','Transactions','Base Amount','TDS Deducted','Deposited','Pending'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#1f2937', textAlign: ['Base Amount','TDS Deducted','Deposited','Pending','Transactions'].includes(h) ? 'right' : 'left' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {byParty.map((p: any, i: number) => (
                    <tr key={`${p.supplierId}-${p.sectionCode}`} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-4 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-5 py-4 font-medium text-gray-800">{p.supplierName}</td>
                      <td className="px-5 py-4 text-gray-500 font-mono text-xs">{p.pan || '—'}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-xs font-bold">{p.sectionCode}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-gray-600">{p.transactions}</td>
                      <td className="px-5 py-4 text-right font-medium text-gray-800">{fmt(p.totalBase)}</td>
                      <td className="px-5 py-4 text-right font-semibold text-blue-700">{fmt(p.totalTds)}</td>
                      <td className="px-5 py-4 text-right text-green-600">{fmt(p.deposited)}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={`font-semibold ${parseFloat(p.pending) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{fmt(p.pending)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
