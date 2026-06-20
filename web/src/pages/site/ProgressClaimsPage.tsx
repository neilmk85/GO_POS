import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ClipboardCheck,
  X,
  ChevronRight,
} from 'lucide-react'
import { progressClaimApi, workOrderApi } from '@/services/api'

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-700',
    icon: <Clock size={12} />,
  },
  VERIFIED: {
    label: 'Verified',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle size={12} />,
  },
  DISPUTED: {
    label: 'Disputed',
    color: 'bg-red-100 text-red-700',
    icon: <AlertCircle size={12} />,
  },
}

interface ClaimItem {
  id?: number
  description: string
  unit: string
  contractedQty: string
  previousCumulativeQty: string
  claimedQty: string
  verifiedQty: string
  remark?: string
}

interface ProgressClaim {
  id: number
  workOrderId: number
  woNumber: string
  claimDate: string
  status: string
  verifiedBy?: string
  verifiedAt?: string
  notes?: string
  items: ClaimItem[]
  workOrder?: { title: string; contractorName: string }
}

const UNITS = ['m', 'm²', 'm³', 'LS', 'Nos', 'RMT', 'MT', 'KG']

// ─── Create / Edit Panel ──────────────────────────────────────────────────────
function ClaimPanel({
  editing,
  onClose,
}: {
  editing: ProgressClaim | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const { data: workOrdersData } = useQuery({
    queryKey: ['site-work-orders-list'],
    queryFn: () => workOrderApi.getAll(),
  })
  const workOrders: any[] = workOrdersData?.data?.data ?? []

  const today = new Date().toISOString().slice(0, 10)

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: editing
      ? {
          workOrderId: String(editing.workOrderId),
          claimDate: editing.claimDate,
          notes: editing.notes ?? '',
          items: editing.items.map((i) => ({
            id: i.id ?? 0,
            description: i.description,
            unit: i.unit,
            contractedQty: String(i.contractedQty),
            previousCumulativeQty: String(i.previousCumulativeQty),
            claimedQty: String(i.claimedQty),
            verifiedQty: String(i.verifiedQty),
            remark: i.remark ?? '',
          })),
        }
      : {
          workOrderId: '',
          claimDate: today,
          notes: '',
          items: [
            { id: 0, description: '', unit: 'LS', contractedQty: '0', previousCumulativeQty: '0', claimedQty: '0', verifiedQty: '0', remark: '' },
          ],
        },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const selectedWOId = watch('workOrderId')
  const selectedWO = workOrders.find((w) => String(w.id) === selectedWOId)

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        workOrderId: Number(data.workOrderId),
        woNumber: selectedWO?.woNumber ?? '',
      }
      return editing
        ? progressClaimApi.update(editing.id, payload)
        : progressClaimApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-progress-claims'] })
      toast.success(editing ? 'Claim updated' : 'Claim created')
      onClose()
    },
    onError: () => toast.error('Failed to save claim'),
  })

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? 'Edit Progress Claim' : 'New Progress Claim'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Work Order + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Work Order</label>
              <div className="relative">
                <select
                  {...register('workOrderId', { required: true })}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select work order…</option>
                  {workOrders.map((w) => (
                    <option key={w.id} value={w.id}>{w.woNumber} — {w.title}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {selectedWO && (
                <p className="text-xs text-gray-500 mt-1">Contractor: {selectedWO.contractorName}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Claim Date</label>
              <input
                {...register('claimDate', { required: true })}
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">Claim Items</label>
              <button
                type="button"
                onClick={() =>
                  append({ id: 0, description: '', unit: 'LS', contractedQty: '0', previousCumulativeQty: '0', claimedQty: '0', verifiedQty: '0', remark: '' })
                }
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
              >
                <Plus size={12} /> Add item
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 w-[30%]">Description</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 w-[8%]">Unit</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 w-[12%]">Contracted</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 w-[12%]">Prev. Cumul.</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 w-[12%]">Claimed</th>
                    <th className="px-2 py-2 w-[8%]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fields.map((field, idx) => (
                    <tr key={field.id}>
                      <td className="px-3 py-2">
                        <input
                          {...register(`items.${idx}.description`)}
                          placeholder="Work description"
                          className="w-full border-0 outline-none text-xs bg-transparent text-gray-900 placeholder-gray-400"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          {...register(`items.${idx}.unit`)}
                          className="w-full border-0 outline-none text-xs bg-transparent text-gray-700"
                        >
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          {...register(`items.${idx}.contractedQty`)}
                          type="number" step="0.001" min="0"
                          className="w-full border-0 outline-none text-xs bg-transparent text-right text-gray-900"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          {...register(`items.${idx}.previousCumulativeQty`)}
                          type="number" step="0.001" min="0"
                          className="w-full border-0 outline-none text-xs bg-transparent text-right text-gray-900"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          {...register(`items.${idx}.claimedQty`)}
                          type="number" step="0.001" min="0"
                          className="w-full border-0 outline-none text-xs bg-transparent text-right font-medium text-indigo-700"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(idx)}
                            className="text-gray-300 hover:text-red-500"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Optional notes"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </form>

        <div className="px-5 py-4 border-t flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit((d) => saveMutation.mutate(d))}
            disabled={saveMutation.isPending}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Submit Claim'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Verify Panel ─────────────────────────────────────────────────────────────
function VerifyPanel({
  claim,
  onClose,
}: {
  claim: ProgressClaim
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const { register, control, handleSubmit } = useForm({
    defaultValues: {
      verifiedBy: '',
      status: 'VERIFIED',
      items: claim.items.map((i) => ({
        id: i.id ?? 0,
        verifiedQty: String(i.claimedQty),
        remark: i.remark ?? '',
      })),
    },
  })

  const { fields } = useFieldArray({ control, name: 'items' })

  const verifyMutation = useMutation({
    mutationFn: (data: any) =>
      progressClaimApi.verify(claim.id, {
        status: data.status,
        verifiedBy: data.verifiedBy,
        items: data.items.map((item: any) => ({
          id: item.id,
          verifiedQty: item.verifiedQty,
          remark: item.remark || undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-progress-claims'] })
      toast.success('Claim verified')
      onClose()
    },
    onError: () => toast.error('Failed to verify'),
  })

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Verify Progress Claim</h2>
            <p className="text-xs text-gray-500 mt-0.5">{claim.woNumber} · {claim.claimDate}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Verified by */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Verified By (Engineer)</label>
            <input
              {...register('verifiedBy')}
              placeholder="Engineer name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Outcome</label>
            <div className="flex gap-4">
              {['VERIFIED', 'DISPUTED'].map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value={s} {...register('status')} className="accent-indigo-600" />
                  <span className="text-sm text-gray-700">{s === 'VERIFIED' ? 'Accept & Verify' : 'Dispute'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Item-wise Verification</label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500">Claimed</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 text-green-700">Verified</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {claim.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-gray-900">
                        {item.description}
                        <span className="ml-1 text-gray-400">({item.unit})</span>
                      </td>
                      <td className="px-2 py-2 text-right text-gray-700">{item.claimedQty}</td>
                      <td className="px-2 py-2">
                        <input
                          {...register(`items.${idx}.verifiedQty`)}
                          type="number" step="0.001" min="0"
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right font-medium text-green-700 focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          {...register(`items.${idx}.remark`)}
                          placeholder="Optional remark"
                          className="w-full border-0 outline-none text-xs bg-transparent text-gray-600 placeholder-gray-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </form>

        <div className="px-5 py-4 border-t flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit((d) => verifyMutation.mutate(d))}
            disabled={verifyMutation.isPending}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
          >
            {verifyMutation.isPending ? 'Saving…' : 'Submit Verification'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Claim Row ────────────────────────────────────────────────────────────────
function ClaimRow({
  claim,
  onEdit,
  onVerify,
  onDelete,
}: {
  claim: ProgressClaim
  onEdit: (c: ProgressClaim) => void
  onVerify: (c: ProgressClaim) => void
  onDelete: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = STATUS_META[claim.status] ?? STATUS_META.PENDING

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-600"
          >
            <ChevronRight
              size={14}
              className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{claim.claimDate}</td>
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-gray-900">{claim.woNumber}</div>
          {claim.workOrder && (
            <div className="text-xs text-gray-400">{claim.workOrder.contractorName}</div>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{claim.items.length} items</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
            {meta.icon}
            {meta.label}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-400">{claim.verifiedBy ?? '—'}</td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {claim.status === 'PENDING' && (
              <button
                onClick={() => onVerify(claim)}
                className="px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors"
              >
                Verify
              </button>
            )}
            <button onClick={() => onEdit(claim)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(claim.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      {expanded && claim.items.length > 0 && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-6 pb-3 pt-0">
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Description</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Contracted</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Prev. Cumul.</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Claimed</th>
                  <th className="px-3 py-2 text-right text-green-600 font-medium">Verified</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claim.items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-gray-800">{item.description} <span className="text-gray-400">({item.unit})</span></td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{item.contractedQty}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{item.previousCumulativeQty}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-indigo-700">{item.claimedQty}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-green-700">{item.verifiedQty}</td>
                    <td className="px-3 py-1.5 text-gray-500">{item.remark ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProgressClaimsPage() {
  const queryClient = useQueryClient()
  const [panelOpen, setPanelOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [editing, setEditing] = useState<ProgressClaim | null>(null)
  const [verifying, setVerifying] = useState<ProgressClaim | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterWO, setFilterWO] = useState('')

  const { data: workOrdersData } = useQuery({
    queryKey: ['site-work-orders-list'],
    queryFn: () => workOrderApi.getAll(),
  })

  const params: any = {}
  if (filterWO) params.workOrderId = Number(filterWO)
  if (filterStatus) params.status = filterStatus

  const { data, isLoading } = useQuery({
    queryKey: ['site-progress-claims', filterWO, filterStatus],
    queryFn: () => progressClaimApi.getAll(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => progressClaimApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-progress-claims'] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const workOrders: any[] = workOrdersData?.data?.data ?? []
  const claims: ProgressClaim[] = data?.data?.data ?? []

  const pendingCount = claims.filter((c) => c.status === 'PENDING').length
  const verifiedCount = claims.filter((c) => c.status === 'VERIFIED').length
  const disputedCount = claims.filter((c) => c.status === 'DISPUTED').length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-700 flex items-center justify-center">
            <ClipboardCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Progress Claims</h1>
            <p className="text-sm text-gray-500">Contractor progress claims and engineer verification</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setPanelOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          New Claim
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 flex items-center gap-2">
          <Clock size={14} className="text-yellow-600" />
          <span className="text-sm text-yellow-700 font-medium">{pendingCount} Pending</span>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
          <CheckCircle size={14} className="text-green-600" />
          <span className="text-sm text-green-700 font-medium">{verifiedCount} Verified</span>
        </div>
        {disputedCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center gap-2">
            <AlertCircle size={14} className="text-red-600" />
            <span className="text-sm text-red-700 font-medium">{disputedCount} Disputed</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative">
          <select
            value={filterWO}
            onChange={(e) => setFilterWO(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Work Orders</option>
            {workOrders.map((w) => (
              <option key={w.id} value={w.id}>{w.woNumber}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="DISPUTED">Disputed</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : claims.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ClipboardCheck size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No progress claims yet.</p>
            <button
              onClick={() => { setEditing(null); setPanelOpen(true) }}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              + Submit first claim
            </button>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Work Order</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Items</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Verified By</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  onEdit={(c) => { setEditing(c); setPanelOpen(true) }}
                  onVerify={(c) => { setVerifying(c); setVerifyOpen(true) }}
                  onDelete={(id) => {
                    if (window.confirm('Delete this progress claim?')) deleteMutation.mutate(id)
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {panelOpen && (
        <ClaimPanel editing={editing} onClose={() => { setPanelOpen(false); setEditing(null) }} />
      )}
      {verifyOpen && verifying && (
        <VerifyPanel claim={verifying} onClose={() => { setVerifyOpen(false); setVerifying(null) }} />
      )}
    </div>
  )
}
