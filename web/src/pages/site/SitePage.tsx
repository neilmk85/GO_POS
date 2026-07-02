import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SiteFloatingNav from './SiteFloatingNav'
import { Archive, FileText, HardHat, ClipboardList, FolderOpen, Truck, ClipboardCheck, CalendarDays, IndianRupee, TrendingUp, Moon, Sparkles, Sun } from 'lucide-react'

type Theme = 'dark' | 'gradient' | 'white'

interface SiteCard {
  key: string
  tag: string
  label: string
  description: string
  icon: React.ReactNode
  buttonLabel: string
  glowColor: string
  accentColor: string
  lightBg: string
  lightBorder: string
  lightText: string
}

const CARDS: SiteCard[] = [
  {
    key: 'projects',
    tag: 'MANAGEMENT',
    label: 'Projects',
    description: 'Track site projects, contract values, scope of work and project timelines all in one place.',
    icon: <FolderOpen size={22} />,
    buttonLabel: 'View Projects',
    glowColor: 'rgba(59,130,246,0.45)',
    accentColor: '#3b82f6',
    lightBg: '#eff6ff',
    lightBorder: '#bfdbfe',
    lightText: '#1d4ed8',
  },
  {
    key: 'contractors',
    tag: 'CONTRACTORS',
    label: 'Contractors',
    description: 'Manage sub-contractors, rate contracts and contractor details for every site project.',
    icon: <HardHat size={22} />,
    buttonLabel: 'View Contractors',
    glowColor: 'rgba(99,102,241,0.45)',
    accentColor: '#6366f1',
    lightBg: '#eef2ff',
    lightBorder: '#c7d2fe',
    lightText: '#4338ca',
  },
  {
    key: 'work-orders',
    tag: 'OPERATIONS',
    label: 'Work Orders',
    description: 'Define sub-contract scope, track assigned work and monitor progress against each order.',
    icon: <ClipboardList size={22} />,
    buttonLabel: 'View Work Orders',
    glowColor: 'rgba(14,165,233,0.45)',
    accentColor: '#0ea5e9',
    lightBg: '#f0f9ff',
    lightBorder: '#bae6fd',
    lightText: '#0369a1',
  },
  {
    key: 'material-stock',
    tag: 'INVENTORY',
    label: 'Material Stock',
    description: 'Monitor site inventory levels, material receipts and consumption at each project location.',
    icon: <Archive size={22} />,
    buttonLabel: 'View Stock',
    glowColor: 'rgba(20,184,166,0.45)',
    accentColor: '#14b8a6',
    lightBg: '#f0fdfa',
    lightBorder: '#99f6e4',
    lightText: '#0f766e',
  },
  {
    key: 'work-bills',
    tag: 'BILLING',
    label: 'Work Bills',
    description: 'Raise and manage sub-contractor bills with GST, TDS deductions and payment tracking.',
    icon: <FileText size={22} />,
    buttonLabel: 'View Bills',
    glowColor: 'rgba(168,85,247,0.45)',
    accentColor: '#a855f7',
    lightBg: '#faf5ff',
    lightBorder: '#e9d5ff',
    lightText: '#7e22ce',
  },
  {
    key: 'material-issues',
    tag: 'LOGISTICS',
    label: 'Material Issues',
    description: 'Record materials issued to contractors on-site with quantity, date and approval tracking.',
    icon: <Truck size={22} />,
    buttonLabel: 'View Issues',
    glowColor: 'rgba(34,197,94,0.45)',
    accentColor: '#22c55e',
    lightBg: '#f0fdf4',
    lightBorder: '#bbf7d0',
    lightText: '#15803d',
  },
  {
    key: 'progress-claims',
    tag: 'CLAIMS',
    label: 'Progress Claims',
    description: 'Process contractor progress claims, verify completed work and approve payments.',
    icon: <ClipboardCheck size={22} />,
    buttonLabel: 'View Claims',
    glowColor: 'rgba(244,63,94,0.45)',
    accentColor: '#f43f5e',
    lightBg: '#fff1f2',
    lightBorder: '#fecdd3',
    lightText: '#be123c',
  },
  {
    key: 'daily-progress',
    tag: 'TRACKING',
    label: 'Daily Progress',
    description: 'Log daily in-house work, labour attendance, equipment usage and site activity notes.',
    icon: <CalendarDays size={22} />,
    buttonLabel: 'View Progress',
    glowColor: 'rgba(6,182,212,0.45)',
    accentColor: '#06b6d4',
    lightBg: '#ecfeff',
    lightBorder: '#a5f3fc',
    lightText: '#0e7490',
  },
  {
    key: 'reports/financial-summary',
    tag: 'REPORTS',
    label: 'Financial Report',
    description: 'Get a full picture of billing, contractor payments, outstanding balances and cost summary.',
    icon: <IndianRupee size={22} />,
    buttonLabel: 'View Report',
    glowColor: 'rgba(16,185,129,0.45)',
    accentColor: '#10b981',
    lightBg: '#ecfdf5',
    lightBorder: '#a7f3d0',
    lightText: '#065f46',
  },
  {
    key: 'reports/progress-report',
    tag: 'ANALYTICS',
    label: 'Progress Report',
    description: 'Analyse phase-wise completion percentages, daily trends and project velocity over time.',
    icon: <TrendingUp size={22} />,
    buttonLabel: 'View Report',
    glowColor: 'rgba(139,92,246,0.45)',
    accentColor: '#8b5cf6',
    lightBg: '#f5f3ff',
    lightBorder: '#ddd6fe',
    lightText: '#5b21b6',
  },
]

// ── Dark theme card ───────────────────────────────────────────────────────────
function DarkCard({ card }: { card: SiteCard }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => navigate(`/site/${card.key}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#111827', borderRadius: 24, padding: 35,
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        border: hovered ? `1px solid ${card.glowColor.replace('0.45', '0.4')}` : '1px solid rgba(255,255,255,0.05)',
        boxShadow: hovered
          ? `0 0 20px ${card.glowColor.replace('0.45', '0.25')}, 0 0 50px ${card.glowColor.replace('0.45', '0.15')}, 0 20px 40px rgba(0,0,0,0.5)`
          : 'none',
        transform: hovered ? 'translateY(-8px)' : 'translateY(0)',
        transition: 'transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease',
      }}
    >
      <div style={{
        position: 'absolute', width: 220, height: 220,
        background: `radial-gradient(circle, ${card.glowColor} 0%, ${card.glowColor.replace('0.45', '0.15')} 40%, transparent 75%)`,
        top: -80, right: -80, pointerEvents: 'none',
        opacity: hovered ? 1 : 0, transform: hovered ? 'scale(1.2)' : 'scale(1)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }} />
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', background: card.glowColor.replace('0.45', '0.12'),
        border: `1px solid ${card.glowColor.replace('0.45', '0.3')}`,
        color: '#93c5fd', borderRadius: 50, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.08em', marginBottom: 22,
      }}>
        {card.icon}{card.tag}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 14, lineHeight: 1.3 }}>{card.label}</div>
      <div style={{ color: '#cbd5e1', lineHeight: 1.7, fontSize: 14, marginBottom: 28 }}>{card.description}</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: hovered ? 14 : 8,
        color: '#60a5fa', fontWeight: 600, fontSize: 14, transition: 'gap 0.3s ease',
      }}>
        {card.buttonLabel} →
      </div>
    </div>
  )
}

// ── Gradient theme card ───────────────────────────────────────────────────────
function GradientCard({ card }: { card: SiteCard }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => navigate(`/site/${card.key}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 24, padding: 35, position: 'relative', overflow: 'hidden', cursor: 'pointer',
        border: hovered ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.18)',
        boxShadow: hovered ? '0 8px 40px rgba(80,40,160,0.35), 0 20px 60px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.15)',
        transform: hovered ? 'translateY(-8px)' : 'translateY(0)',
        transition: 'transform 0.35s ease, box-shadow 0.35s ease, background 0.35s ease, border-color 0.35s ease',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)',
        opacity: hovered ? 1 : 0, transition: 'opacity 0.4s ease', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 200, height: 200,
        background: 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(200,180,255,0.15) 45%, transparent 75%)',
        top: -70, right: -70, pointerEvents: 'none',
        opacity: hovered ? 1 : 0, transform: hovered ? 'scale(1.3)' : 'scale(0.8)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }} />
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
        background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)',
        color: '#e0d7ff', borderRadius: 50, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.08em', marginBottom: 22,
      }}>
        {card.icon}{card.tag}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 14, lineHeight: 1.3, textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>{card.label}</div>
      <div style={{ color: 'rgba(235,230,255,0.85)', lineHeight: 1.7, fontSize: 14, marginBottom: 28 }}>{card.description}</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: hovered ? 14 : 8,
        color: '#e0d7ff', fontWeight: 600, fontSize: 14, transition: 'gap 0.3s ease',
      }}>
        {card.buttonLabel} →
      </div>
    </div>
  )
}

// ── White theme card (clean minimal style) ───────────────────────────────────
function WhiteCard({ card }: { card: SiteCard }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => navigate(`/site/${card.key}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: '30px 30px 26px 30px',
        cursor: 'pointer',
        border: 'none',
        boxShadow: hovered
          ? '0 20px 48px rgba(0,0,0,0.12), 0 6px 16px rgba(0,0,0,0.07)'
          : '0 4px 24px rgba(0,0,0,0.08), 0 1px 6px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-5px)' : 'translateY(0)',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        fontFamily: '"Roboto", sans-serif',
      }}
    >
      {/* Title */}
      <div style={{
        fontSize: 18, fontWeight: 300, color: '#0f172a',
        marginBottom: 10, lineHeight: 1.3, letterSpacing: '-0.4px',
        fontFamily: '"Roboto", sans-serif',
      }}>
        {card.label}
      </div>

      {/* Description */}
      <div style={{
        color: '#94a3b8', lineHeight: 1.8, fontSize: 13,
        fontWeight: 400, marginBottom: 28, letterSpacing: '0.01em',
        fontFamily: '"Roboto", sans-serif',
      }}>
        {card.description}
      </div>

      {/* CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        color: '#3b82f6', fontWeight: 500, fontSize: 12.5,
        letterSpacing: '0.02em',
        fontFamily: '"Roboto", sans-serif',
        transform: hovered ? 'translateX(4px)' : 'translateX(0)',
        transition: 'transform 0.25s ease',
      }}>
        {card.buttonLabel}
        <span style={{ fontSize: 14 }}>→</span>
      </div>
    </div>
  )
}

// ── Theme Toggle ──────────────────────────────────────────────────────────────
interface ThemeOption { key: Theme; label: string; icon: React.ReactNode }
const THEMES: ThemeOption[] = [
  { key: 'dark',     label: 'Dark',     icon: <Moon size={13} /> },
  { key: 'gradient', label: 'Gradient', icon: <Sparkles size={13} /> },
  { key: 'white',    label: 'Light',    icon: <Sun size={13} /> },
]

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SitePage() {
  const [theme, setTheme] = useState<Theme>('dark')
  const navigate = useNavigate()

  const pageStyle: React.CSSProperties =
    theme === 'dark'
      ? { background: '#0f172a', minHeight: '100vh', padding: '60px 48px', color: 'white' }
      : theme === 'gradient'
      ? {
          background: 'linear-gradient(135deg, #f4f2ff 0%, #ddd8ff 15%, #b0a6f0 32%, #7260d8 52%, #3d28b0 68%, #20108a 82%, #0e0858 100%)',
          minHeight: '100vh', padding: '60px 48px', color: 'white',
        }
      : {
          minHeight: '100vh', padding: '60px 48px', color: '#0f172a',
        }

  const isDark = theme !== 'white'

  return (
    <div style={pageStyle} className={theme === 'white' ? 'light-bg-anim' : ''}>
      {theme === 'white' && (
        <style>{`
          @keyframes lightGradientShift {
            0%   { background-position: 0% 0%; }
            25%  { background-position: 100% 0%; }
            50%  { background-position: 100% 100%; }
            75%  { background-position: 0% 100%; }
            100% { background-position: 0% 0%; }
          }
          .light-bg-anim {
            background: linear-gradient(135deg,
              #f5f8ff, #f8f4ff, #fff5fb, #fef9f0,
              #f2fdf8, #f5f8ff, #fbf4ff, #f5f8ff);
            background-size: 400% 400%;
            animation: lightGradientShift 20s ease infinite;
          }
        `}</style>
      )}
      <SiteFloatingNav theme={theme === 'white' ? 'light' : 'dark'} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 52 }}>
          <div>
            <div style={{
              fontSize: 40, fontWeight: 800, letterSpacing: '-0.5px',
              color: theme === 'white' ? '#0f172a' : '#fff',
            }}>
              Site Management
            </div>
            {theme === 'white' && (
              <p style={{ marginTop: 8, color: '#64748b', fontSize: 15 }}>
                Manage projects, contractors, billing and daily operations
              </p>
            )}
          </div>

          {/* 3-way theme pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            padding: 4, borderRadius: 50,
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
            backdropFilter: 'blur(8px)',
          }}>
            {THEMES.map(t => {
              const active = theme === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 50, border: 'none',
                    background: active
                      ? (isDark ? 'rgba(255,255,255,0.15)' : '#fff')
                      : 'transparent',
                    color: active
                      ? (isDark ? '#fff' : '#0f172a')
                      : (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'),
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    boxShadow: active && !isDark ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
                    transition: 'all 0.25s ease',
                    letterSpacing: '0.02em',
                  }}
                >
                  {t.icon}{t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: theme === 'white' ? 24 : 28,
        }}>
          {CARDS.map(card =>
            theme === 'dark'
              ? <DarkCard key={card.key} card={card} />
              : theme === 'gradient'
              ? <GradientCard key={card.key} card={card} />
              : <WhiteCard key={card.key} card={card} />
          )}
        </div>

      </div>
    </div>
  )
}
