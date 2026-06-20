import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Loader2, ChevronDown, Plus, PlusCircle, X, MapPin,
  UserPlus, UserCog,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { customerApi } from '@/services/api'

// ─── Country codes ────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: '+91',  flag: '🇮🇳', name: 'India' },
  { code: '+1',   flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+44',  flag: '🇬🇧', name: 'UK' },
  { code: '+61',  flag: '🇦🇺', name: 'Australia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore' },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+92',  flag: '🇵🇰', name: 'Pakistan' },
  { code: '+49',  flag: '🇩🇪', name: 'Germany' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
  { code: '+81',  flag: '🇯🇵', name: 'Japan' },
  { code: '+86',  flag: '🇨🇳', name: 'China' },
  { code: '+55',  flag: '🇧🇷', name: 'Brazil' },
  { code: '+27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
]

// ─── Phone field ──────────────────────────────────────────────────────────────
function PhoneField({ label = 'Phone *', dialCode, onDialChange, phone, onPhoneChange, error, touched, onBlur }: {
  label?: string; dialCode: string; onDialChange: (code: string) => void
  phone: string; onPhoneChange: (v: string) => void
  error?: string; touched?: boolean; onBlur?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selected = COUNTRIES.find(c => c.code === dialCode) ?? COUNTRIES[0]
  const filtered = search
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search))
    : COUNTRIES
  const hasErr = touched && error

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className={`relative flex border rounded-lg overflow-visible focus-within:ring-2 focus-within:ring-violet-500 ${hasErr ? 'border-red-400' : 'border-gray-300'}`} ref={ref}>
        <button type="button" onClick={() => { setOpen(o => !o); setSearch('') }}
          className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-r border-gray-300 hover:bg-gray-100 shrink-0 text-sm font-medium text-gray-700 select-none">
          <span className="text-base leading-none">{selected.flag}</span>
          <span>{selected.code}</span>
          <ChevronDown size={13} className="text-gray-400" />
        </button>
        <input type="tel" value={phone}
          onChange={e => onPhoneChange(e.target.value.replace(/\D/g, ''))}
          onBlur={onBlur} placeholder="9876543210" maxLength={15}
          className="flex-1 px-3 py-2 text-sm outline-none bg-white rounded-r-lg" />
        {open && (
          <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 border-b">
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search country..."
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <ul className="max-h-52 overflow-auto">
              {filtered.map(c => (
                <li key={c.code}>
                  <button type="button" onClick={() => { onDialChange(c.code); setOpen(false); setSearch('') }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-violet-50 text-left ${c.code === dialCode ? 'bg-violet-50 font-semibold' : ''}`}>
                    <span className="text-base">{c.flag}</span>
                    <span className="flex-1 text-gray-800">{c.name}</span>
                    <span className="text-gray-400 font-mono">{c.code}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-4 py-3 text-sm text-gray-400 text-center">No results</li>}
            </ul>
          </div>
        )}
      </div>
      {hasErr && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── Validators ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

function validatePhone(phone: string, dialCode: string, required = false): string | undefined {
  if (!phone.trim()) return required ? 'Phone is required' : undefined
  const digits = phone.replace(/\D/g, '')
  if (dialCode === '+91' && !/^[6-9]\d{9}$/.test(digits)) return 'Enter a valid 10-digit Indian mobile number'
  if (digits.length < 6) return 'Phone number too short'
  return undefined
}

type Errors = Partial<Record<string, string>>
function validate(form: any, dialCode: string, dialCode2: string): Errors {
  const e: Errors = {}
  if (!form.name.trim()) e.name = 'Name is required'
  else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
  const phoneErr = validatePhone(form.phone, dialCode, true)
  if (phoneErr) e.phone = phoneErr
  const phone2Err = validatePhone(form.phone2, dialCode2, false)
  if (phone2Err) e.phone2 = phone2Err
  if (form.email && !EMAIL_RE.test(form.email)) e.email = 'Enter a valid email address'
  if (form.gstin && !GSTIN_RE.test(form.gstin.toUpperCase())) e.gstin = 'Invalid GSTIN (e.g. 27AABCU9603R1ZX)'
  if (form.creditLimit < 0) e.creditLimit = 'Cannot be negative'
  if (form.discountPercent < 0 || form.discountPercent > 100) e.discountPercent = 'Must be between 0 and 100'
  return e
}

// ─── Generic field ────────────────────────────────────────────────────────────
function Field({ label, name, type = 'text', form, setForm, errors, touched, onBlur, ...props }: any) {
  const err = touched?.[name] && errors?.[name]
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={(form as any)[name]}
        onChange={e => {
          const val = type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value
          setForm({ ...form, [name]: val })
        }}
        onBlur={() => onBlur?.(name)}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:outline-none ${
          err ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-violet-500'
        }`}
        {...props} />
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  )
}

// ─── Site address ─────────────────────────────────────────────────────────────
interface SiteAddress { label: string; address: string; city: string; state: string; pincode: string }
const emptySite = (): SiteAddress => ({ label: '', address: '', city: '', state: '', pincode: '' })
function parseSites(raw: any): SiteAddress[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CustomerFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  // Load customer when editing
  const { data: customerData, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.getById(Number(id)).then(r => r.data.data),
    enabled: isEdit,
  })
  const customer = customerData ?? null

  const parsePhone = (raw: string) => {
    if (!raw) return { dialCode: '+91', phone: '' }
    const match = COUNTRIES.find(c => raw.startsWith(c.code))
    if (match) return { dialCode: match.code, phone: raw.slice(match.code.length) }
    return { dialCode: '+91', phone: raw }
  }

  const parsed  = parsePhone(customer?.phone  || '')
  const parsed2 = parsePhone(customer?.phone2 || '')

  const [form, setForm] = useState({
    name: '', email: '', address: '', city: '', state: '',
    gstin: '', creditLimit: 0, discountPercent: 0, phone: '', phone2: '',
  })
  const [siteAddresses, setSiteAddresses] = useState<SiteAddress[]>([])
  const [dialCode,  setDialCode]  = useState('+91')
  const [dialCode2, setDialCode2] = useState('+91')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  // Populate form once customer data arrives
  useEffect(() => {
    if (!customer) return
    setForm({
      name:            customer.name           || '',
      email:           customer.email          || '',
      address:         customer.address        || '',
      city:            customer.city           || '',
      state:           customer.state          || '',
      gstin:           customer.gstin          || '',
      creditLimit:     customer.creditLimit    || 0,
      discountPercent: customer.discountPercent || 0,
      phone:  parsed.phone,
      phone2: parsed2.phone,
    })
    setDialCode(parsed.dialCode)
    setDialCode2(parsed2.dialCode)
    setSiteAddresses(parseSites((customer as any)?.siteAddresses))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer])

  const errors   = validate(form, dialCode, dialCode2)
  const hasErrors = Object.keys(errors).length > 0
  const touch    = (name: string) => setTouched(t => ({ ...t, [name]: true }))
  const touchAll = () => setTouched(
    Object.fromEntries([...Object.keys(form), 'phone', 'phone2'].map(k => [k, true]))
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    touchAll()
    if (hasErrors) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        phone:  dialCode + form.phone,
        phone2: form.phone2 ? dialCode2 + form.phone2 : '',
        siteAddresses,
      }
      if (isEdit && customer) {
        await customerApi.update(customer.id, payload)
        toast.success('Customer updated')
      } else {
        await customerApi.create(payload)
        toast.success('Customer created')
      }
      navigate('/customers')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const fp = { form, setForm, errors, touched, onBlur: touch }

  if (isEdit && loadingCustomer) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full bg-violet-300/20 blur-2xl" />
        </div>
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/customers')}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            {isEdit
              ? <UserCog size={26} className="text-amber-300" />
              : <UserPlus size={26} className="text-amber-300" />}
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Commerce</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">
                {isEdit ? 'Edit Customer' : 'New Customer'}
              </h1>
            </div>
          </div>
          {isEdit && customer && (
            <div className="text-right">
              <p className="text-white font-semibold">{customer.name}</p>
              <p className="text-violet-200 text-xs mt-0.5">{customer.phone}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column — 2/3 width */}
          <div className="lg:col-span-2 space-y-6">

            {/* Basic Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Basic Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Full Name *" name="name" placeholder="e.g. Rahul Sharma" {...fp} />
                </div>
                <div className="relative">
                  <PhoneField
                    dialCode={dialCode} onDialChange={setDialCode}
                    phone={form.phone} onPhoneChange={v => setForm(f => ({ ...f, phone: v }))}
                    error={errors.phone} touched={touched.phone} onBlur={() => touch('phone')}
                  />
                </div>
                <div className="relative">
                  <PhoneField
                    label="Secondary Phone"
                    dialCode={dialCode2} onDialChange={setDialCode2}
                    phone={form.phone2} onPhoneChange={v => setForm(f => ({ ...f, phone2: v }))}
                    error={errors.phone2} touched={touched.phone2} onBlur={() => touch('phone2')}
                  />
                </div>
                <div className="col-span-2">
                  <Field label="Email" name="email" type="email" placeholder="customer@email.com" {...fp} />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Address</h2>
              <Field label="Street Address" name="address" placeholder="Plot / Survey / Street" {...fp} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" name="city" placeholder="City" {...fp} />
                <Field label="State" name="state" placeholder="State" {...fp} />
              </div>
            </div>

            {/* Site Addresses */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Site / Delivery Addresses</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Multiple project or delivery sites</p>
                </div>
                {siteAddresses.length > 0 && (
                  <button type="button" onClick={() => setSiteAddresses(s => [...s, emptySite()])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-600 border border-violet-200 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors">
                    <PlusCircle size={13} /> Add Site
                  </button>
                )}
              </div>

              {siteAddresses.length === 0 ? (
                <button type="button" onClick={() => setSiteAddresses([emptySite()])}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 text-sm text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/40 transition-all flex items-center justify-center gap-2">
                  <MapPin size={16} /> Click to add a site address
                </button>
              ) : (
                <div className="space-y-3">
                  {siteAddresses.map((site, i) => (
                    <div key={i} className="relative border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
                      <button type="button" onClick={() => setSiteAddresses(s => s.filter((_, idx) => idx !== i))}
                        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors">
                        <X size={11} />
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <input type="text" value={site.label}
                          onChange={e => setSiteAddresses(s => s.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                          placeholder="Site label (e.g. Main Site, Warehouse, Project A)"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white" />
                      </div>
                      <input type="text" value={site.address}
                        onChange={e => setSiteAddresses(s => s.map((x, idx) => idx === i ? { ...x, address: e.target.value } : x))}
                        placeholder="Street / Plot / Survey address"
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white" />
                      <div className="grid grid-cols-3 gap-2">
                        {(['city', 'state', 'pincode'] as const).map(field => (
                          <input key={field} type="text" value={site[field]}
                            onChange={e => setSiteAddresses(s => s.map((x, idx) => idx === i ? { ...x, [field]: e.target.value } : x))}
                            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white" />
                        ))}
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setSiteAddresses(s => [...s, emptySite()])}
                    className="w-full border border-dashed border-gray-300 rounded-xl py-2.5 text-xs font-medium text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/40 transition-all flex items-center justify-center gap-1.5">
                    <Plus size={13} /> Add another site
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right column — 1/3 width */}
          <div className="space-y-6">

            {/* Business Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Business</h2>
              <Field label="GSTIN (B2B)" name="gstin" placeholder="27AABCU9603R1ZX" {...fp} />
              <Field label="Credit Limit (₹)" name="creditLimit" type="number" step="0.01" min="0" {...fp} />
              <Field label="Discount %" name="discountPercent" type="number" step="0.1" min="0" max="100" {...fp} />
            </div>

            {/* Save card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold text-sm transition-colors">
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
                  : <>{isEdit ? 'Update Customer' : 'Create Customer'}</>}
              </button>
              <button type="button" onClick={() => navigate('/customers')}
                className="w-full py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
