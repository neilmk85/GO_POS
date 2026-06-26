import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Package, ImagePlus, X, Star, ArrowRight, Truck, ShoppingCart, FlaskConical, RefreshCw, Barcode, Plus, Trash2, Layers, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { productApi, productImageApi, variantApi } from '@/services/api'
import api from '@/services/api'
import { Product, ProductVariant } from '@/types'
import { UOM_OPTIONS } from '@/constants/units'
import BarcodePrintModal from './BarcodePrintModal'

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(form: any) {
  const e: Record<string, string> = {}
  if (!form.name?.trim()) e.name = 'Product name is required'
  if (form.itemType === 'FINISHED_PIPE') {
    if (!form.sellingPrice || form.sellingPrice <= 0) e.sellingPrice = 'Selling price must be greater than 0'
    if (form.mrp > 0 && form.sellingPrice > form.mrp) e.sellingPrice = 'Selling price cannot exceed MRP'
  }
  if (form.reorderLevel < 0) e.reorderLevel = 'Cannot be negative'
  return e
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, name, type = 'text', form, setForm, errors, touched, onBlur, ...rest }: any) {
  const err = touched?.[name] && errors?.[name]
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={e => {
          const v = type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value
          setForm((f: any) => ({ ...f, [name]: v }))
        }}
        onBlur={() => onBlur?.(name)}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:outline-none ${err ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-primary-500'}`}
        {...rest}
      />
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProductForm() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = Boolean(id)

  const [visible,   setVisible]   = useState(false)
  const [showPrint, setShowPrint] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const { data: product, isLoading: productLoading } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () => productApi.getById(Number(id)).then(r => r.data.data),
    enabled: isEdit,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data.data),
  })

  const { data: taxGroups } = useQuery({
    queryKey: ['tax-groups'],
    queryFn: () => api.get('/tax-groups').then(r => r.data.data),
  })

  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', description: '',
    sellingPrice: '' as any, costPrice: '' as any, mrp: '' as any,
    hsnCode: '', unitOfMeasure: 'pcs', reorderLevel: 10,
    trackInventory: true, featured: false, active: true, purchasable: true,
    purchaseUom: '' as string,
    saleUom:     '' as string,
    purchaseFactor: 1 as number,
    saleFactor:     1 as number,
    itemType: 'GENERAL' as string,
  })
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [taxGroupId, setTaxGroupId] = useState<number | undefined>()
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [generatingBarcode, setGeneratingBarcode] = useState(false)

  // ── Variant state ─────────────────────────────────────────────────────────────
  const [variantsOpen, setVariantsOpen] = useState(true)
  const [attr1Name, setAttr1Name] = useState('Color')
  const [attr2Name, setAttr2Name] = useState('Size')
  const [variantRows, setVariantRows] = useState<Array<{
    id?: number
    attr1Value: string
    attr2Value: string
    sku: string
    barcode: string
    priceAdjustment: string
    costPrice: string
    active: boolean
    _dirty?: boolean
    _new?: boolean
  }>>([])

  const { data: savedVariants, refetch: refetchVariants } = useQuery<ProductVariant[]>({
    queryKey: ['variants', id],
    queryFn: () => variantApi.getAll(Number(id)).then(r => r.data.data ?? []),
    enabled: isEdit && Boolean(id),
  })

  useEffect(() => {
    if (!savedVariants) return
    setVariantRows(savedVariants.map(v => ({
      id: v.id,
      attr1Value: v.attribute1Value ?? '',
      attr2Value: v.attribute2Value ?? '',
      sku: v.sku ?? '',
      barcode: v.barcode ?? '',
      priceAdjustment: v.priceAdjustment?.toString() ?? '0',
      costPrice: v.costPrice?.toString() ?? '',
      active: v.active,
    })))
    if (savedVariants.length > 0) {
      setAttr1Name(savedVariants[0].attribute1Name ?? 'Color')
      setAttr2Name(savedVariants[0].attribute2Name ?? 'Size')
    }
  }, [savedVariants])

  const addVariantRow = () => {
    setVariantRows(prev => [...prev, { attr1Value: '', attr2Value: '', sku: '', barcode: '', priceAdjustment: '0', costPrice: '', active: true, _new: true }])
  }

  const removeVariantRow = async (idx: number) => {
    const row = variantRows[idx]
    if (row.id) {
      try {
        await variantApi.delete(Number(id), row.id)
        toast.success('Variant deleted')
        refetchVariants()
      } catch { toast.error('Failed to delete variant') }
    } else {
      setVariantRows(prev => prev.filter((_, i) => i !== idx))
    }
  }

  const updateVariantRow = (idx: number, field: string, value: any) => {
    setVariantRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, _dirty: true } : r))
  }

  const saveVariants = async () => {
    if (!id) return
    const productId = Number(id)
    for (const row of variantRows) {
      if (!row.attr1Value && !row.attr2Value) continue
      const payload = {
        attribute1Name: attr1Name || null,
        attribute1Value: row.attr1Value || null,
        attribute2Name: attr2Name || null,
        attribute2Value: row.attr2Value || null,
        sku: row.sku || null,
        barcode: row.barcode || null,
        priceAdjustment: parseFloat(row.priceAdjustment) || 0,
        costPrice: row.costPrice ? parseFloat(row.costPrice) : null,
        active: row.active,
      }
      try {
        if (row.id) {
          if (row._dirty) await variantApi.update(productId, row.id, payload)
        } else {
          await variantApi.create(productId, payload)
        }
      } catch (e: any) {
        toast.error(e.response?.data?.message ?? 'Failed to save variant')
      }
    }
    toast.success('Variants saved')
    refetchVariants()
  }

  const handleGenerateBarcode = async () => {
    setGeneratingBarcode(true)
    try {
      const res = await productApi.generateBarcode()
      setForm((prev: any) => ({ ...prev, barcode: res.data.data }))
    } catch {
      toast.error('Failed to generate barcode')
    } finally {
      setGeneratingBarcode(false)
    }
  }

  // ── Image state ──────────────────────────────────────────────────────────────
  const [savedImgs, setSavedImgs] = useState<Array<{ id: number; imageUrl: string; primary: boolean }>>([])
  const [pendingImgs, setPendingImgs] = useState<Array<{ file: File; url: string; primary: boolean }>>([])
  const [imgDrag, setImgDrag] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    productImageApi.getImages(Number(id))
      .then(r => setSavedImgs(r.data.data ?? []))
      .catch(() => {})
  }, [id])

  // revoke blob urls on unmount
  const pendingRef = useRef(pendingImgs)
  pendingRef.current = pendingImgs
  useEffect(() => () => { pendingRef.current.forEach(p => URL.revokeObjectURL(p.url)) }, [])

  const imgTotal = savedImgs.length + pendingImgs.length

  function handleImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const space = 10 - imgTotal
    if (space <= 0) { toast.error('Maximum 10 images allowed'); return }
    Array.from(files).slice(0, space).forEach(file => {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name} is not an image`); return }
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB`); return }
      if (isEdit && product) {
        setImgUploading(true)
        productImageApi.upload(product.id, file)
          .then(r => setSavedImgs(prev => [...prev, r.data.data]))
          .catch((e: any) => toast.error(e.response?.data?.message ?? `Failed to upload ${file.name}`))
          .finally(() => setImgUploading(false))
      } else {
        const url = URL.createObjectURL(file)
        setPendingImgs(prev => [...prev, { file, url, primary: prev.length === 0 && savedImgs.length === 0 }])
      }
    })
  }

  function removeSaved(imgId: number) {
    if (!product) return
    productImageApi.delete(product.id, imgId)
      .then(() => setSavedImgs(prev => prev.filter(i => i.id !== imgId)))
      .catch(() => toast.error('Failed to delete image'))
  }

  function removePending(idx: number) {
    setPendingImgs(prev => {
      URL.revokeObjectURL(prev[idx].url)
      const next = prev.filter((_, i) => i !== idx)
      if (prev[idx].primary && next.length > 0) next[0] = { ...next[0], primary: true }
      return next
    })
  }

  function setPrimarySaved(imgId: number) {
    if (!product) return
    productImageApi.setPrimary(product.id, imgId)
      .then(() => setSavedImgs(prev => prev.map(i => ({ ...i, primary: i.id === imgId }))))
      .catch(() => toast.error('Failed to set primary'))
  }

  function setPrimaryPending(idx: number) {
    setPendingImgs(prev => prev.map((p, i) => ({ ...p, primary: i === idx })))
  }

  // ── Populate form for edit ───────────────────────────────────────────────────
  useEffect(() => {
    if (!product) return
    setForm({
      name: product.name ?? '',
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      description: product.description ?? '',
      sellingPrice: product.sellingPrice ?? '',
      costPrice: product.costPrice ?? '',
      mrp: product.mrp ?? '',
      hsnCode: (product as any).hsnCode ?? '',
      unitOfMeasure: product.unitOfMeasure ?? 'pcs',
      reorderLevel: product.reorderLevel ?? 10,
      trackInventory: product.trackInventory ?? true,
      featured: product.featured ?? false,
      active: product.active ?? true,
      purchasable:    (product as any).purchasable    ?? true,
      purchaseUom:    (product as any).purchaseUom    ?? '',
      saleUom:        (product as any).saleUom        ?? '',
      purchaseFactor: (product as any).purchaseFactor ?? 1,
      saleFactor:     (product as any).saleFactor     ?? 1,
      itemType:       (product as any).itemType       ?? 'GENERAL',
    })
    setCategoryId(product.category?.id)
    setTaxGroupId(product.taxGroup?.id)
  }, [product])

  const errors = validate(form)
  const touch = (name: string) => setTouched(t => ({ ...t, [name]: true }))
  const touchAll = () => setTouched(Object.fromEntries(Object.keys(form).map(k => [k, true])))
  const goBack = () => navigate('/products')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    touchAll()
    if (Object.keys(errors).length > 0) return
    setSaving(true)

    const isPipe = form.itemType === 'FINISHED_PIPE'

    // Build explicit, clean payload matching the backend CreateProductDTO exactly.
    // categoryId + taxGroupId go in the JSON body (backend reads body only, not query params).
    // Empty strings → null so backend validation doesn't reject them.
    const payload = {
      name:            form.name.trim(),
      sku:             form.sku.trim()              || null,
      barcode:         form.barcode.trim()           || null,
      description:     form.description.trim()       || null,
      hsnCode:         (form.hsnCode ?? '').trim()   || null,
      // Category and tax group MUST be in the body — backend ignores query params
      categoryId:      categoryId ?? null,
      taxGroupId:      taxGroupId ?? null,
      unitOfMeasure:   form.unitOfMeasure,
      reorderLevel:    Number(form.reorderLevel) || 0,
      trackInventory:  form.trackInventory,
      featured:        form.featured,
      active:          form.active,
      itemType:        form.itemType,
      productType:     'PHYSICAL',
      // Pricing — 0 for non-pipe so backend accepts valid decimal
      sellingPrice:    isPipe ? (parseFloat(form.sellingPrice) || 0) : 0,
      costPrice:       isPipe ? (parseFloat(form.costPrice)    || 0) : 0,
      mrp:             isPipe ? (parseFloat(form.mrp)          || 0) : 0,
      // UoM conversion — empty string MUST be null, never ""
      purchaseUom:     form.purchaseUom.trim() || null,
      saleUom:         form.saleUom.trim()     || null,
      purchaseFactor:  Number(form.purchaseFactor) || 1,
      saleFactor:      Number(form.saleFactor)     || 1,
    }

    try {
      if (isEdit && product) {
        const res = await productApi.update(product.id, payload)
        const updatedBarcode = res.data.data?.barcode
        if (updatedBarcode) setForm((prev: any) => ({ ...prev, barcode: updatedBarcode }))
        qc.invalidateQueries({ queryKey: ['product'] })
        toast.success('Product updated')
      } else {
        const res = await productApi.create(payload)
        const newId = res.data.data?.id
        if (newId) {
          for (const { file } of pendingImgs) {
            try { await productImageApi.upload(newId, file) } catch {}
          }
        }
        toast.success('Product created')
      }
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products', 'all-uom'] })
      goBack()
    } catch (err: any) {
      const msg = err.response?.data?.message
        ?? err.response?.data?.error
        ?? err.message
        ?? 'Failed to save product'
      console.error('Product save error:', err.response?.data ?? err)
      toast.error(msg, { duration: 6000 })
    } finally {
      setSaving(false)
    }
  }

  const f = { form, setForm, errors, touched, onBlur: touch }

  if (isEdit && productLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    )
  }

  return (
    <div
      className="min-h-full bg-gray-50"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(32px)',
        transition: 'opacity 200ms ease, transform 260ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={goBack} className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
            <Package size={18} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">{isEdit ? 'Edit Product' : 'Add New Product'}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{isEdit ? `Editing: ${product?.name}` : 'Fill in the product details below'}</p>
          </div>
        </div>
        <div className="ml-auto flex gap-3">
          <button type="button" onClick={goBack} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          {isEdit && product && (
            <button
              type="button"
              onClick={() => setShowPrint(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Barcode size={15} />
              Print Label
            </button>
          )}
          <button type="submit" form="product-form" disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>

      {/* ── Form ── */}
      <form id="product-form" onSubmit={handleSubmit} noValidate className="p-6 space-y-4">

        {/* ── PRODUCT IMAGES (full-width) ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Product Images</h3>
              <p className="text-xs text-gray-400 mt-0.5">Up to 10 images · Max 5 MB each</p>
            </div>
            {imgTotal > 0 && (
              <span className="text-xs text-gray-400">{imgTotal}/10 images</span>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            {/* Saved images */}
            {savedImgs.map(img => (
              <div key={img.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
                <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                {img.primary && (
                  <span className="absolute top-0.5 left-0.5 bg-yellow-400 text-white text-[9px] font-bold px-1 py-0.5 rounded-full">★</span>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {!img.primary && (
                    <button type="button" onClick={e => { e.stopPropagation(); setPrimarySaved(img.id) }}
                      className="bg-yellow-400 hover:bg-yellow-500 text-white p-1 rounded-full" title="Set primary">
                      <Star size={10} fill="white" />
                    </button>
                  )}
                  <button type="button" onClick={e => { e.stopPropagation(); removeSaved(img.id) }}
                    className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-full" title="Delete">
                    <X size={10} />
                  </button>
                </div>
              </div>
            ))}

            {/* Pending images (new product) */}
            {pendingImgs.map((p, i) => (
              <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border-2 border-blue-300 bg-gray-50 flex-shrink-0">
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                {p.primary && (
                  <span className="absolute top-0.5 left-0.5 bg-yellow-400 text-white text-[9px] font-bold px-1 py-0.5 rounded-full">★</span>
                )}
                <span className="absolute bottom-0.5 left-0 right-0 text-center bg-gray-700/70 text-white text-[9px] py-0.5">pending</span>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {!p.primary && (
                    <button type="button" onClick={e => { e.stopPropagation(); setPrimaryPending(i) }}
                      className="bg-yellow-400 hover:bg-yellow-500 text-white p-1 rounded-full" title="Set primary">
                      <Star size={10} fill="white" />
                    </button>
                  )}
                  <button type="button" onClick={e => { e.stopPropagation(); removePending(i) }}
                    className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-full" title="Remove">
                    <X size={10} />
                  </button>
                </div>
              </div>
            ))}

            {/* Drop zone / add button */}
            {imgTotal < 10 && (
              <div
                onDragOver={e => { e.preventDefault(); setImgDrag(true) }}
                onDragLeave={() => setImgDrag(false)}
                onDrop={e => { e.preventDefault(); setImgDrag(false); handleImageFiles(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
                className={`w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors flex-shrink-0 ${
                  imgDrag ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                {imgUploading
                  ? <Loader2 size={18} className="text-blue-500 animate-spin" />
                  : <ImagePlus size={18} className="text-gray-400" />}
                <p className="text-[10px] text-gray-400 mt-1 text-center leading-tight px-1">
                  {imgUploading ? 'Uploading…' : 'Add photo'}
                </p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { handleImageFiles(e.target.files); e.target.value = '' }} />
              </div>
            )}
          </div>

          {!isEdit && pendingImgs.length > 0 && (
            <p className="text-xs text-blue-500 mt-2">{pendingImgs.length} image{pendingImgs.length > 1 ? 's' : ''} will be uploaded when you save the product.</p>
          )}
        </div>

        {/* Row: Basic + Right sidebar */}
        <div className="grid grid-cols-3 gap-4">

          {/* Left 2/3 */}
          <div className="col-span-2 space-y-4">
            <Card title="Basic Information">
              <div className="space-y-4">
                <Field label="Product Name *" name="name" placeholder="e.g. Basmati Rice 1kg" {...f} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="SKU" name="sku" placeholder="e.g. SKU-001" {...f} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barcode / EAN</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.barcode}
                        onChange={e => setForm((prev: any) => ({ ...prev, barcode: e.target.value }))}
                        placeholder="Auto-generated if empty"
                        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateBarcode}
                        disabled={generatingBarcode}
                        title="Generate unique barcode"
                        className="flex items-center gap-1.5 px-2.5 py-2 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
                      >
                        {generatingBarcode
                          ? <Loader2 size={13} className="animate-spin" />
                          : <RefreshCw size={13} />}
                        Auto
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Leave empty to auto-generate on save</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="HSN Code" name="hsnCode" placeholder="e.g. 1006" {...f} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
                    <select value={form.unitOfMeasure} onChange={e => setForm((prev: any) => ({ ...prev, unitOfMeasure: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                      {UOM_OPTIONS.map(g => (
                        <optgroup key={g.group} label={g.group}>
                          {g.units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm((prev: any) => ({ ...prev, description: e.target.value }))}
                    rows={3} placeholder="Brief description..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none" />
                </div>
              </div>
            </Card>

            <Card title="Pricing">
              {form.itemType !== 'FINISHED_PIPE' && (
                <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
                  <span className="font-semibold">Pricing disabled</span> — only PCCP Pipes have selling price, cost price and MRP.
                </div>
              )}
              <div className={`grid grid-cols-3 gap-4 ${form.itemType !== 'FINISHED_PIPE' ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                <Field label="Selling Price (₹)" name="sellingPrice" type="number" step="0.01" min="0" placeholder="0.00" disabled={form.itemType !== 'FINISHED_PIPE'} {...f} />
                <Field label="Cost Price (₹)" name="costPrice" type="number" step="0.01" min="0" placeholder="0.00" disabled={form.itemType !== 'FINISHED_PIPE'} {...f} />
                <Field label="MRP (₹)" name="mrp" type="number" step="0.01" min="0" placeholder="0.00" disabled={form.itemType !== 'FINISHED_PIPE'} {...f} />
              </div>
            </Card>

            {/* ── UoM Conversion ── */}
            {form.trackInventory && (
              <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-white rounded-xl border border-indigo-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                      <ArrowRight size={13} className="text-indigo-500" />
                      Unit Conversion
                    </h3>
                    <p className="text-xs text-indigo-400 mt-0.5">Buy in bulk, sell in smaller units. Stock is always tracked in Base unit.</p>
                  </div>
                </div>

                {/* 3-column flow */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Purchase */}
                  <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center">
                        <Truck size={11} className="text-white" />
                      </div>
                      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Purchase Unit</span>
                    </div>
                    <select
                      value={form.purchaseUom || form.unitOfMeasure}
                      onChange={e => setForm((p: any) => ({ ...p, purchaseUom: e.target.value }))}
                      className="w-full text-xs border border-blue-200 bg-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      {UOM_OPTIONS.map(g => (
                        <optgroup key={g.group} label={g.group}>
                          {g.units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <div className="mt-2">
                      <label className="text-[10px] text-blue-500 font-medium">1 unit = ? base</label>
                      <input
                        type="number" min="0.0001" step="any"
                        value={form.purchaseFactor}
                        onChange={e => setForm((p: any) => ({ ...p, purchaseFactor: parseFloat(e.target.value) || 1 }))}
                        className="w-full mt-0.5 border border-blue-200 bg-white rounded-lg px-2 py-1.5 text-xs font-bold text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  {/* Base (read-only mirror of unitOfMeasure) */}
                  <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3 relative">
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className="bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Stock Unit</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 mb-2">
                      <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center">
                        <FlaskConical size={11} className="text-white" />
                      </div>
                      <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Base Unit</span>
                    </div>
                    <div className="bg-white border border-indigo-200 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-800 text-center">
                      {form.unitOfMeasure}
                    </div>
                    <p className="text-[10px] text-indigo-400 text-center mt-1.5">Set above ↑</p>
                  </div>

                  {/* Sale */}
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center">
                        <ShoppingCart size={11} className="text-white" />
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Sale Unit</span>
                    </div>
                    <select
                      value={form.saleUom || form.unitOfMeasure}
                      onChange={e => setForm((p: any) => ({ ...p, saleUom: e.target.value }))}
                      className="w-full text-xs border border-emerald-200 bg-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    >
                      {UOM_OPTIONS.map(g => (
                        <optgroup key={g.group} label={g.group}>
                          {g.units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <div className="mt-2">
                      <label className="text-[10px] text-emerald-500 font-medium">1 unit = ? base</label>
                      <input
                        type="number" min="0.0001" step="any"
                        value={form.saleFactor}
                        onChange={e => setForm((p: any) => ({ ...p, saleFactor: parseFloat(e.target.value) || 1 }))}
                        className="w-full mt-0.5 border border-emerald-200 bg-white rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Inline preview */}
                {((form.purchaseFactor ?? 1) > 1 || (form.saleFactor ?? 1) > 1) && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {(form.purchaseFactor ?? 1) > 1 && form.purchaseUom && (
                      <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                        <Truck size={11} className="text-blue-500" />
                        <span className="text-xs text-blue-700 font-medium">
                          Receive 1 {form.purchaseUom} → +{form.purchaseFactor} {form.unitOfMeasure}
                        </span>
                      </div>
                    )}
                    {(form.saleFactor ?? 1) > 1 && form.saleUom && (
                      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
                        <ShoppingCart size={11} className="text-emerald-500" />
                        <span className="text-xs text-emerald-700 font-medium">
                          Sell 1 {form.saleUom} → −{form.saleFactor} {form.unitOfMeasure}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right 1/3 */}
          <div className="space-y-4">
            <Card title="Classification">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'GENERAL',        label: 'No Category'    },
                      { value: 'RAW_MATERIAL',   label: 'Raw Material'   },
                      { value: 'FINISHED_PIPE',  label: 'PCCP Pipes'     },
                      { value: 'STORE_MATERIAL', label: 'Store Material' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((prev: any) => ({ ...prev, itemType: opt.value }))}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all ${
                          form.itemType === opt.value
                            ? 'border-violet-500 bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:bg-violet-50/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Group</label>
                  <select value={taxGroupId ?? ''} onChange={e => setTaxGroupId(Number(e.target.value) || undefined)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                    <option value="">No Tax</option>
                    {(taxGroups ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.totalRate}%)</option>)}
                  </select>
                </div>
              </div>
            </Card>

            <Card title="Inventory">
              <div className="space-y-4">
                <Field label="Reorder Level" name="reorderLevel" type="number" min="0" step="1" {...f} />
                <div className="space-y-3">
                  {[
                    { key: 'trackInventory', label: 'Track Inventory', desc: 'Monitor stock levels' },
                    { key: 'featured',       label: 'Featured',        desc: 'Show in featured list' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox"
                        checked={Boolean(form[key as keyof typeof form])}
                        onChange={e => setForm((prev: any) => ({ ...prev, [key]: e.target.checked }))}
                        className="mt-0.5 w-4 h-4 text-primary-600 rounded border-gray-300" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="Status">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Product Active</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.active ? 'Visible & available for sale' : 'Hidden from POS & reports'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((prev: any) => ({ ...prev, active: !prev.active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.active ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="mt-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {form.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">Purchasable</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.purchasable ? 'Available in Purchase Orders & Direct Purchase' : 'Hidden from all purchase flows'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((prev: any) => ({ ...prev, purchasable: !prev.purchasable }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.purchasable ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.purchasable ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="mt-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.purchasable ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                  {form.purchasable ? 'Purchasable' : 'Not Purchasable'}
                </span>
              </div>
            </Card>
          </div>
        </div>
      </form>

      {/* ── VARIANTS (edit mode only) ── */}
      {isEdit && (
        <div className="bg-white rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setVariantsOpen(o => !o)}
            className="w-full flex items-center justify-between p-5 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <Layers size={16} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Product Variants</h3>
                <p className="text-xs text-gray-500">
                  {variantRows.length > 0 ? `${variantRows.length} variant${variantRows.length !== 1 ? 's' : ''} defined` : 'Add size, color, or other options'}
                </p>
              </div>
              {variantRows.length > 0 && (
                <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">{variantRows.length}</span>
              )}
            </div>
            {variantsOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {variantsOpen && (
            <div className="px-5 pb-5 border-t border-gray-100">
              {/* Attribute name config */}
              <div className="flex gap-3 mt-4 mb-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Attribute 1 Name</label>
                  <input
                    type="text"
                    value={attr1Name}
                    onChange={e => setAttr1Name(e.target.value)}
                    placeholder="e.g. Color"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Attribute 2 Name (optional)</label>
                  <input
                    type="text"
                    value={attr2Name}
                    onChange={e => setAttr2Name(e.target.value)}
                    placeholder="e.g. Size"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Variant rows */}
              {variantRows.length > 0 && (
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-2 font-medium text-gray-500">{attr1Name || 'Attr 1'}</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-500">{attr2Name || 'Attr 2'}</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-500">SKU</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-500">Barcode</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-500">Price Adj (₹)</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-500">Cost (₹)</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-500">Active</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 px-2">
                            <input type="text" value={row.attr1Value}
                              onChange={e => updateVariantRow(idx, 'attr1Value', e.target.value)}
                              placeholder={attr1Name}
                              className="w-24 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-violet-400 focus:outline-none" />
                          </td>
                          <td className="py-1.5 px-2">
                            <input type="text" value={row.attr2Value}
                              onChange={e => updateVariantRow(idx, 'attr2Value', e.target.value)}
                              placeholder={attr2Name}
                              className="w-24 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-violet-400 focus:outline-none" />
                          </td>
                          <td className="py-1.5 px-2">
                            <input type="text" value={row.sku}
                              onChange={e => updateVariantRow(idx, 'sku', e.target.value)}
                              placeholder="Optional"
                              className="w-24 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-violet-400 focus:outline-none" />
                          </td>
                          <td className="py-1.5 px-2">
                            <input type="text" value={row.barcode}
                              onChange={e => updateVariantRow(idx, 'barcode', e.target.value)}
                              placeholder="Optional"
                              className="w-28 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-violet-400 focus:outline-none" />
                          </td>
                          <td className="py-1.5 px-2">
                            <input type="number" value={row.priceAdjustment}
                              onChange={e => updateVariantRow(idx, 'priceAdjustment', e.target.value)}
                              step="0.01"
                              className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-violet-400 focus:outline-none" />
                          </td>
                          <td className="py-1.5 px-2">
                            <input type="number" value={row.costPrice}
                              onChange={e => updateVariantRow(idx, 'costPrice', e.target.value)}
                              step="0.01" placeholder="0.00"
                              className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-violet-400 focus:outline-none" />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button type="button" onClick={() => updateVariantRow(idx, 'active', !row.active)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${row.active ? 'bg-green-500' : 'bg-gray-300'}`}>
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${row.active ? 'translate-x-4' : 'translate-x-1'}`} />
                            </button>
                          </td>
                          <td className="py-1.5 px-2">
                            <button type="button" onClick={() => removeVariantRow(idx)}
                              className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {variantRows.length === 0 && (
                <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg mb-3">
                  <Layers size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No variants yet. Add a row to create variants like Red/Small, Blue/Large etc.</p>
                </div>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={addVariantRow}
                  className="flex items-center gap-1.5 px-3 py-2 border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-medium transition-colors">
                  <Plus size={13} /> Add Variant Row
                </button>
                {variantRows.some(r => r._dirty || r._new) && (
                  <button type="button" onClick={saveVariants}
                    className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors">
                    Save Variants
                  </button>
                )}
              </div>

              {variantRows.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Base price: ₹{form.sellingPrice || '—'}. Variant price = Base + Price Adjustment. Use negative values for cheaper variants.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {showPrint && product && (
        <BarcodePrintModal product={product} onClose={() => setShowPrint(false)} />
      )}
    </div>
  )
}
