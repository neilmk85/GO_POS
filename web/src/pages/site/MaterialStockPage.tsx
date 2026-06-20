import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Archive,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  PackageCheck,
} from 'lucide-react'
import { materialReceiptApi, siteProjectApi } from '@/services/api'

const UNITS = ['Nos', 'm', 'm²', 'm³', 'RMT', 'MT', 'KG', 'Bags', 'Litres', 'LS']

interface StockEntry {
  materialName: string
  specification: string
  unit: string
  totalReceived: string
  issuedContractor: string
  issuedInhouse: string
  balance: string
}

interface Receipt {
  id: number
  siteProjectId: number
  materialName: string
  specification?: string
  unit: string
  qty: string
  supplierName?: string
  invoiceNo?: string
  receivedDate: string
  receivedBy?: string
  vehicleNo?: string
  notes?: string
}

function ReceivePanel({
  siteProjectId,
  editing,
  onClose,
}: {
  siteProjectId: number
  editing: Receipt | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    materialName: editing?.materialName ?? '',
    specification: editing?.specification ?? '',
    unit: editing?.unit ?? 'Nos',
    qty: editing ? String(editing.qty) : '1',
    supplierName: editing?.supplierName ?? '',
    invoiceNo: editing?.invoiceNo ?? '',
    receivedDate: editing?.receivedDate ?? today,
    receivedBy: editing?.receivedBy ?? '',
    vehicleNo: editing?.vehicleNo ?? '',
    notes: editing?.notes ?? '',
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const saveMutation = useMutation({
    mutationFn: (d: typeof form) =>
      editing
        ? materialReceiptApi.update(editing.id, { ...d, siteProjectId })
        : materialReceiptApi.create({ ...d, siteProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-material-receipts', siteProjectId] })
      queryClient.invalidateQueries({ queryKey: ['site-stock-register', siteProjectId] })
      toast.success(editing ? 'Receipt updated' : 'Material receipt recorded')
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
            {editing ? 'Edit Receipt' : 'Receive Material'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Material Name</label>
            <input value={form.materialName} onChange={(e) => set('materialName', e.target.value)}
              placeholder="e.g. PSC Pipe 600mm dia"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Specification</label>
            <input value={form.specification} onChange={(e) => set('specification', e.target.value)}
              placeholder="e.g. IS 784, NP3"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Qty Received</label>
              <input type="number" step="0.001" min="0" value={form.qty}
                onChange={(e) => set('qty', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
              <div className="relative">
                <select value={form.unit} onChange={(e) => set('unit', e.target.value)}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
              <input value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)}
                placeholder="Supplier name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Invoice No.</label>
              <input value={form.invoiceNo} onChange={(e) => set('invoiceNo', e.target.value)}
                placeholder="INV/2025/001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Received Date</label>
            <input type="date" value={form.receivedDate} onChange={(e) => set('receivedDate', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Received By</label>
              <input value={form.receivedBy} onChange={(e) => set('receivedBy', e.target.value)}
                placeholder="Store keeper / Engineer"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle No.</label>
              <input value={form.vehicleNo} onChange={(e) => set('vehicleNo', e.target.value)}
                placeholder="GJ 01 AB 1234"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={2} placeholder="Optional remarks"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending || !form.materialName || !form.receivedDate}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60">
            {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Record Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MaterialStockPage() {
  const queryClient = useQueryClient()
  const [selectedProject, setSelectedProject] = useState('')
  const [activeTab, setActiveTab] = useState<'register' | 'receipts'>('register')
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<Receipt | null>(null)

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll(),
  })
  const projects: any[] = projectsData?.data?.data ?? []
  const projectId = selectedProject ? Number(selectedProject) : 0

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['site-stock-register', projectId],
    queryFn: () => materialReceiptApi.getStockRegister(projectId),
    enabled: !!projectId,
  })

  const { data: receiptsData, isLoading: receiptsLoading } = useQuery({
    queryKey: ['site-material-receipts', projectId],
    queryFn: () => materialReceiptApi.getByProject(projectId),
    enabled: !!projectId,
  })

  const deleteMutation = useMutation({
    mutationFn: materialReceiptApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-material-receipts', projectId] })
      queryClient.invalidateQueries({ queryKey: ['site-stock-register', projectId] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const stockEntries: StockEntry[] = stockData?.data?.data ?? []
  const receipts: Receipt[] = receiptsData?.data?.data ?? []

  const lowStock = stockEntries.filter((e) => Number(e.balance) <= 0)
  const totalItems = stockEntries.length

  const openNew = () => { setEditing(null); setPanelOpen(true) }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center">
            <Archive size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Material Stock</h1>
            <p className="text-sm text-gray-500">Receipts, issues & running balance per project</p>
          </div>
        </div>
        <button onClick={openNew}
          disabled={!selectedProject}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors">
          <Plus size={16} />
          Receive Material
        </button>
      </div>

      {/* Project selector */}
      <div className="flex gap-4 mb-6">
        <div className="relative">
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[240px]">
            <option value="">Select project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {!selectedProject ? (
        <div className="text-center py-20 text-gray-400">
          <Archive size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a project to view stock</p>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <PackageCheck size={16} className="text-blue-600" />
                <span className="text-xs text-blue-600 font-medium">Materials Tracked</span>
              </div>
              <p className="text-2xl font-bold text-blue-800">{totalItems}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-green-600" />
                <span className="text-xs text-green-600 font-medium">Total Receipts</span>
              </div>
              <p className="text-2xl font-bold text-green-800">{receipts.length}</p>
            </div>
            <div className={`border rounded-xl px-5 py-4 ${lowStock.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {lowStock.length > 0
                  ? <AlertTriangle size={16} className="text-red-600" />
                  : <TrendingDown size={16} className="text-gray-400" />}
                <span className={`text-xs font-medium ${lowStock.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  Zero / Negative Balance
                </span>
              </div>
              <p className={`text-2xl font-bold ${lowStock.length > 0 ? 'text-red-700' : 'text-gray-600'}`}>
                {lowStock.length}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
            {(['register', 'receipts'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}>
                {tab === 'register' ? 'Stock Register' : `Receipts (${receipts.length})`}
              </button>
            ))}
          </div>

          {/* Stock Register tab */}
          {activeTab === 'register' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {stockLoading ? (
                <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
              ) : stockEntries.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Archive size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No materials received yet.</p>
                  <button onClick={openNew} className="mt-2 text-sm text-indigo-600 hover:underline">
                    + Record first receipt
                  </button>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Material</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Received</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">→ Contractor</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">→ Inhouse</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stockEntries.map((entry, i) => {
                      const balance = Number(entry.balance)
                      const balanceColor = balance < 0
                        ? 'text-red-700 font-bold'
                        : balance === 0
                        ? 'text-gray-400'
                        : 'text-green-700 font-semibold'
                      return (
                        <tr key={i} className={`hover:bg-gray-50 ${balance < 0 ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{entry.materialName}</div>
                            {entry.specification && (
                              <div className="text-xs text-gray-400">{entry.specification}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {entry.totalReceived} <span className="text-gray-400 text-xs">{entry.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-orange-600">
                            {Number(entry.issuedContractor) > 0
                              ? <>{entry.issuedContractor} <span className="text-gray-400 text-xs">{entry.unit}</span></>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-indigo-600">
                            {Number(entry.issuedInhouse) > 0
                              ? <>{entry.issuedInhouse} <span className="text-gray-400 text-xs">{entry.unit}</span></>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right ${balanceColor}`}>
                            {balance < 0 && <AlertTriangle size={12} className="inline mr-1" />}
                            {entry.balance} <span className="text-gray-400 text-xs font-normal">{entry.unit}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Receipts tab */}
          {activeTab === 'receipts' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {receiptsLoading ? (
                <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
              ) : receipts.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-sm">No receipts yet.</p>
                  <button onClick={openNew} className="mt-2 text-sm text-indigo-600 hover:underline">+ Record first receipt</button>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Material</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Qty</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {receipts.map((rec) => (
                      <tr key={rec.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{rec.receivedDate}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{rec.materialName}</div>
                          {rec.specification && <div className="text-xs text-gray-400">{rec.specification}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">
                          {rec.qty} <span className="text-gray-400 font-normal">{rec.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{rec.supplierName ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{rec.invoiceNo ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{rec.vehicleNo ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setEditing(rec); setPanelOpen(true) }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Pencil size={14} /></button>
                            <button onClick={() => window.confirm('Delete this receipt?') && deleteMutation.mutate(rec.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {panelOpen && (
        <ReceivePanel
          siteProjectId={projectId}
          editing={editing}
          onClose={() => { setPanelOpen(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
