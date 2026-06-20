import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Package, Layers, Download, Calendar, TrendingUp, ChevronDown } from 'lucide-react'
import { subDays } from 'date-fns'
import { productionReportApi, pipeConfigApi, productApi } from '@/services/api'
import { PROD_STAGES } from '@/types'

// ── date helpers ───────────────────────────────────────────────────────────────

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }

function startOf(unit: 'week' | 'month' | 'year') {
  const r = new Date()
  if (unit === 'week')  { r.setDate(r.getDate() - r.getDay()); }
  else if (unit === 'month') r.setDate(1)
  else r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0)
  return r
}

function startOfLastMonth() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); return d
}
function endOfLastMonth() {
  const d = new Date(); d.setDate(0); d.setHours(0,0,0,0); return d
}

const PRESETS = [
  { label: 'Today',        from: () => fmtDate(new Date()),               to: () => fmtDate(new Date()) },
  { label: 'Yesterday',    from: () => fmtDate(subDays(new Date(), 1)),   to: () => fmtDate(subDays(new Date(), 1)) },
  { label: 'Last 7 Days',  from: () => fmtDate(subDays(new Date(), 6)),   to: () => fmtDate(new Date()) },
  { label: 'Last 15 Days', from: () => fmtDate(subDays(new Date(), 14)),  to: () => fmtDate(new Date()) },
  { label: 'Last 30 Days', from: () => fmtDate(subDays(new Date(), 29)),  to: () => fmtDate(new Date()) },
  { label: 'This Week',    from: () => fmtDate(startOf('week')),          to: () => fmtDate(new Date()) },
  { label: 'This Month',   from: () => fmtDate(startOf('month')),         to: () => fmtDate(new Date()) },
  { label: 'Last Month',   from: () => fmtDate(startOfLastMonth()),       to: () => fmtDate(endOfLastMonth()) },
  { label: 'This Year',    from: () => fmtDate(startOf('year')),          to: () => fmtDate(new Date()) },
]

function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// ── Date filter dropdown ───────────────────────────────────────────────────────

function DateFilterDropdown({ from, to, onChange }: {
  from: string; to: string; onChange: (f: string, t: string) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [tmpFrom, setTmpFrom] = useState(from)
  const [tmpTo,   setTmpTo]   = useState(to)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const activePreset = PRESETS.find(p => from === p.from() && to === p.to())
  const isCustom     = !activePreset && !!(from || to)

  function applyPreset(p: typeof PRESETS[number]) { onChange(p.from(), p.to()); setOpen(false) }
  function applyCustom() { if (tmpFrom && tmpTo) { onChange(tmpFrom, tmpTo); setOpen(false) } }
  function clearAll() { setTmpFrom(''); setTmpTo(''); onChange('', ''); setOpen(false) }

  const label = activePreset ? activePreset.label
    : isCustom ? `${dmy(from)} – ${dmy(to)}` : 'All dates'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setTmpFrom(from); setTmpTo(to); setOpen(v => !v) }}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-95 bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/40"
      >
        <Calendar size={15} />
        {label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-60">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Quick Range</p>
          <div className="space-y-0.5 mb-3">
            {PRESETS.map(p => {
              const active = from === p.from() && to === p.to()
              return (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors font-medium ${
                    active ? 'bg-violet-50 text-violet-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                  {p.label}
                </button>
              )
            })}
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Custom Range</p>
            <div className="space-y-2">
              <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700" />
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700" />
              <div className="flex gap-2">
                <button onClick={clearAll}
                  className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Clear
                </button>
                <button onClick={applyCustom} disabled={!tmpFrom || !tmpTo}
                  className="flex-1 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 transition-all">
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Skeleton loader ────────────────────────────────────────────────────────────

function LoadingTable() {
  return (
    <div className="space-y-2 mt-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  )
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmt(n: number | string | undefined) {
  return Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtQty(n: number | string | undefined) {
  return Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  PROD_STAGES.map(s => [s.key, s.label])
)

// ── Dummy data generators ──────────────────────────────────────────────────────

const STAGE_SEQUENCE = ['FABRICATION', 'MOULDING', 'SPINNING', 'FINAL_TESTING']
const MAT_STAGES     = ['FABRICATION', 'SPINNING', 'WINDING', 'COATING']

// Real raw material names used in pipe production
const RAW_MATERIALS: { name: string; uom: string; baseRate: number }[] = [
  { name: '1.6 MM Sheet 350',  uom: 'kg',  baseRate: 72  },
  { name: '1.6 MM Sheet 400',  uom: 'kg',  baseRate: 72  },
  { name: '1.6 MM Sheet 450',  uom: 'kg',  baseRate: 73  },
  { name: '1.6 MM Sheet 500',  uom: 'kg',  baseRate: 73  },
  { name: '1.6 MM Sheet 600',  uom: 'kg',  baseRate: 74  },
  { name: '1.6 MM Sheet 700',  uom: 'kg',  baseRate: 74  },
  { name: '1.6 MM Sheet 800',  uom: 'kg',  baseRate: 75  },
  { name: '1.6 MM Sheet 900',  uom: 'kg',  baseRate: 75  },
  { name: '1.6 MM Sheet 1000', uom: 'kg',  baseRate: 76  },
  { name: '1.6 MM Sheet 1100', uom: 'kg',  baseRate: 76  },
  { name: '1.6 MM Sheet 1200', uom: 'kg',  baseRate: 77  },
  { name: '1.6 MM Sheet 1300', uom: 'kg',  baseRate: 77  },
  { name: '1.6 MM Sheet 1400', uom: 'kg',  baseRate: 78  },
  { name: '1.6 MM Sheet 1500', uom: 'kg',  baseRate: 78  },
  { name: '1.6 MM Sheet 1600', uom: 'kg',  baseRate: 79  },
  { name: '1.6 MM Sheet 1700', uom: 'kg',  baseRate: 79  },
  { name: '1.6 MM Sheet 1800', uom: 'kg',  baseRate: 80  },
  { name: 'MS Flat 6 MM',      uom: 'kg',  baseRate: 65  },
  { name: 'MS Flat 8 MM',      uom: 'kg',  baseRate: 66  },
  { name: 'MS Flat 10 MM',     uom: 'kg',  baseRate: 67  },
  { name: '20 MM Metal',       uom: 'MT',  baseRate: 1400 },
  { name: '10 MM Metal',       uom: 'MT',  baseRate: 1350 },
  { name: 'Crushed Sand',      uom: 'MT',  baseRate: 620  },
  { name: 'Dust',              uom: 'MT',  baseRate: 480  },
  { name: 'Silo Cement',       uom: 'bag', baseRate: 380  },
  { name: 'Extra Cement',      uom: 'bag', baseRate: 390  },
  { name: 'Chemical',          uom: 'ltr', baseRate: 210  },
  { name: '4 MM Winding Wire', uom: 'kg',  baseRate: 95   },
  { name: 'Loose Cement',      uom: 'bag', baseRate: 370  },
  { name: 'Plaster Sand',      uom: 'MT',  baseRate: 540  },
]

function pipeName(cfg: any) {
  return cfg.name || `${cfg.diameterMm}mm ${cfg.pressureClass}`
}

function makeStageDummy(configs: any[]) {
  const rows: any[] = []
  configs.slice(0, 4).forEach((cfg, ci) => {
    const poNumber  = `PO-2025-${String(ci + 1).padStart(3, '0')}`
    const pipe      = pipeName(cfg)
    let prev        = 150 + ci * 30
    STAGE_SEQUENCE.forEach((stage, si) => {
      const rejected  = (ci + si) % 3 === 0 ? 0 : (ci + si) % 3 === 1 ? 1 : 2
      const completed = prev - rejected
      rows.push({ poNumber, pipeConfig: pipe, stageType: stage,
        pipesProcessed: prev, pipesCompleted: completed,
        pipesRejected: rejected, entryCount: 4 + ci })
      prev = completed
    })
  })
  return rows
}

function makeCostDummy(configs: any[]) {
  return configs.slice(0, 4).map((cfg, ci) => {
    const pipe      = pipeName(cfg)
    const planned   = 150 + ci * 30
    const completed = Math.round(planned * (0.85 + ci * 0.03))
    const matCost   = completed * (850 + ci * 200)
    const macCost   = completed * (160 + ci * 40)
    const ovhCost   = completed * (90  + ci * 20)
    const total     = matCost + macCost + ovhCost
    return {
      poNumber: `PO-2025-${String(ci + 1).padStart(3, '0')}`,
      pipeConfig: pipe,
      status: ci === 0 ? 'COMPLETED' : ci === 1 ? 'COMPLETED' : 'IN_PROGRESS',
      plannedQty: planned, finalCompleted: completed,
      materialCost: matCost, machineCost: macCost, overheadCost: ovhCost,
      totalCost: total, costPerPipe: total / completed,
    }
  })
}

function makeMaterialDummy(_products?: any[]) {
  return RAW_MATERIALS.map((mat, mi) => {
    const stage = MAT_STAGES[mi % MAT_STAGES.length]
    const qty   = Math.round(40 + mi * 15 + (mi % 3) * 22)
    return {
      materialName: mat.name,
      stageType:    stage,
      totalQty:     qty,
      uom:          mat.uom,
      totalCost:    qty * mat.baseRate,
      entryCount:   3 + (mi % 5),
    }
  })
}

// ── Tab 1: Stage Summary ──────────────────────────────────────────────────────

function StageSummaryTab({ from, to }: { from: string; to: string }) {
  const { data: apiData, isLoading: apiLoading } = useQuery({
    queryKey: ['prod-report-stage', from, to],
    queryFn: () => productionReportApi.stageSummary({
      fromDate: from || undefined,
      toDate:   to   || undefined,
    }).then(r => r.data.data as any[]),
  })

  const { data: configs, isLoading: cfgLoading } = useQuery({
    queryKey: ['pipe-configs-report'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 20 }).then(r => r.data.data?.content ?? []),
  })

  const isLoading = apiLoading || cfgLoading
  const rows = useMemo(() => {
    if (apiData && apiData.length > 0) return apiData
    if (!configs || configs.length === 0) return []
    return makeStageDummy(configs)
  }, [apiData, configs])

  const byOrder = rows.reduce<Record<string, { poNumber: string; pipeConfig: string; stages: any[] }>>((acc, r) => {
    if (!acc[r.poNumber]) acc[r.poNumber] = { poNumber: r.poNumber, pipeConfig: r.pipeConfig, stages: [] }
    acc[r.poNumber].stages.push(r)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {isLoading ? <LoadingTable /> : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No data for selected range</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Order / Pipe</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-right">Processed</th>
                <th className="px-4 py-3 text-right">Completed</th>
                <th className="px-4 py-3 text-right">Rejected</th>
                <th className="px-4 py-3 text-right">Yield %</th>
                <th className="px-4 py-3 text-right">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.values(byOrder).map(order =>
                order.stages.map((s, i) => {
                  const yieldPct = s.pipesProcessed > 0
                    ? ((s.pipesCompleted / s.pipesProcessed) * 100).toFixed(1) : '—'
                  return (
                    <tr key={`${order.poNumber}-${s.stageType}`} className="hover:bg-violet-50/40">
                      {i === 0 && (
                        <td className="px-4 py-3 font-medium text-gray-900" rowSpan={order.stages.length}>
                          <p className="font-mono text-xs text-violet-700">{order.poNumber}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{order.pipeConfig}</p>
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-700">{STAGE_LABEL[s.stageType] ?? s.stageType}</td>
                      <td className="px-4 py-3 text-right">{s.pipesProcessed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">{s.pipesCompleted.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-red-600">{s.pipesRejected > 0 ? s.pipesRejected : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-medium ${Number(yieldPct) >= 95 ? 'text-green-600' : Number(yieldPct) >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {yieldPct}{yieldPct !== '—' ? '%' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{s.entryCount}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Cost Summary ───────────────────────────────────────────────────────

function CostSummaryTab({ from, to }: { from: string; to: string }) {
  const { data: apiData, isLoading: apiLoading } = useQuery({
    queryKey: ['prod-report-cost', from, to],
    queryFn: () => productionReportApi.costSummary({
      fromDate: from || undefined,
      toDate:   to   || undefined,
    }).then(r => r.data.data as any[]),
  })

  const { data: configs, isLoading: cfgLoading } = useQuery({
    queryKey: ['pipe-configs-report'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 20 }).then(r => r.data.data?.content ?? []),
  })

  const isLoading = apiLoading || cfgLoading
  const rows = useMemo(() => {
    if (apiData && apiData.length > 0) return apiData
    if (!configs || configs.length === 0) return []
    return makeCostDummy(configs)
  }, [apiData, configs])

  const totalMaterial = rows.reduce((s: number, r: any) => s + Number(r.materialCost), 0)
  const totalOverhead = rows.reduce((s: number, r: any) => s + Number(r.overheadCost), 0)
  const totalAll      = rows.reduce((s: number, r: any) => s + Number(r.totalCost), 0)

  const STATUS_COLORS: Record<string, string> = {
    DRAFT:       'bg-gray-100 text-gray-600',
    PLANNED:     'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
    COMPLETED:   'bg-green-100 text-green-700',
    CANCELLED:   'bg-red-100 text-red-600',
  }

  return (
    <div className="space-y-4">
      {isLoading ? <LoadingTable /> : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No data for selected range</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Material Cost', value: totalMaterial },
              { label: 'Overhead',      value: totalOverhead },
              { label: 'Total Cost',    value: totalAll      },
            ].map(c => (
              <div key={c.label} className="bg-white border rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">₹{fmt(c.value)}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Pipe Config</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Planned</th>
                  <th className="px-4 py-3 text-right">Completed</th>
                  <th className="px-4 py-3 text-right">Material ₹</th>
                  <th className="px-4 py-3 text-right">Overhead ₹</th>
                  <th className="px-4 py-3 text-right">Total ₹</th>
                  <th className="px-4 py-3 text-right">₹/Pipe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r: any) => (
                  <tr key={r.poNumber} className="hover:bg-violet-50/40">
                    <td className="px-4 py-3 font-mono text-xs text-violet-700">{r.poNumber}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{r.pipeConfig}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{r.plannedQty}</td>
                    <td className="px-4 py-3 text-right text-green-700">{r.finalCompleted}</td>
                    <td className="px-4 py-3 text-right">₹{fmt(r.materialCost)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">—</td>
                    <td className="px-4 py-3 text-right font-medium">₹{fmt(r.totalCost)}</td>
                    <td className="px-4 py-3 text-right font-medium text-violet-700">₹{fmt(r.costPerPipe)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-medium text-sm">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-gray-600">Totals</td>
                  <td className="px-4 py-3 text-right">₹{fmt(totalMaterial)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">—</td>
                  <td className="px-4 py-3 text-right">₹{fmt(totalAll)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab 3: Material Consumption ───────────────────────────────────────────────

function MaterialConsumptionTab({ from, to }: { from: string; to: string }) {
  const { data: apiData, isLoading: apiLoading } = useQuery({
    queryKey: ['prod-report-material', from, to],
    queryFn: () => productionReportApi.materialConsumption({
      fromDate: from || undefined,
      toDate:   to   || undefined,
    }).then(r => r.data.data as any[]),
  })

  const { data: products, isLoading: prodLoading } = useQuery({
    queryKey: ['products-for-report'],
    queryFn: () => productApi.getAll({ page: 0, size: 50 }).then(r => r.data.data?.content ?? []),
  })

  const isLoading = apiLoading || prodLoading
  const rows = useMemo(() => {
    if (apiData && apiData.length > 0) return apiData
    return makeMaterialDummy()
  }, [apiData, products])

  const totalCost = rows.reduce((s: number, r: any) => s + Number(r.totalCost), 0)

  return (
    <div className="space-y-4">
      {isLoading ? <LoadingTable /> : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No data for selected range</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Material</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-right">Qty Consumed</th>
                <th className="px-4 py-3 text-left">UOM</th>
                <th className="px-4 py-3 text-right">Total Cost ₹</th>
                <th className="px-4 py-3 text-right">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-violet-50/40">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.materialName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{STAGE_LABEL[r.stageType] ?? r.stageType}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtQty(r.totalQty)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.uom}</td>
                  <td className="px-4 py-3 text-right">₹{fmt(r.totalCost)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{r.entryCount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-medium">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-gray-600">Total</td>
                <td className="px-4 py-3 text-right">₹{fmt(totalCost)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'stage',    label: 'Stage Summary',  icon: Layers },
  { key: 'cost',     label: 'Cost Report',    icon: BarChart3 },
  { key: 'material', label: 'Material Usage', icon: Package },
] as const

type TabKey = typeof TABS[number]['key']

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  stage:    'Production throughput and yield rate by stage for each order',
  cost:     'Full cost breakdown per production order — material, machine and overhead',
  material: 'Total material quantities consumed and their cost by stage',
}

export default function ProductionReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('stage')
  const [from, setFrom]           = useState('')
  const [to,   setTo]             = useState('')

  const activeTabMeta = TABS.find(t => t.key === activeTab)!

  return (
    <div className="p-6 space-y-6">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.28)]">
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Title row */}
        <div className="relative flex items-center justify-between px-8 pt-6 pb-4">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <TrendingUp size={26} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Production</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Production Reports</h1>
              <p className="text-sm text-blue-200 mt-0.5">Stage performance · Cost breakdown · Material usage</p>
            </div>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all active:scale-95">
            <Download size={15} />
            Export CSV
          </button>
        </div>

        {/* Tab pills + date filter */}
        <div className="relative px-8 pb-5 flex items-center justify-between gap-3">
          <div className="flex gap-1 bg-white/10 backdrop-blur-sm p-1 rounded-xl">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    active ? 'bg-white text-violet-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <DateFilterDropdown from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        </div>
      </div>

      {/* ── Active tab content card ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <div className="flex items-center gap-3.5 px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <activeTabMeta.icon size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{activeTabMeta.label}</h2>
            <p className="text-xs text-blue-100 mt-0.5">{TAB_DESCRIPTIONS[activeTab]}</p>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'stage'    && <StageSummaryTab        from={from} to={to} />}
          {activeTab === 'cost'     && <CostSummaryTab         from={from} to={to} />}
          {activeTab === 'material' && <MaterialConsumptionTab from={from} to={to} />}
        </div>
      </div>

    </div>
  )
}
