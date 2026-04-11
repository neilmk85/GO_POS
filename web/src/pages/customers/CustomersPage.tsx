import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, User, Star, AlertCircle, Upload, Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { customerApi } from '@/services/api'
import { Customer } from '@/types'
import CustomerForm from './CustomerForm'
import CustomerImportModal from './CustomerImportModal'

const segmentBadge: Record<string, string> = {
  REGULAR: 'bg-gray-100 text-gray-700',
  SILVER: 'bg-slate-200 text-slate-800',
  GOLD: 'bg-yellow-100 text-yellow-800',
  VIP: 'bg-purple-100 text-purple-800',
  WHOLESALE: 'bg-blue-100 text-blue-800',
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [searchResults, setSearchResults] = useState<Customer[] | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleExport(format: 'csv' | 'excel') {
    setExportOpen(false)
    setExporting(true)
    try {
      const res = format === 'csv' ? await customerApi.exportCsv() : await customerApi.exportExcel()
      const ext = format === 'csv' ? 'csv' : 'xlsx'
      const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }))
      const a = document.createElement('a')
      a.href = url; a.download = `customers_export.${ext}`; a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${ext.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.getAll({ page: 0, size: 100 }).then(r => r.data.data),
  })

  const handleSearch = async (q: string) => {
    setSearch(q)
    if (!q.trim()) { setSearchResults(null); return }
    const res = await customerApi.search(q)
    setSearchResults(res.data.data)
  }

  const customers: Customer[] = searchResults || data?.content || []

  return (
    <>
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setExportOpen(v => !v)}
              disabled={exporting}
              className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              <Download size={15} />
              {exporting ? 'Exporting…' : 'Export'}
              <ChevronDown size={13} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white border rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                <button onClick={() => handleExport('csv')}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <FileText size={15} className="text-green-500" /> Export as CSV
                </button>
                <button onClick={() => handleExport('excel')}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <FileSpreadsheet size={15} className="text-emerald-600" /> Export as Excel
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            <Upload size={15} /> Import
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
          >
            <Plus size={18} /> Add Customer
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, phone or email..."
          className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg w-full max-w-md focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Phone / Email</th>
              <th className="px-4 py-3 text-center">Segment</th>
              <th className="px-4 py-3 text-right">Total Spent</th>
              <th className="px-4 py-3 text-right">Loyalty Points</th>
              <th className="px-4 py-3 text-right">Due Amount</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No customers found</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
                      <User size={16} className="text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.city}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <p>{c.phone}</p>
                  <p className="text-xs text-gray-400">{c.email}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${segmentBadge[c.segment] || ''}`}>
                    {c.segment}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">₹{c.totalSpent?.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-1 text-yellow-600">
                    <Star size={12} />
                    <span>{c.loyaltyPoints}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {c.outstandingDue > 0 ? (
                    <span className="text-red-600 font-medium flex items-center justify-end gap-1">
                      <AlertCircle size={12} />
                      ₹{c.outstandingDue}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => { setEditing(c); setShowForm(true) }}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CustomerForm
          customer={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['customers'] }) }}
        />
      )}
    </div>
    {showImport && (
      <CustomerImportModal
        onClose={() => setShowImport(false)}
        onImported={() => qc.invalidateQueries({ queryKey: ['customers'] })}
      />
    )}
    </>
  )
}
