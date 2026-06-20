import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit, ToggleLeft, ToggleRight, Cpu, X, WrenchIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { machineApi } from '@/services/api'
import api from '@/services/api'
import { ProductionMachine, MACHINE_TYPES, MACHINE_STATUSES } from '@/types'

function useOutlets() {
  return useQuery({
    queryKey: ['outlets-list'],
    queryFn: () => api.get<any>('/outlets').then(r => r.data.data?.content ?? r.data.data ?? []),
  })
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:      'bg-green-100 text-green-700',
  IDLE:        'bg-yellow-100 text-yellow-700',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
  RETIRED:     'bg-gray-100 text-gray-500',
}

interface FormValues {
  machineCode: string
  name: string
  machineType: string
  outletId: number
  capacity: number
  hourlyRate: number
  description: string
  status: string
}

function MachineModal({
  machine,
  onClose,
}: {
  machine?: ProductionMachine | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: outlets } = useOutlets()
  const isEdit = !!machine

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      machineCode:  machine?.machineCode ?? '',
      name:         machine?.name ?? '',
      machineType:  machine?.machineType ?? 'FABRICATION',
      outletId:     machine?.outletId ?? 0,
      capacity:     machine?.capacity ?? 0,
      hourlyRate:   Number(machine?.hourlyRate ?? 0),
      description:  machine?.description ?? '',
      status:       machine?.status ?? 'ACTIVE',
    },
  })

  const saveMut = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        outletId:   Number(values.outletId),
        capacity:   Number(values.capacity),
        hourlyRate: Number(values.hourlyRate),
      }
      return isEdit
        ? machineApi.update(machine!.id, payload)
        : machineApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machines'] })
      toast.success(isEdit ? 'Machine updated' : 'Machine created')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Error'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Edit Machine' : 'New Machine'}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(v => saveMut.mutate(v))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700">Machine Code *</label>
              <input
                {...register('machineCode', { required: true })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="e.g. SPM-01"
              />
              {errors.machineCode && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Name *</label>
              <input
                {...register('name', { required: true })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700">Machine Type</label>
              <select
                {...register('machineType')}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {MACHINE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Outlet *</label>
              <select
                {...register('outletId', { required: true, min: 1 })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {outlets?.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700">Capacity (pipes/shift)</label>
              <input
                type="number"
                min={0}
                {...register('capacity')}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Hourly Rate (₹)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                {...register('hourlyRate')}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="text-xs font-medium text-gray-700">Status</label>
              <select
                {...register('status')}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {MACHINE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-700">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-violet-50/40">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-medium disabled:opacity-50"
            >
              {saveMut.isPending ? 'Saving...' : 'Save Machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MachinesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [modal, setModal] = useState<{ open: boolean; machine?: ProductionMachine | null }>({ open: false })

  const { data, isLoading } = useQuery({
    queryKey: ['machines', filterType],
    queryFn: () => machineApi.getAll({
      machineType: filterType || undefined,
      size: 200,
    }).then(r => r.data.data),
  })

  const toggleMut = useMutation({
    mutationFn: (id: number) => machineApi.toggleActive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machines'] })
      toast.success('Updated')
    },
  })

  const machines: ProductionMachine[] = data?.content ?? []
  const filtered = machines.filter(m =>
    !search ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.machineCode.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <WrenchIcon size={28} className="text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Machine Management is Being Set Up</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          This section is currently unavailable while we configure machine records for your production line.
          Please check back soon.
        </p>
        <p className="mt-4 text-xs text-gray-400">Contact your system administrator if you need immediate access.</p>
      </div>
    </div>
  )
}
