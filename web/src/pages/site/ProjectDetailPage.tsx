import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Plus, Pencil, Trash2, ChevronDown,
  MapPin, Package,
} from 'lucide-react'
import { siteProjectApi, workPackageApi } from '@/services/api'
import SiteFloatingNav from './SiteFloatingNav'

const PHASES = [
  'EXCAVATION', 'CONCRETE', 'PSC_PCCP', 'HDPE',
  'MS_SPECIALS', 'WUA', 'TESTING', 'OTHER',
]

const UNITS = ['m', 'm²', 'm³', 'LS', 'Nos', 'RMT', 'MT', 'KG']
const STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']

const PHASE_META: Record<string, { color: string; light: string; text: string; border: string; label: string }> = {
  EXCAVATION:  { color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa', label: 'Excavation' },
  CONCRETE:    { color: '#64748b', light: '#f8fafc', text: '#334155', border: '#e2e8f0', label: 'Concrete' },
  PSC_PCCP:    { color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', label: 'PSC / PCCP' },
  HDPE:        { color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0', label: 'HDPE' },
  MS_SPECIALS: { color: '#ef4444', light: '#fef2f2', text: '#b91c1c', border: '#fecaca', label: 'MS Specials' },
  WUA:         { color: '#a855f7', light: '#faf5ff', text: '#7e22ce', border: '#e9d5ff', label: 'WUA' },
  TESTING:     { color: '#06b6d4', light: '#ecfeff', text: '#0e7490', border: '#a5f3fc', label: 'Testing' },
  OTHER:       { color: '#6b7280', light: '#f9fafb', text: '#374151', border: '#e5e7eb', label: 'Other' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  PLANNED:     { label: 'Planned',     color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
  IN_PROGRESS: { label: 'In Progress', color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6' },
  COMPLETED:   { label: 'Completed',   color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
  ON_HOLD:     { label: 'On Hold',     color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
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

function PackagePanel({
  projectId, editingPackage, defaultExecutionType, onClose,
}: {
  projectId: number
  editingPackage: WorkPackage | null
  defaultExecutionType: 'INHOUSE' | 'SUBCONTRACTED'
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [visible, setVisible] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])
  const handleClose = () => { setVisible(false); setTimeout(onClose, 300) }

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PackageFormData>({
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
          phase: 'EXCAVATION', unit: 'LS', plannedQty: '1',
          executionType: defaultExecutionType, status: 'PLANNED',
        },
  })

  const saveMutation = useMutation({
    mutationFn: (data: PackageFormData) => {
      const payload = { ...data, siteProjectId: projectId }
      return editingPackage ? workPackageApi.update(editingPackage.id, payload) : workPackageApi.create(payload)
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
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />
      <div
        className="relative z-50 bg-white shadow-2xl flex flex-col"
        style={{
          width: '50vw',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        <div style={{ background: '#f8f9fb', borderBottom: '1px solid #e8edf3' }}
          className="flex items-center justify-between px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {editingPackage ? 'Edit Work Package' : 'New Work Package'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Fill in the details below</p>
          </div>
          <button onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-base leading-none">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-4">

            {/* Execution Type */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Execution Type</p>
              <div className="flex gap-2">
                {(['INHOUSE', 'SUBCONTRACTED'] as const).map((t) => (
                  <label key={t} className="flex-1 cursor-pointer">
                    <input type="radio" value={t} {...register('executionType')} className="sr-only peer" />
                    <div className="py-2.5 text-sm font-semibold rounded-xl text-center transition-colors bg-gray-50 text-gray-500 hover:bg-gray-100 peer-checked:bg-blue-500 peer-checked:text-white">
                      {t === 'INHOUSE' ? 'Inhouse' : 'Subcontracted'}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Phase + Status */}
            <div className="bg-white rounded-xl shadow-md p-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Phase</p>
                <div className="relative">
                  <select {...register('phase')}
                    className="w-full appearance-none text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors">
                    {PHASES.map((p) => <option key={p} value={p}>{PHASE_META[p]?.label ?? p}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                {errors.phase && <p className="text-xs text-red-500 mt-1">{errors.phase.message}</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Status</p>
                <div className="relative">
                  <select {...register('status')}
                    className="w-full appearance-none text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors">
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Description <span className="text-blue-500">*</span>
              </p>
              <textarea {...register('description')} rows={3}
                placeholder="e.g. RCC pipe laying from Ch. 0+000 to Ch. 0+500"
                className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 bg-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors resize-none" />
              {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
            </div>

            {/* Location + Qty + Unit */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Location / Chainage</p>
                  <input {...register('location')} placeholder="e.g. Ch. 0+000 to 0+500"
                    className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 focus:bg-white transition-colors" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                    Qty <span className="text-blue-500">*</span>
                  </p>
                  <input {...register('plannedQty')} type="number" step="0.001" min="0"
                    className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors" />
                  {errors.plannedQty && <p className="text-xs text-red-500 mt-1">{errors.plannedQty.message}</p>}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Unit</p>
                  <div className="relative">
                    <select {...register('unit')}
                      className="w-full appearance-none text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors">
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notes</p>
              <textarea {...register('notes')} rows={2} placeholder="Optional notes"
                className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 bg-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors resize-none" />
            </div>

          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3" style={{ background: '#f8f9fb' }}>
          <button type="button" onClick={handleClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit(onSubmit)} disabled={saveMutation.isPending}
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            className="px-5 py-2 text-sm text-white rounded-xl disabled:opacity-60 font-medium shadow-sm">
            {saveMutation.isPending ? 'Saving…' : editingPackage ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatCurrency(val?: string | number) {
  if (!val) return '—'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  return `₹${n.toLocaleString('en-IN')}`
}

function formatDate(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return d }
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const projectId = Number(id)

  const [execFilter, setExecFilter] = useState<'ALL' | 'INHOUSE' | 'SUBCONTRACTED'>('ALL')
  const [phaseFilter, setPhaseFilter] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<WorkPackage | null>(null)
  const [addBtnHovered, setAddBtnHovered] = useState(false)

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

  const filtered = useMemo(() => allPackages.filter(p => {
    if (execFilter !== 'ALL' && p.executionType !== execFilter) return false
    if (phaseFilter && p.phase !== phaseFilter) return false
    return true
  }), [allPackages, execFilter, phaseFilter])

  const phaseGroups = useMemo(() => {
    const groups: Record<string, WorkPackage[]> = {}
    for (const pkg of filtered) {
      if (!groups[pkg.phase]) groups[pkg.phase] = []
      groups[pkg.phase].push(pkg)
    }
    return PHASES.filter(p => groups[p]?.length).map(p => ({ phase: p, items: groups[p] }))
  }, [filtered])

  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const pkg of allPackages) {
      if (execFilter !== 'ALL' && pkg.executionType !== execFilter) continue
      counts[pkg.phase] = (counts[pkg.phase] ?? 0) + 1
    }
    return counts
  }, [allPackages, execFilter])

  const stats = useMemo(() => ({
    total: allPackages.length,
    inhouse: allPackages.filter(p => p.executionType === 'INHOUSE').length,
    subcontracted: allPackages.filter(p => p.executionType === 'SUBCONTRACTED').length,
    completed: allPackages.filter(p => p.status === 'COMPLETED').length,
    inProgress: allPackages.filter(p => p.status === 'IN_PROGRESS').length,
  }), [allPackages])

  const handleEdit = (pkg: WorkPackage) => { setEditingPackage(pkg); setPanelOpen(true) }
  const handleDelete = (pkgId: number) => {
    if (window.confirm('Delete this work package?')) deleteMutation.mutate(pkgId)
  }
  const openNew = () => { setEditingPackage(null); setPanelOpen(true) }
  const closePanel = () => { setPanelOpen(false); setEditingPackage(null) }

  const defaultExecType: 'INHOUSE' | 'SUBCONTRACTED' = execFilter === 'SUBCONTRACTED' ? 'SUBCONTRACTED' : 'INHOUSE'

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb', fontFamily: '"Roboto", sans-serif' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e8edf3',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 12,
        height: 110,
      }}>
        <button onClick={() => navigate('/site/projects')}
          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#fff', color: '#64748b', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#64748b' }}>
          <ArrowLeft size={15} />
        </button>

        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
            {project?.name ?? '…'}
          </div>
          {project && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, display: 'flex', gap: 8 }}>
              {project.clientName && <span>{project.clientName}</span>}
              {project.location && <span>· {project.location}</span>}
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <SiteFloatingNav theme="light" inline />
        </div>

        {/* + button with multicolor glow */}
        <div style={{ position: 'relative', flexShrink: 0 }}
          onMouseEnter={() => setAddBtnHovered(true)}
          onMouseLeave={() => setAddBtnHovered(false)}>
          <div style={{
            position: 'absolute', inset: -10, borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #f43f5e, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #f43f5e)',
            filter: 'blur(10px)', opacity: addBtnHovered ? 0.85 : 0,
            transition: 'opacity 0.3s ease', zIndex: 0,
          }} />
          <button onClick={openNew}
            style={{ position: 'relative', zIndex: 1, width: 36, height: 36, borderRadius: '50%',
              border: 'none', background: '#fff', color: '#3b82f6', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
              transition: 'transform 0.2s', transform: addBtnHovered ? 'scale(1.08)' : 'scale(1)' }}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* ── Project info strip ──────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 35%, #fff0f9 65%, #f0faff 100%)',
        borderBottom: '1px solid #e2e8f0',
        padding: '20px 24px 16px',
        display: 'flex', alignItems: 'center', gap: 0,
      }}>
        {[
          {
            label: 'Contract Value',
            value: project?.contractValue ? formatCurrency(project.contractValue) : '—',
            color: '#16a34a',
          },
          {
            label: 'Start Date',
            value: formatDate(project?.startDate),
            color: '#0f172a',
          },
          {
            label: 'End Date',
            value: formatDate(project?.endDate),
            color: '#0f172a',
          },
          {
            label: 'Status',
            value: (project?.status ?? 'ACTIVE').replace('_', ' '),
            color: '#3b82f6',
          },
          { label: 'Total Packages', value: String(stats.total), color: '#0f172a' },
          { label: 'Inhouse', value: String(stats.inhouse), color: '#0f172a' },
          { label: 'Subcontracted', value: String(stats.subcontracted), color: '#0f172a' },
          { label: 'Completed', value: String(stats.completed), color: '#16a34a' },
        ].map((s, i) => (
          <div key={s.label} style={{
            flex: 1, padding: '4px 16px', textAlign: 'center',
            borderRight: i < 7 ? '1px solid #f1f5f9' : 'none',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e8edf3',
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        {/* execution type toggle */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 999, padding: 4, gap: 2 }}>
          {(['ALL', 'INHOUSE', 'SUBCONTRACTED'] as const).map(t => (
            <button key={t} onClick={() => setExecFilter(t)}
              style={{
                padding: '6px 14px', borderRadius: 999, border: 'none',
                background: execFilter === t ? '#0f172a' : 'transparent',
                color: execFilter === t ? '#fff' : '#64748b',
                fontSize: 12, fontWeight: execFilter === t ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s ease',
                letterSpacing: '0.03em',
              }}>
              {t === 'ALL' ? 'All' : t === 'INHOUSE' ? 'Inhouse' : 'Subcontracted'}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0 }} />

        {/* phase filter pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', flex: 1 }}>
          <button onClick={() => setPhaseFilter('')}
            style={{
              padding: '5px 12px', borderRadius: 999, border: '1.5px solid',
              borderColor: phaseFilter === '' ? '#0f172a' : '#e2e8f0',
              background: phaseFilter === '' ? '#0f172a' : '#fff',
              color: phaseFilter === '' ? '#fff' : '#64748b',
              fontSize: 11, fontWeight: phaseFilter === '' ? 600 : 400,
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}>
            All Phases
          </button>
          {PHASES.map(p => {
            const meta = PHASE_META[p]
            const count = phaseCounts[p] ?? 0
            const isActive = phaseFilter === p
            return (
              <button key={p} onClick={() => setPhaseFilter(p === phaseFilter ? '' : p)}
                style={{
                  padding: '5px 12px', borderRadius: 999, border: '1.5px solid',
                  borderColor: isActive ? meta.color : '#e2e8f0',
                  background: isActive ? meta.color : '#fff',
                  color: isActive ? '#fff' : meta.text,
                  fontSize: 11, fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                {meta.label}
                {count > 0 && (
                  <span style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : meta.light,
                    color: isActive ? '#fff' : meta.text,
                    borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Package list ──────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#94a3b8', fontSize: 14 }}>
            Loading work packages…
          </div>
        ) : phaseGroups.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '64px 0',
            background: '#fff', borderRadius: 16, border: '1px dashed #e2e8f0',
          }}>
            <Package size={32} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
            <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>No work packages found.</p>
            <button onClick={openNew}
              style={{ marginTop: 12, fontSize: 13, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>
              + Add one now
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {phaseGroups.map(({ phase, items }) => {
              const meta = PHASE_META[phase] ?? PHASE_META.OTHER
              const completedCount = items.filter(i => i.status === 'COMPLETED').length
              const progressPct = items.length ? Math.round((completedCount / items.length) * 100) : 0

              return (
                <div key={phase} style={{
                  background: '#fff', borderRadius: 16,
                  border: `1px solid ${meta.border}`,
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  {/* phase header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px',
                    background: meta.light,
                    borderBottom: `1px solid ${meta.border}`,
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: meta.color, flexShrink: 0,
                      boxShadow: `0 0 0 3px ${meta.border}`,
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: meta.text, letterSpacing: '0.02em' }}>
                      {meta.label}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: meta.color,
                      background: '#fff', border: `1px solid ${meta.border}`,
                      padding: '1px 8px', borderRadius: 999,
                    }}>
                      {items.length} {items.length === 1 ? 'package' : 'packages'}
                    </span>

                    {/* mini progress */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div style={{ width: 80, height: 4, background: meta.border, borderRadius: 99 }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${progressPct}%`, background: meta.color,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: meta.text, fontWeight: 600, minWidth: 28, textAlign: 'right' }}>
                        {progressPct}%
                      </span>
                    </div>
                  </div>

                  {/* package rows */}
                  <div>
                    {items.map((pkg, idx) => {
                      const sMeta = STATUS_META[pkg.status] ?? STATUS_META.PLANNED
                      return (
                        <div key={pkg.id} style={{
                          display: 'flex', alignItems: 'center', gap: 16,
                          padding: '13px 20px',
                          borderBottom: idx < items.length - 1 ? '1px solid #f8fafc' : 'none',
                          transition: 'background 0.12s',
                        }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>

                          {/* colored left accent */}
                          <div style={{
                            width: 3, height: 36, borderRadius: 99,
                            background: meta.color, flexShrink: 0, alignSelf: 'stretch',
                          }} />

                          {/* description + location */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#0f172a', lineHeight: 1.3 }}>
                              {pkg.description}
                            </p>
                            {pkg.location && (
                              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPin size={10} />
                                {pkg.location}
                              </p>
                            )}
                          </div>

                          {/* qty */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{pkg.plannedQty}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 3 }}>{pkg.unit}</span>
                          </div>

                          {/* execution type badge */}
                          <div style={{ flexShrink: 0 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                              padding: '3px 8px', borderRadius: 999,
                              background: pkg.executionType === 'INHOUSE' ? '#ecfdf5' : '#fef3c7',
                              color: pkg.executionType === 'INHOUSE' ? '#065f46' : '#92400e',
                            }}>
                              {pkg.executionType === 'INHOUSE' ? 'INHOUSE' : 'SUB'}
                            </span>
                          </div>

                          {/* status badge */}
                          <div style={{ flexShrink: 0 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: 11, fontWeight: 500,
                              padding: '4px 10px', borderRadius: 999,
                              background: sMeta.bg, color: sMeta.color,
                            }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: sMeta.dot, display: 'inline-block', flexShrink: 0,
                              }} />
                              {sMeta.label}
                            </span>
                          </div>

                          {/* actions */}
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button onClick={() => handleEdit(pkg)}
                              style={{ padding: '6px', borderRadius: 8, border: 'none',
                                background: 'transparent', color: '#94a3b8', cursor: 'pointer',
                                transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#3b82f6' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}>
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(pkg.id)}
                              style={{ padding: '6px', borderRadius: 8, border: 'none',
                                background: 'transparent', color: '#94a3b8', cursor: 'pointer',
                                transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Slide-in panel */}
      {panelOpen && (
        <PackagePanel
          projectId={projectId}
          editingPackage={editingPackage}
          defaultExecutionType={defaultExecType}
          onClose={closePanel}
        />
      )}
    </div>
  )
}
