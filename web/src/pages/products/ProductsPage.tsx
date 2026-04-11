import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit, Trash2, Package, Upload, Download, FileSpreadsheet, FileText, ChevronDown, X, Barcode, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/services/api'
import { Product } from '@/types'
import ProductImportModal from './ProductImportModal'
import BarcodePrintModal from './BarcodePrintModal'

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [showImport, setShowImport] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [printProduct, setPrintProduct] = useState<Product | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
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
      const res = format === 'csv' ? await productApi.exportCsv() : await productApi.exportExcel()
      const ext = format === 'csv' ? 'csv' : 'xlsx'
      const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }))
      const a = document.createElement('a')
      a.href = url
      a.download = `products_export.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${ext.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => productApi.getAll({ page: 0, size: 100 }).then(r => r.data.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => productApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product deleted') },
  })

  const products: Product[] = data?.content || []
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.includes(search) ||
    p.barcode?.includes(search)
  )
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize)

  return (
    <>
      <div className="min-h-full bg-gray-50/60">

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">

            {/* Title */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                <Package size={18} className="text-primary-600" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-none">Products</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isLoading ? 'Loading…' : `${filtered.length} of ${products.length} products`}
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Search by name, SKU or barcode…"
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition-colors"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(0) }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              {/* Export */}
              <div ref={exportRef} className="relative">
                <button
                  onClick={() => setExportOpen(v => !v)}
                  disabled={exporting}
                  className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Download size={14} />
                  {exporting ? 'Exporting…' : 'Export'}
                  <ChevronDown size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                    <button onClick={() => handleExport('csv')}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <FileText size={14} className="text-green-500" /> Export as CSV
                    </button>
                    <button onClick={() => handleExport('excel')}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <FileSpreadsheet size={14} className="text-emerald-600" /> Export as Excel
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Upload size={14} /> Import
              </button>

              <button
                onClick={() => navigate('/products/new')}
                className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Plus size={15} /> Add Product
              </button>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="p-6">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">SKU / Barcode</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sell Price</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cost</th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50 animate-pulse">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                          <div className="space-y-1.5">
                            <div className="h-3 bg-gray-200 rounded w-32" />
                            <div className="h-2.5 bg-gray-100 rounded w-16" />
                          </div>
                        </div>
                      </td>
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3 bg-gray-100 rounded w-20 ml-auto" />
                        </td>
                      ))}
                      <td />
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                          <Package size={26} className="text-gray-300" />
                        </div>
                        <p className="font-semibold text-gray-500">No products found</p>
                        <p className="text-sm mt-1">
                          {search ? 'Try a different search term' : 'Add your first product to get started'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map((product, idx) => (
                  <tr
                    key={product.id}
                    onClick={() => navigate(`/products/${product.id}/edit`)}
                    className={`group cursor-pointer hover:bg-gray-50/80 transition-colors ${idx < paginated.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    {/* Product */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name}
                            className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package size={15} className="text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-800 leading-tight">{product.name}</p>
                          {product.unitOfMeasure && (
                            <p className="text-xs text-gray-400 mt-0.5">{product.unitOfMeasure}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* SKU / Barcode */}
                    <td className="px-5 py-3.5">
                      {product.sku
                        ? <p className="text-xs font-mono font-medium text-gray-600">{product.sku}</p>
                        : <p className="text-xs text-gray-300">—</p>
                      }
                      {product.barcode && (
                        <p className="text-xs font-mono text-gray-400 mt-0.5">{product.barcode}</p>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-5 py-3.5">
                      {product.category?.name
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                            {product.category.name}
                          </span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>

                    {/* Sell Price */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-bold text-gray-900">₹{product.sellingPrice}</span>
                    </td>

                    {/* Cost */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm text-gray-400">
                        {product.costPrice ? `₹${product.costPrice}` : '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full
                        ${product.active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${product.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {product.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPrintProduct(product)}
                          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="Print Barcode"
                        >
                          <Barcode size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/products/${product.id}/edit`)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => deleteMut.mutate(product.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">
                    {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} products
                  </p>
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30">
                    {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  {totalPages > 1 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pg = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                    return (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={`w-7 h-7 text-xs rounded-lg border transition-colors ${pg === page ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                        {pg + 1}
                      </button>
                    )
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showImport && (
        <ProductImportModal
          onClose={() => setShowImport(false)}
          onImported={() => qc.invalidateQueries({ queryKey: ['products'] })}
        />
      )}

      {printProduct && (
        <BarcodePrintModal
          product={printProduct}
          onClose={() => setPrintProduct(null)}
        />
      )}
    </>
  )
}
