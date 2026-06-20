import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Plus,
  Building2,
  Hammer,
  Pencil,
  Trash2,
  ChevronDown,
  MapPin,
  Package,
} from 'lucide-react'
import { siteProjectApi, workPackageApi } from '@/services/api'

const PHASES = [
  'EXCAVATION',
  'CONCRETE',
  'PSC_PCCP',
  'HDPE',
  'MS_SPECIALS',
  'WUA',
  'TESTING',
  'OTHER',
]

const UNITS = ['m', 'm²', 'm³', 'LS', 'Nos', 'RMT', 'MT', 'KG']

const STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']

const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
}

const packageSchema = z.object({
  phase: z.string().min(1, 'Phase is required'),
  description: z.string().min(1, 'Description is required'),
  location: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  plannedQty: z.string().min(1, 'Planned qty is required'),
  executionType: z.enum(['INHOUSE', 'SUBCONTRACTED']),
  status: z.string().min(1, 'Status is required'),
  notes: z.string().optional(),
})

type PackageFormData = z.infer<typeof packageSchema>

interface WorkPackage {
  id: number
  siteProjectId: number
  phase: string
  description: string
  location?: string
  unit: string
  plannedQty: string
  executionType: 'INHOUSE' | 'SUBCONTRACTED'
  status: string
  notes?: string
}

function PackageCard({
  pkg,
  onEdit,
  onDelete,
}: {
  pkg: WorkPackage
  onEdit: (p: WorkPackage) => void
  onDelete: (id: number) => void
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
              {pkg.phase}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[pkg.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {pkg.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">{pkg.description}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Package size={12} />
              {pkg.plannedQty} {pkg.unit}
            </span>
            {pkg.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {pkg.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(pkg)}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(pkg.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function PackagePanel({
  projectId,
  editingPackage,
  defaultExecutionType,
  onClose,
}: {
  projectId: number
  editingPackage: WorkPackage | null
  defaultExecutionType: 'INHOUSE' | 'SUBCONTRACTED'
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    defaultValues: editingPackage
      ? {
          phase: editingPackage.phase,
          description: editingPackage.description,
          location: editingPackage.location ?? '',
          unit: editingPackage.unit,
          plannedQty: String(editingPackage.plannedQty),
          executionType: editingPackage.executionType,
          status: editingPackage.status,
          notes: editingPackage.notes ?? '',
        }
      : {
          phase: 'EXCAVATION',
          unit: 'LS',
          plannedQty: '1',
          executionType: defaultExecutionType,
          status: 'PLANNED',
        },
  })

  const saveMutation = useMutation({
    mutationFn: (data: PackageFormData) => {
      const payload = { ...data, siteProjectId: projectId }
      return editingPackage
        ? workPackageApi.update(editingPackage.id, payload)
        : workPackageApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-work-packages', projectId] })
      toast.success(editingPackage ? 'Work package updated' : 'Work package created')
      reset()
      onClose()
    },
    onError: () => toast.error('Failed to save work package'),
  })

  const onSubmit = (data: PackageFormData) => saveMutation.mutate(data)

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">
            {editingPackage ? 'Edit Work Package' : 'New Work Package'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Execution Type</label>
            <div className="flex gap-3">
              {(['INHOUSE', 'SUBCONTRACTED'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value={t} {...register('executionType')} className="accent-indigo-600" />
                  <span className="text-sm text-gray-700">{t === 'INHOUSE' ? 'Inhouse' : 'Subcontracted'}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phase</label>
            <div className="relative">
              <select
                {...register('phase')}
                className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PHASES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {errors.phase && <p className="text-xs text-red-500 mt-1">{errors.phase.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="e.g. RCC pipe laying from Ch. 0+000 to Ch. 0+500"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Location / Chainage</label>
            <input
              {...register('location')}
              placeholder="e.g. Ch. 0+000 to 0+500"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Planned Qty</label>
              <input
                {...register('plannedQty')}
                type="number"
                step="0.001"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.plannedQty && <p className="text-xs text-red-500 mt-1">{errors.plannedQty.message}</p>}
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

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <div className="relative">
              <select
                {...register('status')}
                className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

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
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={saveMutation.isPending}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving…' : editingPackage ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const projectId = Number(id)

  const [activeTab, setActiveTab] = useState<'INHOUSE' | 'SUBCONTRACTED'>('INHOUSE')
  const [phaseFilter, setPhaseFilter] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<WorkPackage | null>(null)

  const { data: projectData } = useQuery({
    queryKey: ['site-project', projectId],
    queryFn: () => siteProjectApi.getById(projectId),
    enabled: !!projectId,
  })

  const { data: packagesData, isLoading } = useQuery({
    queryKey: ['site-work-packages', projectId],
    queryFn: () => workPackageApi.getByProject(projectId),
    enabled: !!projectId,
  })

  const deleteMutation = useMutation({
    mutationFn: (pkgId: number) => workPackageApi.delete(pkgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-work-packages', projectId] })
      toast.success('Work package deleted')
    },
    onError: () => toast.error('Failed to delete work package'),
  })

  const project = projectData?.data?.data
  const allPackages: WorkPackage[] = packagesData?.data?.data ?? []

  const filtered = allPackages.filter(
    (p) =>
      p.executionType === activeTab &&
      (phaseFilter === '' || p.phase === phaseFilter),
  )

  const inhouseCount = allPackages.filter((p) => p.executionType === 'INHOUSE').length
  const subcontractedCount = allPackages.filter((p) => p.executionType === 'SUBCONTRACTED').length

  const handleEdit = (pkg: WorkPackage) => {
    setEditingPackage(pkg)
    setPanelOpen(true)
  }

  const handleDelete = (pkgId: number) => {
    if (window.confirm('Delete this work package?')) {
      deleteMutation.mutate(pkgId)
    }
  }

  const openNew = () => {
    setEditingPackage(null)
    setPanelOpen(true)
  }

  const closePanel = () => {
    setPanelOpen(false)
    setEditingPackage(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/site/projects')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {project?.name ?? 'Loading…'}
          </h1>
          {project && (
            <p className="text-sm text-gray-500 mt-0.5">
              {project.clientName} · {project.location}
            </p>
          )}
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add Work Package
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('INHOUSE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'INHOUSE'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Hammer size={14} />
          Inhouse
          <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
            {inhouseCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('SUBCONTRACTED')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'SUBCONTRACTED'
              ? 'bg-white text-orange-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Building2 size={14} />
          Subcontracted
          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
            {subcontractedCount}
          </span>
        </button>
      </div>

      {/* Phase filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Phase:</span>
        <button
          onClick={() => setPhaseFilter('')}
          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
            phaseFilter === '' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setPhaseFilter(p)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              phaseFilter === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Package list */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading work packages…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No {activeTab.toLowerCase()} work packages yet.</p>
          <button
            onClick={openNew}
            className="mt-3 text-sm text-indigo-600 hover:underline"
          >
            + Add one now
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Slide-in panel */}
      {panelOpen && (
        <PackagePanel
          projectId={projectId}
          editingPackage={editingPackage}
          defaultExecutionType={activeTab}
          onClose={closePanel}
        />
      )}
    </div>
  )
}
