import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, Layers } from 'lucide-react'
import { productionEntryApi } from '@/services/api'
import { ProductionEntry, PROD_STAGES, BED_TYPES } from '@/types'

function fmt(n: number | string | undefined) {
  return Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

function fmtCost(n: number | string | undefined) {
  return Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ProductionEntryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['production-entry', id],
    queryFn: () => productionEntryApi.getById(Number(id)).then(r => r.data.data as ProductionEntry),
  })

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  const entry = data
  if (!entry) return <div className="p-6 text-gray-500">Entry not found.</div>

  const stageLabel = PROD_STAGES.find(s => s.key === entry.stageType)?.label ?? entry.stageType
  const hasMaterials = (entry.consumptions?.length ?? 0) > 0
  const totalMaterialCost = (entry.consumptions ?? []).reduce((s, c) => s + Number(c.totalCost), 0)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Entry #{entry.id}</h1>
            <span className="text-xs font-medium bg-violet-50 text-violet-700 px-2 py-0.5 rounded">
              {stageLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <Link
              to={`/production/orders/${entry.productionOrderId}`}
              className="font-mono text-violet-600 hover:underline"
            >
              {entry.productionOrder?.poNumber ?? `Order #${entry.productionOrderId}`}
            </Link>
            <span>·</span>
            <span>{entry.pipeConfig?.name ?? `Config #${entry.pipeConfigId}`}</span>
          </div>
        </div>
      </div>

      {/* Entry details card */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={16} className="text-violet-600" />
          <h2 className="font-semibold text-gray-800">Entry Details</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Pipes Processed</p>
            <p className="text-xl font-bold text-gray-900">{entry.pipesProcessed}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Pipes Completed</p>
            <p className="text-xl font-bold text-green-700">{entry.pipesCompleted}</p>
          </div>
          <div className={`rounded-lg p-3 ${entry.pipesRejected > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500">Pipes Rejected</p>
            <p className={`text-xl font-bold ${entry.pipesRejected > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {entry.pipesRejected || 0}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Yield</p>
            <p className="text-xl font-bold text-gray-900">
              {entry.pipesProcessed > 0
                ? `${((entry.pipesCompleted / entry.pipesProcessed) * 100).toFixed(1)}%`
                : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">Entry Date</p>
            <p className="font-medium text-gray-900 mt-0.5">
              {new Date(entry.entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {entry.shiftName && (
            <div>
              <p className="text-xs text-gray-500">Shift</p>
              <p className="font-medium text-gray-900 mt-0.5">Shift {entry.shiftName}</p>
            </div>
          )}
          {(entry.stageType === 'DEMOULDING' || entry.stageType === 'SPINNING') && (
            <div>
              <p className="text-xs text-gray-500">
                Bed Type{entry.stageType === 'SPINNING' ? ' (optional)' : ''}
              </p>
              {entry.bedType ? (
                <span className={`inline-block mt-0.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  entry.stageType === 'DEMOULDING'
                    ? 'bg-teal-50 text-teal-700'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {BED_TYPES.find(b => b.key === entry.bedType)?.label ?? entry.bedType}
                </span>
              ) : (
                <p className="font-medium text-gray-400 mt-0.5 text-sm">—</p>
              )}
            </div>
          )}
          {entry.machineId && (
            <div>
              <p className="text-xs text-gray-500">Machine ID</p>
              <p className="font-medium text-gray-900 mt-0.5">#{entry.machineId}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500">Recorded</p>
            <p className="font-medium text-gray-900 mt-0.5">
              {new Date(entry.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {entry.notes && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs text-amber-700 font-medium mb-1">Notes</p>
            <p className="text-sm text-amber-900">{entry.notes}</p>
          </div>
        )}
      </div>

      {/* Material consumptions */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-violet-600" />
            <h2 className="font-semibold text-gray-800">Material Consumptions</h2>
          </div>
          {hasMaterials && (
            <span className="text-xs text-gray-500">
              Total cost: <span className="font-semibold text-gray-900">₹{fmtCost(totalMaterialCost)}</span>
            </span>
          )}
        </div>

        {!hasMaterials ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            No materials consumed in this stage
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="text-left px-4 py-3">Material</th>
                <th className="text-right px-4 py-3">Qty Consumed</th>
                <th className="text-left px-4 py-3">UOM</th>
                <th className="text-right px-4 py-3">Unit Cost ₹</th>
                <th className="text-right px-4 py-3">Total Cost ₹</th>
              </tr>
            </thead>
            <tbody>
              {entry.consumptions!.map(c => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-violet-50/40">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.materialProduct?.name ?? `Product #${c.materialProductId}`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(c.consumedQty)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.uom}</td>
                  <td className="px-4 py-3 text-right text-gray-600">₹{fmtCost(c.unitCost)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">₹{fmtCost(c.totalCost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Total Material Cost</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">₹{fmtCost(totalMaterialCost)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
