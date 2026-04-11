import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, X, Loader2, ChevronRight,
  FolderOpen, Folder, ToggleLeft, ToggleRight, Search, Tag, Layers, CheckCircle2, GitBranch,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { categoryApi } from '@/services/api'

// ─── Category Form Modal ──────────────────────────────────────────────────────

function CategoryFormModal({
  initial,
  allCategories,
  onClose,
  onSaved,
}: {
  initial?: any
  allCategories: any[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const [name, setName]         = useState(initial?.name ?? '')
  const [description, setDesc]  = useState(initial?.description ?? '')
  const [parentId, setParentId] = useState<number | ''>(initial?.parentId ?? '')
  const [displayOrder, setOrder] = useState<number>(initial?.displayOrder ?? 0)
  const [submitting, setSubmitting] = useState(false)

  // Parents: only root categories (avoid circular), exclude self
  const parentOptions = allCategories.filter(
    c => !c.parentId && c.id !== initial?.id
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required'); return }
    setSubmitting(true)
    const payload: any = {
      name,
      description: description || null,
      displayOrder,
      parentId: parentId || null,
    }
    try {
      if (isEdit) {
        await categoryApi.update(initial.id, payload)
        toast.success('Category updated')
      } else {
        await categoryApi.create(payload)
        toast.success('Category created')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save category')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Edit Category' : 'New Category'}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Electronics, Beverages…"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              placeholder="Optional description…"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Parent category */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Parent Category</label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">— None (root category) —</option>
              {parentOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Display order */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Display Order</label>
            <input
              type="number"
              min={0}
              value={displayOrder}
              onChange={e => setOrder(parseInt(e.target.value) || 0)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {isEdit ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Category Row ──────────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  depth,
  allCategories,
  onEdit,
  onDelete,
  onToggle,
}: {
  cat: any
  depth: number
  allCategories: any[]
  onEdit: (c: any) => void
  onDelete: (c: any) => void
  onToggle: (c: any) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const children = allCategories.filter(c => c.parentId === cat.id)

  return (
    <>
      <tr className={`group hover:bg-gray-50 transition-colors ${!cat.active ? 'opacity-50' : ''}`}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
            {children.length > 0 ? (
              <button onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-600">
                {expanded
                  ? <FolderOpen size={16} className="text-yellow-500" />
                  : <Folder size={16} className="text-yellow-500" />
                }
              </button>
            ) : (
              <Tag size={14} className="text-gray-300 ml-0.5" />
            )}
            <span className="text-sm font-medium text-gray-800">{cat.name}</span>
            {children.length > 0 && (
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {children.length} sub
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
          {cat.description ?? <span className="text-gray-300 italic">—</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 text-center">
          {cat.parentId ? (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              <ChevronRight size={10} />{cat.parentName}
            </span>
          ) : (
            <span className="text-xs text-gray-300 italic">Root</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 text-center">{cat.displayOrder}</td>
        <td className="px-4 py-3 text-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            cat.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {cat.active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 justify-end">
            <button onClick={() => onToggle(cat)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
              title={cat.active ? 'Deactivate' : 'Activate'}>
              {cat.active
                ? <ToggleRight size={16} className="text-green-500" />
                : <ToggleLeft size={16} />}
            </button>
            <button onClick={() => onEdit(cat)}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600">
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(cat)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      {expanded && children
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(child => (
          <CategoryRow
            key={child.id}
            cat={child}
            depth={depth + 1}
            allCategories={allCategories}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
          />
        ))}
    </>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ cat, onClose, onDeleted }: {
  cat: any
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await categoryApi.delete(cat.id)
      toast.success('Category deleted')
      onDeleted()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to delete category')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Delete Category?</h3>
        <p className="text-sm text-gray-500 mb-5">
          Are you sure you want to delete <span className="font-semibold text-gray-800">"{cat.name}"</span>?
          This cannot be undone. Categories with products or subcategories cannot be deleted.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const qc = useQueryClient()
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [filter, setFilter]     = useState<'all' | 'active' | 'inactive'>('all')

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoryApi.getAll()
      return (res.data.data ?? []) as any[]
    },
  })

  async function handleToggle(cat: any) {
    try {
      await categoryApi.toggleActive(cat.id)
      toast.success(`Category ${cat.active ? 'deactivated' : 'activated'}`)
      qc.invalidateQueries({ queryKey: ['categories'] })
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to update status')
    }
  }

  const filtered = categories.filter((c: any) => {
    const matchSearch = !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'active' ? c.active : !c.active)
    return matchSearch && matchFilter
  })

  // Only root categories at the top level of the tree
  const rootCategories = filtered
    .filter((c: any) => !c.parentId)
    .sort((a: any, b: any) => a.displayOrder - b.displayOrder)

  const activeCount   = categories.filter((c: any) => c.active).length
  const inactiveCount = categories.filter((c: any) => !c.active).length
  const rootCount     = categories.filter((c: any) => !c.parentId).length

  function onSaved() {
    qc.invalidateQueries({ queryKey: ['categories'] })
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categories</h1>
          <p className="text-xs text-gray-500 mt-0.5">Organise products into categories</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={15} /> New Category
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Total Categories', value: categories.length, icon: <Layers size={18} />,       gradient: 'from-blue-500 to-indigo-600'   },
          { label: 'Active',           value: activeCount,       icon: <CheckCircle2 size={18} />,  gradient: 'from-emerald-500 to-teal-600'  },
          { label: 'Root Categories',  value: rootCount,         icon: <GitBranch size={18} />,     gradient: 'from-violet-500 to-purple-600' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white shrink-0 shadow-sm`}>
              {card.icon}
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{card.label}</p>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search categories…"
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                filter === f ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {f}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} categor{filtered.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 text-[11px] text-gray-600 uppercase tracking-wide shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-center">Parent</th>
              <th className="px-4 py-3 text-center">Order</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={6} className="py-16 text-center">
                <Loader2 size={24} className="animate-spin text-gray-300 mx-auto" />
              </td></tr>
            ) : rootCategories.length === 0 ? (
              <tr><td colSpan={6} className="py-16 text-center">
                <FolderOpen size={36} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No categories found</p>
                <button onClick={() => { setEditing(null); setShowForm(true) }}
                  className="mt-3 text-sm text-primary-600 hover:underline">
                  Create your first category
                </button>
              </td></tr>
            ) : rootCategories.map((cat: any) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                depth={0}
                allCategories={filtered}
                onEdit={c => { setEditing(c); setShowForm(true) }}
                onDelete={c => setDeleting(c)}
                onToggle={handleToggle}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CategoryFormModal
          initial={editing}
          allCategories={categories}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={onSaved}
        />
      )}
      {deleting && (
        <DeleteConfirmModal
          cat={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={onSaved}
        />
      )}
    </div>
  )
}
