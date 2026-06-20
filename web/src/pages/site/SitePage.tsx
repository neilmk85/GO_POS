import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Building2, FileText, HardHat, ClipboardList, FolderOpen, Truck, ClipboardCheck, CalendarDays, IndianRupee, TrendingUp } from 'lucide-react'

interface SiteCard {
  key: string
  label: string
  description: string
  icon: React.ReactNode
  gradient: string
  glow: string
}

const CARDS: SiteCard[] = [
  {
    key: 'projects',
    label: 'Projects',
    description: 'Site projects & contract details',
    icon: <FolderOpen size={32} />,
    gradient: 'linear-gradient(135deg, #0f2952 0%, #1a4a8a 50%, #2563eb 100%)',
    glow: 'rgba(37,99,235,0.55)',
  },
  {
    key: 'contractors',
    label: 'Contractors',
    description: 'Sub-contractors & rate contracts',
    icon: <HardHat size={32} />,
    gradient: 'linear-gradient(135deg, #001e5e 0%, #0050b3 50%, #0078d4 100%)',
    glow: 'rgba(0,120,212,0.55)',
  },
  {
    key: 'work-orders',
    label: 'Work Orders',
    description: 'Sub-contract scope & tracking',
    icon: <ClipboardList size={32} />,
    gradient: 'linear-gradient(135deg, #003070 0%, #0063b1 50%, #2b90d9 100%)',
    glow: 'rgba(0,99,177,0.55)',
  },
  {
    key: 'material-stock',
    label: 'Material Stock',
    description: 'Site inventory & stock levels',
    icon: <Archive size={32} />,
    gradient: 'linear-gradient(135deg, #004a8f 0%, #0078d4 50%, #40aaf5 100%)',
    glow: 'rgba(0,120,212,0.5)',
  },
  {
    key: 'work-bills',
    label: 'Work Bills',
    description: 'Sub-contractor billing & GST',
    icon: <FileText size={32} />,
    gradient: 'linear-gradient(135deg, #001a50 0%, #0041a8 50%, #0078d4 100%)',
    glow: 'rgba(0,65,168,0.55)',
  },
  {
    key: 'material-issues',
    label: 'Material Issues',
    description: 'Material issued to contractors',
    icon: <Truck size={32} />,
    gradient: 'linear-gradient(135deg, #1a3a00 0%, #3a7a00 50%, #5aab00 100%)',
    glow: 'rgba(90,171,0,0.5)',
  },
  {
    key: 'progress-claims',
    label: 'Progress Claims',
    description: 'Contractor claims & verification',
    icon: <ClipboardCheck size={32} />,
    gradient: 'linear-gradient(135deg, #3a0070 0%, #7a00b3 50%, #a020f0 100%)',
    glow: 'rgba(160,32,240,0.5)',
  },
  {
    key: 'daily-progress',
    label: 'Daily Progress',
    description: 'Inhouse work, labour & equipment',
    icon: <CalendarDays size={32} />,
    gradient: 'linear-gradient(135deg, #003d3d 0%, #006b6b 50%, #009999 100%)',
    glow: 'rgba(0,153,153,0.5)',
  },
  {
    key: 'reports/financial-summary',
    label: 'Financial Report',
    description: 'Billing, payments & outstanding',
    icon: <IndianRupee size={32} />,
    gradient: 'linear-gradient(135deg, #0d3320 0%, #155a35 50%, #1e7a4a 100%)',
    glow: 'rgba(30,122,74,0.5)',
  },
  {
    key: 'reports/progress-report',
    label: 'Progress Report',
    description: 'Phase-wise completion & daily trend',
    icon: <TrendingUp size={32} />,
    gradient: 'linear-gradient(135deg, #1e1060 0%, #3730a3 50%, #4f46e5 100%)',
    glow: 'rgba(79,70,229,0.5)',
  },
]

function SiteCard({ card }: { card: SiteCard }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={() => navigate(card.key === 'pos' ? '/pos' : `/site/${card.key}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: card.gradient,
        boxShadow: hovered
          ? `0 16px 40px ${card.glow}, 0 4px 12px rgba(0,0,0,0.15)`
          : `0 4px 16px ${card.glow.replace('0.5', '0.25')}, 0 2px 6px rgba(0,0,0,0.08)`,
        transform: hovered ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)',
        transition: 'box-shadow 0.25s ease, transform 0.2s ease',
      }}
      className="group relative overflow-hidden rounded-2xl p-8 flex flex-col items-center gap-4 text-center cursor-pointer active:scale-[0.97] w-full"
    >
      {/* Shine overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)',
        }}
      />
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white"
        style={{
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(4px)',
          transform: hovered ? 'scale(1.12)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}
      >
        {card.icon}
      </div>
      <div>
        <p className="text-base font-bold text-white tracking-wide">{card.label}</p>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{card.description}</p>
      </div>
    </button>
  )
}

export default function SitePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Site</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage site information, contacts, and deliveries</p>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-3xl">
          {CARDS.map(card => (
            <SiteCard key={card.key} card={card} />
          ))}
        </div>
      </div>
    </div>
  )
}
