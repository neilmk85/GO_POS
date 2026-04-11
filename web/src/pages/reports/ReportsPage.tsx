import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, ShoppingCart, Package, Users, IndianRupee } from 'lucide-react'
import { reportApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function ReportsPage() {
  const { outletId } = useAuthStore()
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [summary, setSummary] = useState<any>(null)
  const [dailyTrend, setDailyTrend] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchReports = async () => {
    if (!outletId) return
    setLoading(true)
    try {
      const [summaryRes, trendRes, productsRes, paymentsRes] = await Promise.all([
        reportApi.getSalesSummary(outletId, from, to),
        reportApi.getDailyTrend(outletId, from, to),
        reportApi.getTopProducts(outletId, from, to, 10),
        reportApi.getPaymentMethods(outletId, from, to),
      ])
      setSummary(summaryRes.data.data)
      setDailyTrend(trendRes.data.data || [])
      setTopProducts(productsRes.data.data || [])
      setPaymentMethods(paymentsRes.data.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReports() }, [from, to, outletId])

  const statCards = summary ? [
    { label: 'Total Revenue',   value: `₹${Number(summary.totalRevenue || 0).toLocaleString()}`,  icon: <IndianRupee size={18} />, gradient: 'from-blue-500 to-indigo-600'   },
    { label: 'Total Orders',    value: summary.totalOrders || 0,                                   icon: <ShoppingCart size={18} />, gradient: 'from-emerald-500 to-teal-600'  },
    { label: 'Avg Order Value', value: `₹${Number(summary.avgOrderValue || 0).toFixed(0)}`,       icon: <TrendingUp size={18} />,   gradient: 'from-amber-400 to-orange-500'  },
    { label: 'Gross Profit',    value: `₹${Number(summary.grossProfit || 0).toLocaleString()}`,   icon: <Package size={18} />,      gradient: 'from-violet-500 to-purple-600' },
  ] : []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <div className="flex items-center gap-3">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <span className="text-gray-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white shrink-0 shadow-sm`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Sales Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Sales Trend</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => { const [y,m,day] = (d??'').substring(0,10).split('-'); return day && m && y ? `${day}/${m}/${y}` : d }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={paymentMethods} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={90} label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`}>
                {paymentMethods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topProducts} layout="vertical">
            <defs>
              <linearGradient id="topProdGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
            <YAxis dataKey="productName" type="category" width={150} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
            <Bar dataKey="totalRevenue" fill="url(#topProdGrad)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
