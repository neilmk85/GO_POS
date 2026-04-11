import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Search, ArrowUpDown, ArrowRight, Truck, Package, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react'
import { inventoryApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import AdjustStockModal from './AdjustStockModal'
import { Link } from 'react-router-dom'

function fmt(n: any, d = 4) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v) || v === 0) return '0'
  return v % 1 === 0 ? v.toLocaleString() : parseFloat(v.toFixed(d)).toLocaleString()
}

// Show stock in both base and purchase unit
function StockDisplay({ inv }: { inv: any }) {
  const product      = inv.product
  const qty          = parseFloat(inv.quantityOnHand ?? 0)
  const baseUom      = product?.unitOfMeasure ?? 'pcs'
  const purchaseUom  = product?.purchaseUom
  const factor       = parseFloat(product?.purchaseFactor ?? 1)
  const hasConv      = purchaseUom && factor > 1 && purchaseUom !== baseUom
  const purchaseQty  = hasConv ? qty / factor : null

  return (
    <div className="flex flex-col items-end gap-0.5">
      {/* Base unit (primary) */}
      <span className="text-sm font-bold text-gray-900">
        {fmt(qty)} <span className="text-xs font-normal text-gray-500">{baseUom}</span>
      </span>
      {/* Purchase unit equivalent */}
      {hasConv && purchaseQty !== null && (
        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
          <Truck size={9} />
          {fmt(purchaseQty)} {purchaseUom}
        </span>
      )}
    </div>
  )
}

export default function InventoryPage() {
  const { outletId } = useAuthStore()
  const [search,    setSearch]    = useState('')
  const [tab,       setTab]       = useState<'all' | 'low'>('all')
  const [adjusting, setAdjusting] = useState<any>(null)
  const [page,      setPage]      = useState(0)
  const [pageSize,  setPageSize]  = useState(20)

  // Full inventory for outlet (shows real quantities)
  const { data: allInventory, isLoading: allLoading } = useQuery({
    queryKey: ['inventory', 'all', outletId],
    queryFn: () => inventoryApi.getAllByOutlet(outletId!).then(r => r.data.data),
    enabled: !!outletId,
  })

  const { data: lowStock } = useQuery({
    queryKey: ['inventory', 'low-stock', outletId],
    queryFn: () => inventoryApi.getLowStock(outletId!).then(r => r.data.data),
    enabled: !!outletId,
  })

  const filtered = useMemo(() => {
    const source = tab === 'low' ? (lowStock ?? []) : (allInventory ?? [])
    if (!search.trim()) return source
    const q = search.toLowerCase()
    return source.filter((inv: any) =>
      inv.product?.name?.toLowerCase().includes(q) ||
      inv.product?.sku?.toLowerCase().includes(q)
    )
  }, [tab, allInventory, lowStock, search])

  const totalPages  = Math.ceil(filtered.length / pageSize)
  const displayItems = filtered.slice(page * pageSize, (page + 1) * pageSize)

  // Stats
  const totalProducts   = allInventory?.length ?? 0
  const lowStockCount   = lowStock?.length ?? 0
  const withConversion  = (allInventory ?? []).filter((i: any) => (i.product?.purchaseFactor ?? 1) > 1).length

  return (
    <div className="min-h-full bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Real-time stock levels · Quantities shown in base units with purchase-unit equivalent
            </p>
          </div>
          <Link
            to="/inventory/bulk-purchase"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-200"
          >
            <ShoppingBag size={15} />
            Bulk Purchase
          </Link>
        </div>

        {/* Mini stats */}
        <div className="flex gap-4 mt-4">
          {[
            { label: 'Total Products', value: totalProducts, color: 'text-gray-800', bg: 'bg-gray-100' },
            { label: 'Low Stock',      value: lowStockCount, color: 'text-red-700',  bg: 'bg-red-50'   },
            { label: 'UoM Conversion', value: withConversion, color: 'text-indigo-700', bg: 'bg-indigo-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl px-4 py-2 flex items-center gap-2`}>
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Tabs + Search */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { key: 'all', label: `All (${totalProducts})` },
              { key: 'low', label: `Low Stock (${lowStockCount})` },
            ].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key as any); setPage(0) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search products…"
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl w-full focus:ring-2 focus:ring-indigo-300 focus:outline-none text-sm bg-white" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Unit Config</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">On Hand</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Reorder Level</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Loading inventory…</td>
                </tr>
              ) : displayItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Package size={28} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No items found</p>
                  </td>
                </tr>
              ) : displayItems.map((inv: any) => {
                const product    = inv.product
                const qty        = parseFloat(inv.quantityOnHand ?? 0)
                const reorder    = inv.reorderLevel ?? product?.reorderLevel ?? 10
                const isLow      = qty <= reorder
                const baseUom    = product?.unitOfMeasure ?? 'pcs'
                const purchaseUom = product?.purchaseUom
                const factor     = parseFloat(product?.purchaseFactor ?? 1)
                const saleUom    = product?.saleUom
                const saleFactor = parseFloat(product?.saleFactor ?? 1)
                const hasConv    = factor > 1 && purchaseUom && purchaseUom !== baseUom

                return (
                  <tr key={inv.id} className={`hover:bg-gray-50 transition-colors ${tab === 'low' && isLow ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm text-gray-900">{product?.name}</p>
                      <p className="text-xs text-gray-400">{product?.sku}</p>
                    </td>

                    {/* Unit config */}
                    <td className="px-4 py-3">
                      {hasConv ? (
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Truck size={9} /> {purchaseUom}
                          </span>
                          <ArrowRight size={10} className="text-gray-300" />
                          <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md">
                            {baseUom}
                          </span>
                          {saleUom && saleFactor > 1 && saleUom !== baseUom && (
                            <>
                              <ArrowRight size={10} className="text-gray-300" />
                              <span className="text-[11px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-md">
                                {saleUom}
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 block text-center">—</span>
                      )}
                    </td>

                    {/* On hand - dual units */}
                    <td className="px-4 py-3 text-right">
                      <StockDisplay inv={inv} />
                    </td>

                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {reorder} <span className="text-xs text-gray-400">{baseUom}</span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full font-medium">
                          <AlertTriangle size={10} /> Low Stock
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium">
                          OK
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setAdjusting(inv)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1 ml-auto bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                        <ArrowUpDown size={12} /> Adjust
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} items
                </p>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(0, Math.min(page - 2, totalPages - 5))
                    const p = start + i
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                          p === page ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-white'
                        }`}>
                        {p + 1}
                      </button>
                    )
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        {withConversion > 0 && (
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span className="font-medium text-gray-600">Legend:</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Purchase unit</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400"></span> Base / stock unit</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Sale unit</span>
          </div>
        )}
      </div>

      {adjusting && (
        <AdjustStockModal
          inventory={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => setAdjusting(null)}
        />
      )}
    </div>
  )
}
