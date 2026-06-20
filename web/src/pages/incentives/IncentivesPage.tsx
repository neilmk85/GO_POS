import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Trophy, Target, TrendingUp, Award, Plus, X, Edit2, Trash2, Check,
  Loader2, ToggleLeft, ToggleRight, Medal, ChevronDown, RefreshCw,
  Users, DollarSign, Percent, Zap, Star, BarChart3, ArrowLeft
} from 'lucide-react'
import toast from 'react-hot-toast'
import { incentiveApi, staffApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ─── Types ─────────────────────────────────────────────────────────────────────

type RuleType = 'COMMISSION' | 'TARGET_BONUS' | 'PER_TRANSACTION' | 'TIERED_COMMISSION'

interface IncentiveRule {
  id: number
  name: string
  ruleType: RuleType
  commissionRate?: number
  targetAmount?: number
  bonusAmount?: number
  minTransactionAmount?: number
  bonusPerTransaction?: number
  tiers?: { minSales: number; maxSales?: number; rate: number }[]
  applyToAll: boolean
  staffIds?: number[]
  active: boolean
  description?: string
}

interface Payout {
  staffId: number
  staffName: string
  totalSales: number
  totalTransactions: number
  commissionEarned: number
  bonusEarned: number
  totalIncentive: number
}

interface LeaderboardEntry {
  rank: number
  staffId: number
  staffName: string
  totalSales: number
  totalTransactions: number
  totalIncentive: number
}

// ─── Rule Type Config ──────────────────────────────────────────────────────────

const RULE_TYPES: { value: RuleType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'COMMISSION',         label: 'Sales Commission',    icon: <Percent size={16} />,    desc: 'Earn % of total sales' },
  { value: 'TARGET_BONUS',       label: 'Target Bonus',        icon: <Target size={16} />,     desc: 'Bonus for hitting a sales target' },
  { value: 'PER_TRANSACTION',    label: 'Per Transaction',     icon: <Zap size={16} />,        desc: 'Fixed bonus per qualifying transaction' },
  { value: 'TIERED_COMMISSION',  label: 'Tiered Commission',   icon: <TrendingUp size={16} />, desc: 'Higher % as sales increase' },
]

// ─── Create/Edit Rule Modal ────────────────────────────────────────────────────

function RuleModal({
  rule, staffList, onClose, onDone
}: {
  rule: IncentiveRule | null
  staffList: any[]
  onClose: () => void
  onDone: () => void
}) {
  const isEdit = !!rule
  const [name, setName] = useState(rule?.name ?? '')
  const [desc, setDesc] = useState(rule?.description ?? '')
  const [ruleType, setRuleType] = useState<RuleType>(rule?.ruleType ?? 'COMMISSION')
  const [commissionRate, setCommissionRate] = useState(rule?.commissionRate?.toString() ?? '')
  const [targetAmount, setTargetAmount] = useState(rule?.targetAmount?.toString() ?? '')
  const [bonusAmount, setBonusAmount] = useState(rule?.bonusAmount?.toString() ?? '')
  const [minTxAmount, setMinTxAmount] = useState(rule?.minTransactionAmount?.toString() ?? '')
  const [bonusPerTx, setBonusPerTx] = useState(rule?.bonusPerTransaction?.toString() ?? '')
  const [tiers, setTiers] = useState<{ minSales: string; maxSales: string; rate: string }[]>(
    rule?.tiers?.map(t => ({ minSales: t.minSales.toString(), maxSales: t.maxSales?.toString() ?? '', rate: t.rate.toString() })) ??
    [{ minSales: '0', maxSales: '50000', rate: '1' }, { minSales: '50001', maxSales: '', rate: '2' }]
  )
  const [applyToAll, setApplyToAll] = useState(rule?.applyToAll ?? true)
  const [selectedStaff, setSelectedStaff] = useState<number[]>(rule?.staffIds ?? [])
  const [loading, setLoading] = useState(false)

  function addTier() {
    setTiers(prev => [...prev, { minSales: '', maxSales: '', rate: '' }])
  }
  function removeTier(i: number) {
    setTiers(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateTier(i: number, field: 'minSales' | 'maxSales' | 'rate', val: string) {
    setTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t))
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error('Rule name is required'); return }
    setLoading(true)
    try {
      const payload: any = {
        name: name.trim(), description: desc.trim(), ruleType,
        applyToAll, staffIds: applyToAll ? [] : selectedStaff,
      }
      if (ruleType === 'COMMISSION') {
        if (!commissionRate) { toast.error('Commission rate is required'); setLoading(false); return }
        payload.commissionRate = parseFloat(commissionRate)
      } else if (ruleType === 'TARGET_BONUS') {
        if (!targetAmount || !bonusAmount) { toast.error('Target and bonus amounts are required'); setLoading(false); return }
        payload.targetAmount = parseFloat(targetAmount)
        payload.bonusAmount = parseFloat(bonusAmount)
      } else if (ruleType === 'PER_TRANSACTION') {
        if (!bonusPerTx) { toast.error('Bonus per transaction is required'); setLoading(false); return }
        payload.minTransactionAmount = minTxAmount ? parseFloat(minTxAmount) : 0
        payload.bonusPerTransaction = parseFloat(bonusPerTx)
      } else if (ruleType === 'TIERED_COMMISSION') {
        payload.tiers = tiers.map(t => ({
          minSales: parseFloat(t.minSales) || 0,
          maxSales: t.maxSales ? parseFloat(t.maxSales) : undefined,
          rate: parseFloat(t.rate) || 0,
        }))
      }

      if (isEdit) {
        await incentiveApi.updateRule(rule!.id, payload)
        toast.success('Rule updated')
      } else {
        await incentiveApi.createRule(payload)
        toast.success('Rule created')
      }
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save rule')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Rule' : 'Create Incentive Rule'}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="overflow-auto flex-1 px-6 py-4 space-y-5">
          {/* Name & description */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Monthly Sales Commission"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Brief description of this incentive rule"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
          </div>

          {/* Rule type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Incentive Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {RULE_TYPES.map(rt => (
                <button key={rt.value} onClick={() => setRuleType(rt.value)}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-colors ${
                    ruleType === rt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className={ruleType === rt.value ? 'text-primary-600' : 'text-gray-400'}>{rt.icon}</span>
                  <div>
                    <p className={`text-xs font-semibold ${ruleType === rt.value ? 'text-primary-700' : 'text-gray-700'}`}>{rt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{rt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Type-specific fields */}
          {ruleType === 'COMMISSION' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
              <div className="relative max-w-xs">
                <input type="number" min="0" max="100" step="0.1" value={commissionRate}
                  onChange={e => setCommissionRate(e.target.value)}
                  placeholder="e.g. 2.5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Staff earns this % on their total sales for the period</p>
            </div>
          )}

          {ruleType === 'TARGET_BONUS' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales Target (₹)</label>
                <input type="number" min="0" step="100" value={targetAmount}
                  onChange={e => setTargetAmount(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bonus Amount (₹)</label>
                <input type="number" min="0" step="100" value={bonusAmount}
                  onChange={e => setBonusAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
              <p className="col-span-2 text-xs text-gray-400">Staff earns the bonus amount when they hit the sales target</p>
            </div>
          )}

          {ruleType === 'PER_TRANSACTION' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Transaction Value (₹)</label>
                <input type="number" min="0" step="10" value={minTxAmount}
                  onChange={e => setMinTxAmount(e.target.value)}
                  placeholder="e.g. 500 (0 = all transactions)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bonus per Transaction (₹)</label>
                <input type="number" min="0" step="10" value={bonusPerTx}
                  onChange={e => setBonusPerTx(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
              <p className="col-span-2 text-xs text-gray-400">Staff earns a fixed amount for each qualifying transaction</p>
            </div>
          )}

          {ruleType === 'TIERED_COMMISSION' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Commission Tiers</label>
                <button onClick={addTier}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                  <Plus size={13} /> Add Tier
                </button>
              </div>
              <div className="space-y-2">
                {tiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400">From (₹)</label>
                      <input type="number" value={tier.minSales} onChange={e => updateTier(i, 'minSales', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 mt-0.5" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400">To (₹, blank=∞)</label>
                      <input type="number" value={tier.maxSales} onChange={e => updateTier(i, 'maxSales', e.target.value)}
                        placeholder="No limit"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 mt-0.5" />
                    </div>
                    <div className="w-20">
                      <label className="text-xs text-gray-400">Rate (%)</label>
                      <input type="number" value={tier.rate} onChange={e => updateTier(i, 'rate', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 mt-0.5" />
                    </div>
                    {tiers.length > 1 && (
                      <button onClick={() => removeTier(i)} className="text-red-400 hover:text-red-600 mt-4">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Apply to */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Apply To</label>
            <div className="flex gap-2">
              <button onClick={() => setApplyToAll(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  applyToAll ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <Users size={15} /> All Staff
              </button>
              <button onClick={() => setApplyToAll(false)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  !applyToAll ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <Star size={15} /> Specific Staff
              </button>
            </div>
            {!applyToAll && staffList.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {staffList.map((s: any) => (
                  <button key={s.id}
                    onClick={() => setSelectedStaff(prev =>
                      prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                    )}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selectedStaff.includes(s.id) ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white border-primary-600' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}>
                    {selectedStaff.includes(s.id) && <Check size={11} />}
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Rules Tab ─────────────────────────────────────────────────────────────────

function RulesTab({ outletId }: { outletId: number }) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<IncentiveRule | null>(null)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['incentive-rules', outletId],
    queryFn: () => incentiveApi.getRules(outletId).then(r => r.data.data ?? []),
  })

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-list', outletId],
    queryFn: () => staffApi.getByOutlet(outletId).then(r => r.data.data ?? []),
  })

  async function toggleActive(rule: IncentiveRule) {
    try {
      await incentiveApi.updateRule(rule.id, { ...rule, active: !rule.active })
      toast.success(rule.active ? 'Rule deactivated' : 'Rule activated')
      qc.invalidateQueries({ queryKey: ['incentive-rules'] })
    } catch { toast.error('Failed to update rule') }
  }

  async function deleteRule(id: number) {
    if (!window.confirm('Delete this incentive rule?')) return
    try {
      await incentiveApi.deleteRule(id)
      toast.success('Rule deleted')
      qc.invalidateQueries({ queryKey: ['incentive-rules'] })
    } catch { toast.error('Failed to delete rule') }
  }

  const ruleLabel = (r: IncentiveRule) => {
    if (r.ruleType === 'COMMISSION') return `${r.commissionRate}% of sales`
    if (r.ruleType === 'TARGET_BONUS') return `₹${r.bonusAmount?.toLocaleString()} bonus on ₹${r.targetAmount?.toLocaleString()} target`
    if (r.ruleType === 'PER_TRANSACTION') return `₹${r.bonusPerTransaction} per transaction${r.minTransactionAmount ? ` ≥ ₹${r.minTransactionAmount}` : ''}`
    if (r.ruleType === 'TIERED_COMMISSION') return `${r.tiers?.length ?? 0} commission tiers`
    return ''
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{rules.length} rule{rules.length !== 1 ? 's' : ''} defined</p>
        <button onClick={() => { setEditTarget(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg">
          <Plus size={15} /> New Rule
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading rules…
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
          <Target size={48} className="mb-4" />
          <p className="text-base text-gray-400 font-medium">No incentive rules yet</p>
          <p className="text-sm text-gray-400 mt-1">Create rules to motivate your staff</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: IncentiveRule) => {
            const rt = RULE_TYPES.find(t => t.value === rule.ruleType)
            return (
              <div key={rule.id} className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${rule.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rule.active ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                  {rt?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{rule.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{rt?.label}</span>
                    {rule.active ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </div>
                  <p className="text-sm text-primary-600 font-medium mt-0.5">{ruleLabel(rule)}</p>
                  {rule.description && <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{rule.applyToAll ? 'Applies to all staff' : `${rule.staffIds?.length ?? 0} selected staff`}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(rule)}
                    className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50">
                    {rule.active ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => { setEditTarget(rule); setShowModal(true) }}
                    className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => deleteRule(rule.id)}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <RuleModal
          rule={editTarget}
          staffList={staffList}
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); qc.invalidateQueries({ queryKey: ['incentive-rules'] }) }}
        />
      )}
    </div>
  )
}

// ─── Payouts Tab ───────────────────────────────────────────────────────────────

function PayoutsTab({ outletId }: { outletId: number }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [recalculating, setRecalculating] = useState(false)

  const { data: payouts = [], isLoading, refetch } = useQuery({
    queryKey: ['incentive-payouts', outletId, month, year],
    queryFn: () => incentiveApi.getPayouts(outletId, month, year).then(r => r.data.data ?? []),
  })

  async function recalculate() {
    setRecalculating(true)
    try {
      await incentiveApi.recalculate(outletId, month, year)
      toast.success('Payouts recalculated')
      refetch()
    } catch {
      toast.error('Recalculation failed')
    } finally {
      setRecalculating(false)
    }
  }

  const totalPayout = (payouts as Payout[]).reduce((s, p) => s + p.totalIncentive, 0)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="text-sm text-gray-700 bg-transparent focus:outline-none pr-1">
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="text-sm text-gray-700 bg-transparent focus:outline-none">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={recalculate} disabled={recalculating}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
          {recalculating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Recalculate
        </button>
        {totalPayout > 0 && (
          <div className="ml-auto flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <DollarSign size={15} className="text-green-600" />
            <span className="text-sm font-bold text-green-700">Total Payout: ₹{totalPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Staff Member</th>
              <th className="px-4 py-3 text-right">Total Sales</th>
              <th className="px-4 py-3 text-right">Transactions</th>
              <th className="px-4 py-3 text-right">Commission</th>
              <th className="px-4 py-3 text-right">Bonus</th>
              <th className="px-4 py-3 text-right font-bold text-gray-700">Total Incentive</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400"><Loader2 size={20} className="animate-spin mx-auto" /></td></tr>
            ) : (payouts as Payout[]).length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <BarChart3 size={36} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">No payout data for this period</p>
                  <p className="text-xs text-gray-300 mt-1">Click Recalculate to compute incentives</p>
                </td>
              </tr>
            ) : (payouts as Payout[]).map(p => (
              <tr key={p.staffId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xs font-bold">
                      {p.staffName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900 text-sm">{p.staffName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-700">₹{p.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-500">{p.totalTransactions}</td>
                <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">
                  {p.commissionEarned > 0 ? `₹${p.commissionEarned.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-right text-purple-600 font-medium">
                  {p.bonusEarned > 0 ? `₹${p.bonusEarned.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-bold text-green-700 text-sm">₹{p.totalIncentive.toFixed(2)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          {(payouts as Payout[]).length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm font-bold text-gray-700">Total</td>
                <td className="px-4 py-3 text-sm font-bold text-right text-gray-700">
                  ₹{(payouts as Payout[]).reduce((s, p) => s + p.totalSales, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-right text-gray-700">
                  {(payouts as Payout[]).reduce((s, p) => s + p.totalTransactions, 0)}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-right text-blue-700">
                  ₹{(payouts as Payout[]).reduce((s, p) => s + p.commissionEarned, 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-right text-purple-700">
                  ₹{(payouts as Payout[]).reduce((s, p) => s + p.bonusEarned, 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-bold text-green-700">₹{totalPayout.toFixed(2)}</span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ─── Leaderboard Tab ───────────────────────────────────────────────────────────

const MEDAL_COLORS = ['text-yellow-400', 'text-gray-400', 'text-amber-600']
const MEDAL_BG = ['bg-yellow-50 border-yellow-200', 'bg-gray-50 border-gray-200', 'bg-amber-50 border-amber-200']

function LeaderboardTab({ outletId }: { outletId: number }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const { data: board = [], isLoading } = useQuery({
    queryKey: ['incentive-leaderboard', outletId, month, year],
    queryFn: () => incentiveApi.getLeaderboard(outletId, month, year).then(r => r.data.data ?? []),
  })

  const maxSales = Math.max(...(board as LeaderboardEntry[]).map(e => e.totalSales), 1)

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <Trophy size={15} className="text-yellow-500" />
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="text-sm text-gray-700 bg-transparent focus:outline-none pr-1">
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="text-sm text-gray-700 bg-transparent focus:outline-none">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading leaderboard…
        </div>
      ) : (board as LeaderboardEntry[]).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
          <Trophy size={56} className="mb-4" />
          <p className="text-base text-gray-400">No data for this period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(board as LeaderboardEntry[]).map((entry, idx) => {
            const isTop3 = idx < 3
            const pct = (entry.totalSales / maxSales) * 100
            return (
              <div key={entry.staffId}
                className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${isTop3 ? MEDAL_BG[idx] : 'border-gray-200'}`}>
                {/* Rank */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold ${isTop3 ? 'text-lg ' + MEDAL_COLORS[idx] : 'text-sm text-gray-500 bg-gray-100'}`}>
                  {isTop3 ? <Medal size={22} /> : `#${entry.rank}`}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="font-bold text-gray-900 text-sm">{entry.staffName}</span>
                      {isTop3 && <span className={`ml-2 text-xs font-medium ${MEDAL_COLORS[idx]}`}>{['🥇 Gold', '🥈 Silver', '🥉 Bronze'][idx]}</span>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">₹{entry.totalSales.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-400">{entry.totalTransactions} transactions</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${isTop3 ? ['bg-yellow-400', 'bg-gray-400', 'bg-amber-500'][idx] : 'bg-primary-300'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {entry.totalIncentive > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">Incentive</p>
                    <p className="font-bold text-green-600 text-sm">₹{entry.totalIncentive.toFixed(2)}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'rules' | 'payouts' | 'leaderboard'

export default function IncentivesPage() {
  const navigate = useNavigate()
  const { outletId } = useAuthStore()
  const [tab, setTab] = useState<Tab>('rules')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'rules',       label: 'Incentive Rules', icon: <Target size={15} /> },
    { key: 'payouts',     label: 'Payouts',         icon: <Award size={15} /> },
    { key: 'leaderboard', label: 'Leaderboard',     icon: <Trophy size={15} /> },
  ]

  const effectiveOutletId = outletId ?? 1

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-5">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.28)]">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Content */}
        <div className="relative px-8 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-5 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0 mt-0.5"
              >
                <ArrowLeft size={16} className="text-white" />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
                <Trophy size={26} className="text-yellow-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Staff</p>
                <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Staff Incentives</h1>
                {/* Subtitle + tab pills on the same line */}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <p className="text-sm text-blue-200 whitespace-nowrap">Define rules, track payouts &amp; view leaderboard</p>
                  <div className="w-px h-4 bg-white/20 shrink-0 hidden sm:block" />
                  {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                        tab === t.key
                          ? 'bg-white text-violet-700 border-white shadow-sm'
                          : 'border-white/30 text-white/80 hover:text-white hover:bg-white/10'
                      }`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      {tab === 'rules'       && <RulesTab outletId={effectiveOutletId} />}
      {tab === 'payouts'     && <PayoutsTab outletId={effectiveOutletId} />}
      {tab === 'leaderboard' && <LeaderboardTab outletId={effectiveOutletId} />}
    </div>
  )
}
