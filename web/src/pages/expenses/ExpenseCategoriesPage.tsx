import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tag, Plus, X, Pencil, Trash2, Loader2, ShieldCheck,
  Building2, Zap, Droplets, Users, Package, Truck,
  Wrench, Coins, Sparkles, Megaphone, Pencil as PencilIcon,
  MoreHorizontal, Receipt, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { expenseCategoryApi } from '@/services/api'

const ICON_OPTIONS = [
  { key: 'receipt',          label: 'Receipt',     node: <Receipt size={16} /> },
  { key: 'building-2',       label: 'Building',    node: <Building2 size={16} /> },
  { key: 'zap',              label: 'Electricity', node: <Zap size={16} /> },
  { key: 'droplets',         label: 'Water',       node: <Droplets size={16} /> },
  { key: 'users',            label: 'People',      node: <Users size={16} /> },
  { key: 'package',          label: 'Package',     node: <Package size={16} /> },
  { key: 'truck',            label: 'Truck',       node: <Truck size={16} /> },
  { key: 'wrench',           label: 'Wrench',      node: <Wrench size={16} /> },
  { key: 'coins',            label: 'Coins',       node: <Coins size={16} /> },
  { key: 'sparkles',         label: 'Sparkles',    node: <Sparkles size={16} /> },
  { key: 'megaphone',        label: 'Megaphone',   node: <Megaphone size={16} /> },
  { key: 'pencil',           label: 'Pencil',      node: <PencilIcon size={16} /> },
  { key: 'more-horizontal',  label: 'More',        node: <MoreHorizontal size={16} /> },
  { key: 'tag',              label: 'Tag',         node: <Tag size={16} /> },
]

const PRESET_COLORS = [
  '#8B5CF6', '#F59E0B', '#3B82F6', '#10B981',
  '#F97316', '#06B6D4', '#EF4444', '#84CC16',
  '#14B8A6', '#EC4899', '#A855F7', '#6B7280',
]

const ICON_MAP: Record<string, React.ReactNode> = Object.fromEntries(
  ICON_OPTIONS.map(o => [o.key, o.node])
)

function CategoryIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0"
      style={{ backgroundColor: color + '22', color }}>
      {ICON_MAP[icon] ?? <Receipt size={16} />}
    </span>
  )
}

// ─── Category Form Modal ───────────────────────────────────────────────────────
function CategoryFormModal({ category, onClose, onSaved }: {
  category: any | null
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!category

  const [name, setName]             = useState(category?.name ?? '')
  const [description, setDesc]      = useState(category?.description ?? '')
  const [color, setColor]           = useState(category?.color ?? '#8B5CF6')
  const [icon, setIcon]             = useState(category?.icon ?? 'receipt')
  const [monthlyBudget, setBudget]  = useState(category?.monthlyBudget ?? '')

  const saveMut = useMutation({
    mutationFn: () => {
      const budget = parseFloat(String(monthlyBudget)) || null
      return isEdit
        ? expenseCategoryApi.update(category.id, { name, description, color, icon, monthlyBudget: budget })
        : expenseCategoryApi.create({ name, description, color, icon, monthlyBudget: budget })
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Category updated' : 'Category created')
      qc.invalidateQueries({ queryKey: ['expense-categories'] })
      onSaved()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save'),
  })

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <CategoryIcon icon={icon} color={color} />
            <div>
              <h2 className="text-sm font-bold text-gray-900">{isEdit ? 'Edit Category' : 'New Category'}</h2>
              <p className="text-xs text-gray-400">{name || 'Untitled'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name <span className="text-red-400">*</span></label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Maintenance"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
            <input
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Optional description"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monthly Budget (₹)</label>
            <input
              type="number" min="0" step="100"
              value={monthlyBudget}
              onChange={e => setBudget(e.target.value)}
              placeholder="e.g. 5000 — leave blank for no limit"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">You'll see a warning when 80% of this budget is spent in the month.</p>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg transition-transform ${color === c ? 'scale-125 ring-2 ring-white ring-offset-1' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-7 h-7 rounded-lg border border-gray-200 cursor-pointer p-0.5" title="Custom color" />
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(o => (
                <button key={o.key} onClick={() => setIcon(o.key)}
                  title={o.label}
                  className={`p-2 rounded-xl border transition-all ${
                    icon === o.key
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                  }`}
                  style={icon === o.key ? { borderColor: color, backgroundColor: color + '15', color } : {}}
                >
                  {o.node}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-between bg-gray-50">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-white">
            Cancel
          </button>
          <button
            disabled={!name.trim() || saveMut.isPending}
            onClick={() => saveMut.mutate()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saveMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={14} /> {isEdit ? 'Update' : 'Create'}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ExpenseCategoriesPage() {
  const qc = useQueryClient()

  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<any | null>(null)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => expenseCategoryApi.getAll(false).then(r => r.data.data ?? []),
  })

  const toggleMut = useMutation({
    mutationFn: (id: number) => expenseCategoryApi.toggleActive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense-categories'] }),
    onError: () => toast.error('Failed to update'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => expenseCategoryApi.delete(id),
    onSuccess: () => {
      toast.success('Category deleted')
      qc.invalidateQueries({ queryKey: ['expense-categories'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to delete'),
  })

  function handleDelete(cat: any) {
    if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return
    deleteMut.mutate(cat.id)
  }

  const systemCats  = categories.filter((c: any) => c.system)
  const customCats  = categories.filter((c: any) => !c.system)

  return (
    <div className="min-h-full bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Tag size={17} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Expense Categories</h1>
              <p className="text-xs text-gray-400 mt-0.5">Manage how your expenses are classified</p>
            </div>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus size={15} /> New Category
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* System Categories */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-gray-400" />
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">System Categories</h2>
            <span className="text-xs text-gray-300">— predefined, cannot be deleted</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-gray-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded-full w-32" />
                    <div className="h-2.5 bg-gray-100 rounded-full w-48" />
                  </div>
                </div>
              ))
            ) : systemCats.map((cat: any) => (
              <div key={cat.id} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${!cat.active ? 'opacity-50' : ''}`}>
                <CategoryIcon icon={cat.icon} color={cat.color} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800">{cat.name}</p>
                    <ShieldCheck size={11} className="text-gray-300" />
                  </div>
                  {cat.description && <p className="text-xs text-gray-400 truncate">{cat.description}</p>}
                  {cat.monthlyBudget && <p className="text-[11px] text-indigo-400 font-medium">Budget: ₹{parseFloat(cat.monthlyBudget).toLocaleString('en-IN')}/mo</p>}
                </div>
                <button
                  onClick={() => toggleMut.mutate(cat.id)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                    cat.active
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {cat.active ? 'Active' : 'Inactive'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Categories */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Tag size={14} className="text-gray-400" />
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Custom Categories</h2>
          </div>
          {customCats.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center">
              <Tag size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No custom categories yet</p>
              <button onClick={() => { setEditing(null); setShowForm(true) }}
                className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                + Create your first category
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {customCats.map((cat: any) => (
                <div key={cat.id} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${!cat.active ? 'opacity-50' : ''}`}>
                  <CategoryIcon icon={cat.icon} color={cat.color} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-400 truncate">{cat.description}</p>}
                  {cat.monthlyBudget && <p className="text-[11px] text-indigo-400 font-medium">Budget: ₹{parseFloat(cat.monthlyBudget).toLocaleString('en-IN')}/mo</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleMut.mutate(cat.id)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                        cat.active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {cat.active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => { setEditing(cat); setShowForm(true) }}
                      className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <CategoryFormModal
          category={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
