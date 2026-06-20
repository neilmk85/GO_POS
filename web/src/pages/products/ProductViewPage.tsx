import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Edit, Package, Tag, Layers, Truck, ShoppingCart,
  BarChart2, CheckCircle, XCircle, Star, Barcode, FileText,
  DollarSign, FlaskConical, RefreshCw,
} from 'lucide-react'
import { productApi, variantApi } from '@/services/api'

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
    blue:   'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
    amber:  'bg-amber-100 text-amber-700',
    gray:   'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${colors[color] ?? colors.gray}`}>
      {children}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 font-medium w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-semibold text-right flex-1">{value ?? <span className="text-gray-300">—</span>}</span>
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        {icon && <div className="text-violet-500">{icon}</div>}
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  )
}

function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '—'
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ProductViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productApi.getById(Number(id)).then(r => r.data.data),
    enabled: !!id,
  })

  const { data: variants = [] } = useQuery({
    queryKey: ['variants', id],
    queryFn: () => variantApi.getAll(Number(id)).then(r => r.data.data ?? []),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading product…
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Product not found.
      </div>
    )
  }

  const isPipe    = product.itemType === 'FINISHED_PIPE'
  const hasConv   = product.purchaseUom && (product.purchaseFactor ?? 1) > 1 && product.purchaseUom !== product.unitOfMeasure
  const primaryImg = product.images?.find((i: any) => i.primary)?.imageUrl ?? product.imageUrl ?? null

  return (
    <>
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/products')}
                className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                {primaryImg
                  ? <img src={primaryImg} alt={product.name} className="w-full h-full object-cover rounded-xl" />
                  : <Package size={18} className="text-white" />
                }
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">{product.name}</h1>
                <p className="text-xs text-white/70">{product.sku ?? 'No SKU'} · {product.category?.name ?? 'Uncategorised'}</p>
              </div>
            </div>

            {/* Edit button */}
            <button
              onClick={() => navigate(`/products/${id}/edit`)}
              className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm"
            >
              <Edit size={15} /> Edit Product
            </button>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Badge color={product.active ? 'green' : 'red'}>
              {product.active ? <CheckCircle size={11} /> : <XCircle size={11} />}
              {product.active ? 'Active' : 'Inactive'}
            </Badge>
            {product.featured && <Badge color="amber"><Star size={11} /> Featured</Badge>}
            <Badge color="violet">
              {product.itemType === 'RAW_MATERIAL' ? 'Raw Material'
                : product.itemType === 'FINISHED_PIPE' ? 'Finished Pipe'
                : 'General'}
            </Badge>
            {product.taxGroup && (
              <Badge color="blue"><FlaskConical size={11} /> {product.taxGroup.name}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Basic Info */}
          <Card title="Product Details" icon={<Package size={15} />}>
            <InfoRow label="Product Name"  value={product.name} />
            <InfoRow label="SKU"           value={product.sku} />
            <InfoRow label="Barcode"       value={
              product.barcode
                ? <span className="flex items-center gap-1 justify-end"><Barcode size={12} /> {product.barcode}</span>
                : null
            } />
            <InfoRow label="Description"   value={product.description || null} />
            <InfoRow label="Category"      value={product.category?.name} />
            <InfoRow label="HSN Code"      value={(product as any).hsnCode} />
            <InfoRow label="Product Type"  value={product.productType} />
            <InfoRow label="Item Type"     value={
              product.itemType === 'RAW_MATERIAL' ? 'Raw Material'
              : product.itemType === 'FINISHED_PIPE' ? 'Finished Pipe'
              : 'General'
            } />
          </Card>

          {/* Pricing — only for pipes */}
          {isPipe && (
            <Card title="Pricing" icon={<DollarSign size={15} />}>
              <InfoRow label="Selling Price" value={fmtCur(product.sellingPrice)} />
              <InfoRow label="Cost Price"    value={fmtCur(product.costPrice)} />
              <InfoRow label="MRP"           value={fmtCur(product.mrp)} />
              {product.minSellingPrice != null && (
                <InfoRow label="Min Selling Price" value={fmtCur(product.minSellingPrice)} />
              )}
              <InfoRow label="Tax Group"     value={
                product.taxGroup
                  ? `${product.taxGroup.name} (${product.taxGroup.totalRate}%)`
                  : null
              } />
            </Card>
          )}

          {/* UoM & Inventory */}
          <Card title="Units & Inventory" icon={<Truck size={15} />}>
            <InfoRow label="Base Unit"       value={product.unitOfMeasure} />
            {hasConv && (
              <>
                <InfoRow label="Purchase Unit"   value={product.purchaseUom} />
                <InfoRow label="Purchase Factor" value={`1 ${product.purchaseUom} = ${product.purchaseFactor} ${product.unitOfMeasure}`} />
              </>
            )}
            {(product as any).saleUom && (product as any).saleFactor > 1 && (
              <InfoRow label="Sale Unit"       value={`1 ${(product as any).saleUom} = ${(product as any).saleFactor} ${product.unitOfMeasure}`} />
            )}
            <InfoRow label="Reorder Level"   value={`${product.reorderLevel} ${product.unitOfMeasure}`} />
            <InfoRow label="Track Inventory" value={
              product.trackInventory
                ? <Badge color="green"><CheckCircle size={10} /> Yes</Badge>
                : <Badge color="gray"><XCircle size={10} /> No</Badge>
            } />
          </Card>

          {/* Variants */}
          {(variants as any[]).length > 0 && (
            <Card title={`Variants (${(variants as any[]).length})`} icon={<Layers size={15} />}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs text-gray-500 font-semibold py-2">Variant</th>
                      <th className="text-left text-xs text-gray-500 font-semibold py-2">SKU</th>
                      <th className="text-right text-xs text-gray-500 font-semibold py-2">Price Adj.</th>
                      <th className="text-center text-xs text-gray-500 font-semibold py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(variants as any[]).map((v: any) => (
                      <tr key={v.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 text-gray-800 font-medium">
                          {[v.attribute1Value, v.attribute2Value].filter(Boolean).join(' / ')}
                        </td>
                        <td className="py-2 text-gray-500 text-xs">{v.sku ?? '—'}</td>
                        <td className="py-2 text-right text-gray-700">
                          {v.priceAdjustment != null && v.priceAdjustment !== 0 ? fmtCur(v.priceAdjustment) : '—'}
                        </td>
                        <td className="py-2 text-center">
                          <Badge color={v.active ? 'green' : 'gray'}>{v.active ? 'Active' : 'Inactive'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Product Image */}
          <Card title="Product Image" icon={<Package size={15} />}>
            {primaryImg ? (
              <img src={primaryImg} alt={product.name}
                className="w-full aspect-square object-cover rounded-xl border border-gray-100" />
            ) : (
              <div className="w-full aspect-square bg-gray-50 rounded-xl flex flex-col items-center justify-center text-gray-300 border border-dashed border-gray-200">
                <Package size={40} className="mb-2" />
                <p className="text-xs">No image</p>
              </div>
            )}
          </Card>

          {/* Tax & GST */}
          <Card title="Tax & GST" icon={<FileText size={15} />}>
            <InfoRow label="Tax Group" value={
              product.taxGroup
                ? `${product.taxGroup.name} (${product.taxGroup.totalRate}%)`
                : null
            } />
            <InfoRow label="HSN Code" value={(product as any).hsnCode} />
            {product.taxGroup && (
              <>
                {product.taxGroup.cgstRate > 0 && <InfoRow label="CGST" value={`${product.taxGroup.cgstRate}%`} />}
                {product.taxGroup.sgstRate > 0 && <InfoRow label="SGST" value={`${product.taxGroup.sgstRate}%`} />}
                {product.taxGroup.igstRate > 0 && <InfoRow label="IGST" value={`${product.taxGroup.igstRate}%`} />}
              </>
            )}
          </Card>

          {/* Flags */}
          <Card title="Settings" icon={<BarChart2 size={15} />}>
            <div className="space-y-3 py-1">
              {[
                { label: 'Active',           val: product.active },
                { label: 'Featured',         val: product.featured },
                { label: 'Track Inventory',  val: product.trackInventory },
                { label: 'Purchasable',      val: (product as any).purchasable !== false },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">{label}</span>
                  <Badge color={val ? 'green' : 'gray'}>
                    {val ? <CheckCircle size={10} /> : <XCircle size={10} />}
                    {val ? 'Yes' : 'No'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="space-y-2">
            <button
              onClick={() => navigate(`/products/${id}/edit`)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm"
            >
              <Edit size={15} /> Edit Product
            </button>
            <button
              onClick={() => navigate('/products')}
              className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            >
              <ArrowLeft size={15} /> Back to Products
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
