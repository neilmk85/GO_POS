import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle2,
  AlertCircle, Loader2, ChevronRight, RotateCcw, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { customerApi } from '@/services/api'

type Step = 'upload' | 'preview' | 'done'
type LoadingAction = 'preview' | 'direct' | null

interface RowResult {
  rowNumber: number
  name: string
  phone?: string
  email?: string
  city?: string
  segment?: string
  status: 'OK' | 'ERROR'
  error?: string
}

interface ImportResult {
  totalRows: number
  created: number
  skipped: number
  dryRun: boolean
  rows: RowResult[]
}

export default function CustomerImportModal({ onClose, onImported }: {
  onClose: () => void
  onImported: () => void
}) {
  const [step, setStep]               = useState<Step>('upload')
  const [file, setFile]               = useState<File | null>(null)
  const [dragging, setDragging]       = useState(false)
  const [loadingAction, setLoading]   = useState<LoadingAction>(null)
  const [preview, setPreview]         = useState<ImportResult | null>(null)
  const [result, setResult]           = useState<ImportResult | null>(null)
  const [showErrorRows, setShowErrRows] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function acceptFile(f: File) {
    const name = f.name.toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Only .csv, .xlsx and .xls files are supported')
      return
    }
    setFile(f)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  }, [])

  async function downloadTemplate() {
    try {
      const res = await customerApi.downloadTemplate()
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url; a.download = 'customers_template.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download template')
    }
  }

  async function runPreview() {
    if (!file) return
    setLoading('preview')
    try {
      const res = await customerApi.importFile(file, true)
      setPreview(res.data.data)
      setStep('preview')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to parse file')
    } finally {
      setLoading(null)
    }
  }

  async function runDirectImport() {
    if (!file) return
    setLoading('direct')
    try {
      const res = await customerApi.importFile(file, false)
      const data: ImportResult = res.data.data
      setResult(data)
      setStep('done')
      if (data.created > 0) onImported()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Import failed')
    } finally {
      setLoading(null)
    }
  }

  async function runImport() {
    if (!file) return
    setLoading('direct')
    try {
      const res = await customerApi.importFile(file, false)
      const data: ImportResult = res.data.data
      setResult(data)
      setStep('done')
      if (data.created > 0) onImported()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Import failed')
    } finally {
      setLoading(null)
    }
  }

  function reset() {
    setStep('upload'); setFile(null); setPreview(null)
    setResult(null); setShowErrRows(false)
  }

  const validRows = preview?.rows.filter(r => r.status === 'OK').length ?? 0
  const errorRows = preview?.rows.filter(r => r.status === 'ERROR').length ?? 0
  const resultErrorRows = result?.rows.filter(r => r.status === 'ERROR') ?? []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <FileSpreadsheet size={16} className="text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Import Customers</h3>
              <p className="text-xs text-gray-400">Upload a .csv or .xlsx file to bulk-add customers</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b bg-gray-50 text-xs shrink-0">
          {(['upload', 'preview', 'done'] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
              <span className={`font-medium ${
                step === s ? 'text-primary-600' :
                (step === 'done' || (step === 'preview' && s === 'upload')) ? 'text-gray-400 line-through' :
                'text-gray-400'
              }`}>
                {s === 'upload' ? '1. Upload' : s === 'preview' ? '2. Preview' : '3. Done'}
              </span>
            </span>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-blue-800">Download template first</p>
                  <p className="text-xs text-blue-600 mt-0.5">Fill in your customers using the correct column format</p>
                </div>
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0">
                  <Download size={13} /> Download Template
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Required columns</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 shrink-0" /><span><strong>name</strong> — customer name (required)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" /><span><strong>phone</strong> — mobile number (unique)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" /><span><strong>email</strong> — email address (unique)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" /><span><strong>segment</strong> — REGULAR / SILVER / GOLD / VIP</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" /><span><strong>address</strong>, <strong>city</strong>, <strong>state</strong>, <strong>pincode</strong></span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" /><span><strong>gstin</strong> — GST number (B2B)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" /><span><strong>discount_percent</strong> — default discount %</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" /><span><strong>credit_limit</strong> — credit limit amount</span></div>
                </div>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragging ? 'border-primary-400 bg-primary-50'
                  : file   ? 'border-green-400 bg-green-50'
                           : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                }`}
              >
                <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f) }} />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 size={40} className="text-green-500" />
                    <p className="text-base font-semibold text-gray-800">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                    <p className="text-sm font-semibold text-primary-600 underline underline-offset-2">Click to change file</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={40} className="text-gray-300" />
                    <p className="text-base font-semibold text-gray-700">Drag & drop your file here</p>
                    <p className="text-sm font-semibold text-primary-600 underline underline-offset-2">or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">.csv, .xlsx, .xls supported</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{preview.totalRows}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Total rows</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{validRows}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ready to import</p>
                </div>
                <div className={`${errorRows > 0 ? 'bg-red-50' : 'bg-gray-50'} rounded-xl p-3 text-center`}>
                  <p className={`text-2xl font-bold ${errorRows > 0 ? 'text-red-500' : 'text-gray-400'}`}>{errorRows}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Rows with errors</p>
                </div>
              </div>

              {errorRows > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>Rows with errors will be <strong>skipped</strong>. Fix them in your file and re-upload, or proceed to import valid rows only.</span>
                </div>
              )}

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-center w-10">Row</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Phone</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Segment</th>
                      <th className="px-3 py-2 text-center w-20">Status</th>
                      <th className="px-3 py-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.rows.map(row => (
                      <tr key={row.rowNumber} className={row.status === 'ERROR' ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 text-center text-gray-400">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 max-w-[120px] truncate">
                          {row.name || <span className="italic text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500 font-mono">{row.phone || '—'}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate">{row.email || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.segment || 'REGULAR'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                            row.status === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {row.status === 'OK' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                            {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-red-500 text-[11px]">{row.error ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && result && (
            <div className="space-y-5">
              <div className="flex flex-col items-center pt-4 gap-3 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${result.created > 0 ? 'bg-green-100' : 'bg-red-50'}`}>
                  {result.created > 0
                    ? <CheckCircle2 size={32} className="text-green-500" />
                    : <AlertCircle size={32} className="text-red-400" />}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900">
                    {result.created > 0 ? 'Import Complete' : 'Nothing Imported'}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {result.created > 0
                      ? 'Customers have been added successfully.'
                      : 'All rows had validation errors. Please fix your file and try again.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 w-64">
                  <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-3xl font-bold text-green-600">{result.created}</p>
                    <p className="text-xs text-gray-500 mt-1">Customers created</p>
                  </div>
                  <div className={`${result.skipped > 0 ? 'bg-red-50' : 'bg-gray-50'} rounded-xl p-4`}>
                    <p className={`text-3xl font-bold ${result.skipped > 0 ? 'text-red-500' : 'text-gray-400'}`}>{result.skipped}</p>
                    <p className="text-xs text-gray-500 mt-1">Rows skipped</p>
                  </div>
                </div>
              </div>

              {resultErrorRows.length > 0 && (
                <div className="border border-red-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowErrRows(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-red-50 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle size={15} />
                      {resultErrorRows.length} row{resultErrorRows.length !== 1 ? 's' : ''} had validation errors and were skipped
                    </span>
                    <span className="text-xs text-red-500">{showErrorRows ? 'Hide' : 'Show details'}</span>
                  </button>
                  {showErrorRows && (
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="px-3 py-2 text-center w-10">Row</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Phone</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-50">
                        {resultErrorRows.map(row => (
                          <tr key={row.rowNumber} className="bg-red-50/50">
                            <td className="px-3 py-2 text-center text-gray-400">{row.rowNumber}</td>
                            <td className="px-3 py-2 font-medium text-gray-700">{row.name || <span className="italic text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">{row.phone || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{row.email || '—'}</td>
                            <td className="px-3 py-2 text-red-600 font-medium">{row.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {result.skipped > 0 && (
                <div className="flex justify-center">
                  <button onClick={reset} className="flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
                    <RotateCcw size={13} /> Fix errors and import again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
          <button
            onClick={step === 'done' ? onClose : (step === 'upload' ? onClose : reset)}
            className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100 transition-colors"
          >
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>

          <div className="flex gap-2">
            {step === 'upload' && (
              <>
                <button
                  onClick={runPreview}
                  disabled={!file || loadingAction !== null}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingAction === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  Preview Import
                </button>
                <button
                  onClick={runDirectImport}
                  disabled={!file || loadingAction !== null}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingAction === 'direct' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Upload & Import
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button onClick={reset} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
                  Change File
                </button>
                <button
                  onClick={runImport}
                  disabled={loadingAction !== null || validRows === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingAction === 'direct' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Import {validRows} Customer{validRows !== 1 ? 's' : ''}
                </button>
              </>
            )}
            {step === 'done' && (
              <button onClick={onClose} className="px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg transition-colors">
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
