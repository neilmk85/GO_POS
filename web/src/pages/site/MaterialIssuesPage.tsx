import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Truck, ChevronDown, Building2, Hammer } from 'lucide-react'
import { materialIssueApi, siteProjectApi, contractorApi } from '@/services/api'

const UNITS = ['Nos', 'm', 'm²', 'm³', 'RMT', 'MT', 'KG', 'Bags', 'Litres', 'LS']

const issueSchema = z.object({
  siteProjectId: z.string().min(1, 'Project is required'),
  workOrderId: z.string().optional(),
  issuedTo: z.enum(['SUBCONTRACTOR', 'INHOUSE']),
  contractorId: z.string().optional(),
  contractorName: z.string().optional(),
  materialName: z.string().min(1, 'Material name is required'),
  specification: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  qty: z.string().min(1, 'Qty is required'),
  issueDate: z.string().min(1, 'Issue date is required'),
  issuedBy: z.string().optional(),
  vehicleNo: z.string().optional(),
  notes: z.string().optional(),
})

type IssueFormData = z.infer<typeof issueSchema>

interface MaterialIssue {
  id: number
  siteProjectId: number
  workOrderId?: number
  issuedTo: 'SUBCONTRACTOR' | 'INHOUSE'
  contractorId?: number
  contractorName?: string
  materialName: string
  specification?: string
  unit: string
  qty: string
  issueDate: string
  issuedBy?: string
  vehicleNo?: string
  notes?: string
}

const ISSUED_TO_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  SUBCONTRACTOR: {
    label: 'Subcontractor',
    color: 'bg-orange-100 text-orange-700',
    icon: <Building2 size={12} />,
  },
  INHOUSE: {
    label: 'Inhouse',
    color: 'bg-indigo-100 text-indigo-700',
    icon: <Hammer size={12} />,
  },
}

function IssuePanel({
  editing,
  onClose,
}: {
  editing: MaterialIssue | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll({ status: 'ACTIVE' }),
  })
  const { data: contractorsData } = useQuery({
    queryKey: ['site-contractors'],
    queryFn: () => contractorApi.getAll({ active: true }),
  })

  const projects: any[] = projectsData?.data?.data ?? []
  const contractors: any[] = contractorsData?.data?.data ?? []

  const today = new Date().toISOString().slice(0, 10)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
    defaultValues: editing
      ? {
          siteProjectId: String(editing.siteProjectId),
          workOrderId: editing.workOrderId ? String(editing.workOrderId) : '',
          issuedTo: editing.issuedTo,
          contractorId: editing.contractorId ? String(editing.contractorId) : '',
          contractorName: editing.contractorName ?? '',
          materialName: editing.materialName,
          specification: editing.specification ?? '',
          unit: editing.unit,
          qty: String(editing.qty),
          issueDate: editing.issueDate,
          issuedBy: editing.issuedBy ?? '',
          vehicleNo: editing.vehicleNo ?? '',
          notes: editing.notes ?? '',
        }
      : {
          issuedTo: 'SUBCONTRACTOR',
          unit: 'Nos',
          qty: '1',
          issueDate: today,
        },
  })

  const issuedTo = watch('issuedTo')
  const selectedContractorId = watch('contractorId')

  // Auto-fill contractor name when contractor is selected
  const handleContractorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setValue('contractorId', id)
    const c = contractors.find((c) => String(c.id) === id)
    if (c) setValue('contractorName', c.name)
  }

  const saveMutation = useMutation({
    mutationFn: (data: IssueFormData) => {
      const payload = {
        ...data,
        siteProjectId: Number(data.siteProjectId),
        workOrderId: data.workOrderId ? Number(data.workOrderId) : undefined,
        contractorId: data.contractorId ? Number(data.contractorId) : undefined,
      }
      return editing
        ? materialIssueApi.update(editing.id, payload)
        : materialIssueApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-material-issues'] })
      toast.success(editing ? 'Material issue updated' : 'Material issue recorded')
      onClose()
    },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? 'Edit Material Issue' : 'Record Material Issue'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form
          onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {/* Project */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
            <div className="relative">
              <select
                {...register('siteProjectId')}
                className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {errors.siteProjectId && <p className="text-xs text-red-500 mt-1">{errors.siteProjectId.message}</p>}
          </div>

          {/* Issued To */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Issued To</label>
            <div className="flex gap-4">
              {(['SUBCONTRACTOR', 'INHOUSE'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value={t} {...register('issuedTo')} className="accent-indigo-600" />
                  <span className="text-sm text-gray-700">
                    {t === 'SUBCONTRACTOR' ? 'Subcontractor' : 'Inhouse'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Contractor (only if SUBCONTRACTOR) */}
          {issuedTo === 'SUBCONTRACTOR' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contractor</label>
              <div className="relative">
                <select
                  value={selectedContractorId ?? ''}
                  onChange={handleContractorChange}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select contractor…</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Material Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Material Name</label>
            <input
              {...register('materialName')}
              placeholder="e.g. PSC Pipe 600mm dia"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.materialName && <p className="text-xs text-red-500 mt-1">{errors.materialName.message}</p>}
          </div>

          {/* Specification */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Specification</label>
            <input
              {...register('specification')}
              placeholder="e.g. IS 784, Class NP3"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Qty + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
              <input
                {...register('qty')}
                type="number"
                step="0.001"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.qty && <p className="text-xs text-red-500 mt-1">{errors.qty.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
              <div className="relative">
                <select
                  {...register('unit')}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Issue Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Issue Date</label>
            <input
              {...register('issueDate')}
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.issueDate && <p className="text-xs text-red-500 mt-1">{errors.issueDate.message}</p>}
          </div>

          {/* Issued By + Vehicle No */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Issued By</label>
              <input
                {...register('issuedBy')}
                placeholder="Engineer name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle No.</label>
              <input
                {...register('vehicleNo')}
                placeholder="e.g. GJ 01 AB 1234"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Optional remarks"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </form>

        <div className="px-5 py-4 border-t flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit((d) => saveMutation.mutate(d))}
            disabled={saveMutation.isPending}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Record Issue'}
          </button>
        </div>
      </div>
    </div>
  )
}

function IssueRow({
  issue,
  onEdit,
  onDelete,
}: {
  issue: MaterialIssue
  onEdit: (i: MaterialIssue) => void
  onDelete: (id: number) => void
}) {
  const badge = ISSUED_TO_LABELS[issue.issuedTo]

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{issue.issueDate}</td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{issue.materialName}</div>
        {issue.specification && (
          <div className="text-xs text-gray-400">{issue.specification}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
        {issue.qty} {issue.unit}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${badge?.color}`}>
          {badge?.icon}
          {issue.issuedTo === 'SUBCONTRACTOR' ? (issue.contractorName ?? 'Subcontractor') : 'Inhouse'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{issue.vehicleNo ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{issue.issuedBy ?? '—'}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(issue)}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(issue.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function MaterialIssuesPage() {
  const queryClient = useQueryClient()
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialIssue | null>(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterIssuedTo, setFilterIssuedTo] = useState('')

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll(),
  })

  const params: any = {}
  if (filterProject) params.siteProjectId = Number(filterProject)
  if (filterIssuedTo) params.issuedTo = filterIssuedTo

  const { data, isLoading } = useQuery({
    queryKey: ['site-material-issues', filterProject, filterIssuedTo],
    queryFn: () => materialIssueApi.getAll(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => materialIssueApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-material-issues'] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const projects: any[] = projectsData?.data?.data ?? []
  const issues: MaterialIssue[] = data?.data?.data ?? []

  const handleDelete = (id: number) => {
    if (window.confirm('Delete this material issue entry?')) deleteMutation.mutate(id)
  }

  const handleEdit = (issue: MaterialIssue) => {
    setEditing(issue)
    setPanelOpen(true)
  }

  const openNew = () => {
    setEditing(null)
    setPanelOpen(true)
  }

  const closePanel = () => {
    setPanelOpen(false)
    setEditing(null)
  }

  // Summary counts
  const subCount = issues.filter((i) => i.issuedTo === 'SUBCONTRACTOR').length
  const inhouseCount = issues.filter((i) => i.issuedTo === 'INHOUSE').length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center">
            <Truck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Material Issues</h1>
            <p className="text-sm text-gray-500">Track materials issued to contractors and inhouse teams</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Record Issue
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 mb-5">
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 flex items-center gap-2">
          <Building2 size={14} className="text-orange-600" />
          <span className="text-sm text-orange-700 font-medium">{subCount} to Subcontractors</span>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-center gap-2">
          <Hammer size={14} className="text-indigo-600" />
          <span className="text-sm text-indigo-700 font-medium">{inhouseCount} Inhouse</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filterIssuedTo}
            onChange={(e) => setFilterIssuedTo(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            <option value="SUBCONTRACTOR">Subcontractor</option>
            <option value="INHOUSE">Inhouse</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : issues.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Truck size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No material issues recorded yet.</p>
            <button onClick={openNew} className="mt-2 text-sm text-indigo-600 hover:underline">
              + Record first issue
            </button>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Material</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Qty</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Issued To</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">By</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {issues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {panelOpen && <IssuePanel editing={editing} onClose={closePanel} />}
    </div>
  )
}
