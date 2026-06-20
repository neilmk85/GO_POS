import { useState, useMemo } from 'react'
import { Search, X, ToggleLeft, ToggleRight, ShieldCheck, ShieldOff, Shield } from 'lucide-react'
import { PERMISSION_GROUPS } from '@/pages/staff/StaffPage'

const STORAGE_KEY = 'ppp_disabled_permissions'

function loadDisabled(): Set<string> {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? new Set(JSON.parse(s)) : new Set()
  } catch { return new Set() }
}

function saveDisabled(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

export function useDisabledPermissions() {
  return useMemo(loadDisabled, [])
}

export default function PermissionsSettings() {
  const [disabled, setDisabled] = useState<Set<string>>(loadDisabled)
  const [search, setSearch]     = useState('')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)

  const allItems = useMemo(
    () => PERMISSION_GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g.group, groupIcon: g.icon }))),
    []
  )

  const totalCount   = allItems.length
  const disabledCount = disabled.size
  const enabledCount  = totalCount - disabledCount

  function toggle(key: string) {
    setDisabled(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      saveDisabled(next)
      return next
    })
  }

  function toggleGroup(keys: string[]) {
    const allDisabled = keys.every(k => disabled.has(k))
    setDisabled(prev => {
      const next = new Set(prev)
      if (allDisabled) keys.forEach(k => next.delete(k))
      else             keys.forEach(k => next.add(k))
      saveDisabled(next)
      return next
    })
  }

  function enableAll() {
    setDisabled(new Set())
    localStorage.removeItem(STORAGE_KEY)
  }

  function disableAll() {
    const all = new Set(allItems.map(i => i.key))
    setDisabled(all)
    saveDisabled(all)
  }

  // Filter items
  const q = search.trim().toLowerCase()
  const visibleGroups = PERMISSION_GROUPS
    .filter(g => !groupFilter || g.group === groupFilter)
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        !q ||
        i.label.toLowerCase().includes(q) ||
        i.desc.toLowerCase().includes(q) ||
        i.key.toLowerCase().includes(q)
      ),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div className="space-y-5">

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Permissions', value: totalCount,    icon: <Shield size={16} className="text-violet-500" />,   cls: 'bg-violet-50 border-violet-100' },
          { label: 'Enabled',           value: enabledCount,  icon: <ShieldCheck size={16} className="text-emerald-500" />, cls: 'bg-emerald-50 border-emerald-100' },
          { label: 'Disabled',          value: disabledCount, icon: <ShieldOff size={16} className="text-red-400" />,    cls: 'bg-red-50 border-red-100' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${s.cls}`}>
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">{s.icon}</div>
            <div>
              <p className="text-xl font-extrabold text-gray-800 leading-none">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search permissions…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Group filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setGroupFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!groupFilter ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
          >
            All Groups
          </button>
          {PERMISSION_GROUPS.map(g => (
            <button
              key={g.group}
              onClick={() => setGroupFilter(groupFilter === g.group ? null : g.group)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${groupFilter === g.group ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >
              {g.icon} {g.group}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={enableAll}
            disabled={disabledCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ShieldCheck size={13} /> Enable All
          </button>
          <button
            onClick={disableAll}
            disabled={disabledCount === totalCount}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ShieldOff size={13} /> Disable All
          </button>
        </div>
      </div>

      {/* ── Permission groups ── */}
      {visibleGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <Search size={36} className="mb-3" />
          <p className="text-sm text-gray-400">No permissions match your search</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map(group => {
            const keys         = group.items.map(i => i.key)
            const groupEnabled  = keys.filter(k => !disabled.has(k)).length
            const allGroupOff   = keys.every(k => disabled.has(k))
            const someGroupOff  = keys.some(k => disabled.has(k))

            return (
              <div key={group.group} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                {/* Group header */}
                <div className={`flex items-center justify-between px-5 py-3 ${allGroupOff ? 'bg-red-50/60' : someGroupOff ? 'bg-amber-50/40' : 'bg-violet-50/60'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{group.icon}</span>
                    <span className="text-sm font-bold text-gray-800">{group.group}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      allGroupOff ? 'bg-red-100 text-red-600' : someGroupOff ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {groupEnabled}/{keys.length} enabled
                    </span>
                  </div>
                  {/* Group toggle — disable or enable entire group */}
                  <button
                    onClick={() => toggleGroup(keys)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                      allGroupOff
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    {allGroupOff ? 'Enable All' : 'Disable All'}
                  </button>
                </div>

                {/* Permission rows */}
                <div className="divide-y divide-gray-50">
                  {group.items.map(item => {
                    const isDisabled = disabled.has(item.key)
                    return (
                      <div
                        key={item.key}
                        className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${isDisabled ? 'bg-gray-50/80 opacity-60' : 'bg-white hover:bg-violet-50/30'}`}
                      >
                        {/* Status dot */}
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isDisabled ? 'bg-red-300' : 'bg-emerald-400'}`} />

                        {/* Permission info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${isDisabled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {item.label}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {item.key}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                        </div>

                        {/* Status badge */}
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                          isDisabled ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isDisabled ? 'Disabled' : 'Enabled'}
                        </span>

                        {/* Toggle */}
                        <button
                          onClick={() => toggle(item.key)}
                          className={`shrink-0 transition-colors ${isDisabled ? 'text-gray-300 hover:text-emerald-500' : 'text-emerald-500 hover:text-red-400'}`}
                          title={isDisabled ? 'Enable this permission' : 'Disable this permission'}
                        >
                          {isDisabled
                            ? <ToggleLeft  size={32} strokeWidth={1.5} />
                            : <ToggleRight size={32} strokeWidth={1.5} className="text-emerald-500" />
                          }
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
