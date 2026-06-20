import { useState, useEffect, useRef } from 'react'
import { format, subDays, startOfMonth, startOfQuarter, startOfYear } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList,
} from 'recharts'
import { CheckCircle2, Layers, Package, AlertTriangle, BarChart2, Calendar, ChevronDown, X, Truck, ClipboardList, FileText, ArrowRightCircle, Play } from 'lucide-react'
import { productionOrderApi, salesOrderApi } from '@/services/api'

const PRESETS = [
  { label: 'This Month',   from: () => format(startOfMonth(new Date()), 'yyyy-MM-dd'),   to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Quarter', from: () => format(startOfQuarter(new Date()), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Year',    from: () => format(startOfYear(new Date()), 'yyyy-MM-dd'),    to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 30d',     from: () => format(subDays(new Date(), 29), 'yyyy-MM-dd'),    to: () => format(new Date(), 'yyyy-MM-dd') },
]

const STATUS_COLOR: Record<string, string> = {
  DRAFT:       '#94a3b8',
  PLANNED:     '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  ON_HOLD:     '#f97316',
  COMPLETED:   '#22c55e',
  CANCELLED:   '#ef4444',
}

const STAGE_LABELS: Record<string, string> = {
  fabrication:        'Fabrication',
  fabricationTesting: 'Fab. Testing',
  moulding:           'Moulding',
  spinning:           'Spinning',
  demoulding:         'Demoulding',
  curing1:            'Curing 1',
  winding:            'Winding',
  coating:            'Coating',
  curing2:            'Curing 2',
  finalTesting:       'Final Testing',
}

const STAGE_KEYS = Object.keys(STAGE_LABELS)

function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function CustomRangePicker({ fromDate, toDate, onChange }: {
  fromDate: string; toDate: string; onChange: (f: string, t: string) => void
}) {
  const [open, setOpen]       = useState(false)
  const [tmpFrom, setTmpFrom] = useState(fromDate)
  const [tmpTo,   setTmpTo]   = useState(toDate)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const presetActive = PRESETS.some(p => fromDate === p.from() && toDate === p.to())
  const customActive = !presetActive && !!(fromDate || toDate)

  function openPicker() { setTmpFrom(fromDate); setTmpTo(toDate); setOpen(true) }
  function apply()      { onChange(tmpFrom, tmpTo); setOpen(false) }
  function clear()      { setTmpFrom(''); setTmpTo(''); onChange('', ''); setOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPicker}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
          customActive
            ? 'bg-white text-violet-700 border-white shadow-sm'
            : 'border-white/30 text-white/80 hover:text-white hover:bg-white/10'
        }`}
      >
        <Calendar size={11} />
        {customActive ? `${dmy(fromDate)} – ${dmy(toDate)}` : 'Custom'}
        {customActive
          ? <X size={10} className="ml-0.5 opacity-70 hover:opacity-100" onClick={e => { e.stopPropagation(); clear() }} />
          : <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-64">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Custom Range</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">From</label>
              <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To</label>
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={clear}
              className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Clear
            </button>
            <button onClick={apply} disabled={!tmpFrom && !tmpTo}
              className="flex-1 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 transition-all">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to,   setTo]   = useState(format(new Date(), 'yyyy-MM-dd'))

  const [allStages,    setAllStages]    = useState<any[]>([])
  const [intermediate, setIntermediate] = useState<any[]>([])
  const [summaries,    setSummaries]    = useState<any[]>([])
  const [salesOrders,  setSalesOrders]  = useState<any[]>([])
  const [loading,      setLoading]      = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [stagesRes, interRes, summRes, soRes] = await Promise.all([
        productionOrderApi.getAllStagesStock({ fromDate: from, toDate: to }),
        productionOrderApi.getIntermediateStock({ fromDate: from, toDate: to }),
        productionOrderApi.getSummaries(),
        salesOrderApi.getAll({ size: 1000 }),
      ])
      setAllStages(stagesRes.data.data || [])
      setIntermediate(interRes.data.data || [])
      setSummaries(summRes.data.data || [])
      setSalesOrders(soRes.data.data?.content || soRes.data.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [from, to])

  // ── Derived numbers ──────────────────────────────────────────────────────
  const totalReady      = intermediate.reduce((s: number, r: any) => s + (r.finalTesting ?? 0), 0)
  const totalWIP        = allStages.reduce((s: number, r: any) => s + (r.total ?? 0), 0)
  const activeOrders    = summaries.filter((o: any) => o.status === 'IN_PROGRESS').length
  const onHold          = summaries.filter((o: any) => o.status === 'ON_HOLD').length
  const totalSO         = salesOrders.length
  const soWithPO        = summaries.filter((o: any) => o.salesOrderId != null).length
  const inProgressOrders = activeOrders

  // Stage funnel: sum each stage key across all pipe types
  const stageFunnel = STAGE_KEYS.map(key => ({
    stage: STAGE_LABELS[key],
    pipes: allStages.reduce((s: number, r: any) => s + (r[key] ?? 0), 0),
    key,
  })).filter(s => s.pipes > 0)

  // Order status breakdown
  const statusCounts = summaries.reduce((acc: Record<string, number>, o: any) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})
  const statusDonut = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

  // Dispatch readiness by pipe type (top 10 by finalTesting)
  const readinessByPipe = [...intermediate]
    .filter((r: any) => (r.finalTesting ?? 0) > 0)
    .sort((a: any, b: any) => b.finalTesting - a.finalTesting)
    .slice(0, 10)
    .map((r: any) => ({ name: r.pipeName || `#${r.pipeConfigId}`, ready: r.finalTesting }))

  // WIP breakdown: Curing 1, Curing 2 vs Final Testing
  const wip = intermediate.map((r: any) => ({
    name: r.pipeName || `#${r.pipeConfigId}`,
    'Curing 1': r.curing1 ?? 0,
    'Curing 2': r.curing2 ?? 0,
    'Final Testing': r.finalTesting ?? 0,
  })).filter((r: any) => r['Curing 1'] + r['Curing 2'] + r['Final Testing'] > 0)

  return (
    <div className="p-6 space-y-6">

      {/* ── Hero header ── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.28)]">
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/3 w-72 h-32 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="relative px-8 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <BarChart2 size={26} className="text-violet-200" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Manufacturing</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Production Analytics</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-sm text-blue-200 whitespace-nowrap">Pipeline, readiness &amp; dispatch overview</p>
                <div className="w-px h-4 bg-white/20 shrink-0 hidden sm:block" />
                {PRESETS.map(p => {
                  const pFrom = p.from(), pTo = p.to()
                  const active = from === pFrom && to === pTo
                  return (
                    <button key={p.label} onClick={() => { setFrom(pFrom); setTo(pTo) }}
                      className={`px-3 py-1 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                        active ? 'bg-white text-violet-700 border-white shadow-sm' : 'border-white/30 text-white/80 hover:text-white hover:bg-white/10'
                      }`}>
                      {p.label}
                    </button>
                  )
                })}
                <CustomRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
              </div>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="relative border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/10">
          {loading ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-6 py-4">
              <div className="h-6 bg-white/10 rounded-lg animate-pulse mb-1.5 w-20" />
              <div className="h-3 bg-white/5 rounded w-28 animate-pulse" />
            </div>
          )) : [
            { label: 'Ready for Dispatch', value: totalReady.toLocaleString(),  sub: 'passed final testing', icon: <CheckCircle2 size={15} className="text-emerald-300" /> },
            { label: 'Pipes in Production', value: totalWIP.toLocaleString(),   sub: 'across all stages',    icon: <Layers size={15} className="text-blue-200" /> },
            { label: 'Active Orders',       value: activeOrders,                sub: 'currently in progress',icon: <ClipboardList size={15} className="text-amber-300" /> },
            { label: 'Orders on Hold',      value: onHold,                      sub: 'paused production',    icon: <AlertTriangle size={15} className={onHold > 0 ? 'text-red-300' : 'text-white/40'} /> },
          ].map((s, i) => (
            <div key={i} className="px-6 py-4">
              <div className="flex items-center gap-2 mb-0.5">
                {s.icon}
                <p className={`text-xl font-extrabold tabular-nums leading-none ${i === 3 && onHold > 0 ? 'text-red-300' : 'text-white'}`}>{s.value}</p>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SO / PO conversion strip ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Sales Orders',
            value: loading ? '—' : totalSO.toLocaleString(),
            sub: 'total orders received',
            icon: <FileText size={20} className="text-blue-500" />,
            bg: 'bg-blue-50',
            border: 'border-blue-100',
            val: 'text-blue-700',
          },
          {
            label: 'Converted to Production',
            value: loading ? '—' : soWithPO.toLocaleString(),
            sub: `of ${totalSO} SOs have a production order`,
            icon: <ArrowRightCircle size={20} className="text-violet-500" />,
            bg: 'bg-violet-50',
            border: 'border-violet-100',
            val: 'text-violet-700',
          },
          {
            label: 'In Progress',
            value: loading ? '—' : inProgressOrders.toLocaleString(),
            sub: 'production orders active now',
            icon: <Play size={20} className="text-amber-500" />,
            bg: 'bg-amber-50',
            border: 'border-amber-100',
            val: 'text-amber-700',
          },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl px-6 py-4 flex items-center gap-4`}>
            <div className="flex-shrink-0">{s.icon}</div>
            <div>
              <p className={`text-2xl font-extrabold tabular-nums ${s.val}`}>{s.value}</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Stage pipeline + Order status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Stage-wise pipeline — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border">
          <h2 className="text-base font-bold text-gray-900">Production Stage Pipeline</h2>
          <p className="text-xs text-gray-400 mb-4">Pipes completed at each stage — shows where WIP is concentrated</p>
          {stageFunnel.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-300 text-sm">No production data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stageFunnel} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="stage" type="category" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                  formatter={(v: any) => [`${Number(v).toLocaleString()} pipes`, 'Completed']} />
                <Bar dataKey="pipes" radius={[0, 6, 6, 0]}>
                  {stageFunnel.map((entry, i) => (
                    <Cell key={i} fill={entry.key === 'finalTesting' ? '#22c55e' : entry.key.startsWith('curing') ? '#3b82f6' : '#8b5cf6'} />
                  ))}
                  <LabelList dataKey="pipes" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Order Status funnel — 1/3 width */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h2 className="text-base font-bold text-gray-900">Order Status</h2>
          <p className="text-xs text-gray-400 mb-5">From sales order to active production</p>

          {/* Funnel bars */}
          {[
            { label: 'Sales Orders',          value: totalSO,          color: '#3b82f6', icon: <FileText size={13} className="text-blue-500" />,         sub: 'received' },
            { label: 'Converted to Production', value: soWithPO,       color: '#8b5cf6', icon: <ArrowRightCircle size={13} className="text-violet-500" />, sub: 'have a production order' },
            { label: 'In Progress',            value: inProgressOrders, color: '#f59e0b', icon: <Play size={13} className="text-amber-500" />,              sub: 'currently active' },
          ].map((s, i, arr) => {
            const maxVal = arr[0].value || 1
            const pct = Math.round((s.value / maxVal) * 100)
            return (
              <div key={s.label} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {s.icon}
                    <span className="text-xs font-semibold text-gray-700">{s.label}</span>
                  </div>
                  <span className="text-sm font-extrabold tabular-nums text-gray-900">{loading ? '—' : s.value.toLocaleString()}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: s.color }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{loading ? '' : `${pct}% · ${s.sub}`}</p>
              </div>
            )
          })}

          {/* Divider + status breakdown */}
          <div className="border-t border-gray-100 mt-5 pt-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">By Status</p>
            <div className="space-y-1.5">
              {statusDonut.map(s => (
                <div key={s.status} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[s.status] ?? '#94a3b8' }} />
                    <span className="text-gray-500">{s.status.replace('_', ' ')}</span>
                  </div>
                  <span className="font-bold text-gray-700">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Dispatch readiness + Intermediate WIP ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Dispatch ready by pipe type */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={16} className="text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">Pipes Ready for Dispatch</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">By pipe type — passed Final Testing, awaiting loading</p>
          {readinessByPipe.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-300 text-sm">No pipes at Final Testing stage</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, readinessByPipe.length * 36)}>
              <BarChart data={readinessByPipe} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: any) => [`${v} pipes`, 'Ready']} />
                <Bar dataKey="ready" fill="#22c55e" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="ready" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#15803d' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Intermediate WIP stacked */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <Package size={16} className="text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">WIP by Pipe Type</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">Curing 1, Curing 2 &amp; Final Testing breakdown per pipe</p>
          {wip.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-300 text-sm">No intermediate stock data</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, wip.length * 40)}>
              <BarChart data={wip} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="Curing 1"      stackId="a" fill="#06b6d4" radius={[0,0,0,0]} />
                <Bar dataKey="Curing 2"      stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
                <Bar dataKey="Final Testing" stackId="a" fill="#22c55e" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-4 mt-3">
            {[['Curing 1','#06b6d4'],['Curing 2','#3b82f6'],['Final Testing','#22c55e']].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
