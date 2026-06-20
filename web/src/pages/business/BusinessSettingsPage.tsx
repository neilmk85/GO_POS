import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, SlidersHorizontal, Loader2, Save,
  Bed, Users, Clock, Hammer, BedDouble,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { businessRateConfigApi, type BusinessRateConfig } from '@/services/businessApi'

// ─── Field config ─────────────────────────────────────────────────────────────

const RATE_FIELDS: {
  key:         keyof Omit<BusinessRateConfig, 'id' | 'createdAt' | 'updatedAt'>
  label:       string
  unit:        string
  description: string
  icon:        React.ReactNode
  color:       string
  iconColor:   string
}[] = [
  {
    key:         'smallBedRate',
    label:       'Small Bed Rate',
    unit:        '₹ / pipe',
    description: 'Rate charged per pipe produced on the small bed',
    icon:        <Bed size={20} />,
    color:       'bg-violet-100',
    iconColor:   'text-violet-600',
  },
  {
    key:         'largeBedRate',
    label:       'Large Bed Rate',
    unit:        '₹ / pipe',
    description: 'Rate charged per pipe produced on the large bed',
    icon:        <BedDouble size={20} />,
    color:       'bg-blue-100',
    iconColor:   'text-blue-600',
  },
  {
    key:         'labourRatePerDay',
    label:       'Labour Rate',
    unit:        '₹ / labour / day',
    description: 'Default daily wage rate per labour',
    icon:        <Users size={20} />,
    color:       'bg-emerald-100',
    iconColor:   'text-emerald-600',
  },
  {
    key:         'otRatePerHour',
    label:       'OT Rate',
    unit:        '₹ / labour / hour',
    description: 'Overtime rate per labour per hour worked beyond regular shift',
    icon:        <Clock size={20} />,
    color:       'bg-amber-100',
    iconColor:   'text-amber-600',
  },
  {
    key:         'fabricationRateKg',
    label:       'Fabrication Rate',
    unit:        '₹ / kg',
    description: 'Rate applied per kilogram of material for fabrication work',
    icon:        <Hammer size={20} />,
    color:       'bg-rose-100',
    iconColor:   'text-rose-600',
  },
]

function fmt(val: string) {
  const n = parseFloat(val)
  if (!val || isNaN(n)) return '—'
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessSettingsPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const { data: cfg, isLoading } = useQuery({
    queryKey: ['business-rate-config'],
    queryFn:  businessRateConfigApi.get,
  })

  const emptyForm = {
    smallBedRate:      '',
    largeBedRate:      '',
    labourRatePerDay:  '',
    otRatePerHour:     '',
    fabricationRateKg: '',
  }

  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (cfg) {
      setForm({
        smallBedRate:      cfg.smallBedRate      ?? '',
        largeBedRate:      cfg.largeBedRate      ?? '',
        labourRatePerDay:  cfg.labourRatePerDay  ?? '',
        otRatePerHour:     cfg.otRatePerHour     ?? '',
        fabricationRateKg: cfg.fabricationRateKg ?? '',
      })
    }
  }, [cfg])

  const saveMut = useMutation({
    mutationFn: businessRateConfigApi.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-rate-config'] })
      toast.success('Rate settings saved')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to save settings'),
  })

  function setField(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v.replace(/[^0-9.]/g, '') }))
  }

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors'

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-5">

      {/* ── Hero header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 shadow-[0_8px_32px_rgba(109,40,217,0.25)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/business')}
              className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 flex items-center justify-center transition"
            >
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
              <SlidersHorizontal size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-200 uppercase tracking-widest mb-0.5">Business</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Rate Settings</h1>
              <p className="text-sm text-violet-200 mt-0.5">Configure default rates used across business modules</p>
            </div>
          </div>
          <button
            onClick={() => saveMut.mutate(form)}
            disabled={saveMut.isPending}
            className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition backdrop-blur-sm disabled:opacity-60"
          >
            {saveMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Settings
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-sm">Loading settings…</span>
        </div>
      ) : (
        <>
          {/* ── Current saved rates ─────────────────────────────────── */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Current Rates</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {RATE_FIELDS.map(f => (
                <div
                  key={f.key}
                  className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 flex flex-col gap-2"
                >
                  <div className={`w-9 h-9 rounded-xl ${f.color} flex items-center justify-center ${f.iconColor}`}>
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest leading-none">{f.label}</p>
                    <p className="text-lg font-extrabold text-gray-800 tabular-nums mt-1 leading-none">
                      {fmt(cfg?.[f.key] ?? '')}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">{f.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Edit form ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden ring-1 ring-gray-100">

            {/* Form header */}
            <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <SlidersHorizontal size={15} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-white">Edit Rates</h2>
            </div>

            {/* Fields */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {RATE_FIELDS.map(f => (
                <div key={f.key}>
                  {/* Label row */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg ${f.color} flex items-center justify-center ${f.iconColor} shrink-0`}>
                      <span className="scale-75">{f.icon}</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-700 uppercase tracking-widest leading-none">{f.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{f.unit}</p>
                    </div>
                  </div>
                  {/* Input */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center text-gray-400 text-sm pointer-events-none">₹</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form[f.key]}
                      onChange={e => setField(f.key, e.target.value)}
                      placeholder="0.00"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">{f.description}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => navigate('/business')}
                className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMut.mutate(form)}
                disabled={saveMut.isPending}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 shadow-sm hover:shadow-md disabled:opacity-60 transition-all"
              >
                {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Settings
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
