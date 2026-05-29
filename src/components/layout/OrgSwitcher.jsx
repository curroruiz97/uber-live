import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Building2, ChevronDown, Check } from 'lucide-react'
import { useOrg } from '../../state/OrgContext'

// Indicador de empresa activa en la Topbar. Con varias empresas, despliega un
// menú para cambiar entre ellas.
export default function OrgSwitcher() {
  const { orgs, currentOrg, switchOrg } = useOrg()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!currentOrg) return null

  if (orgs.length <= 1) {
    return (
      <span className="hidden max-w-[160px] items-center gap-1.5 truncate text-xs font-medium text-muted lg:inline-flex">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-faint" />
        {currentOrg.name}
      </span>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-inset px-2 py-1 text-xs font-medium text-fg transition hover:border-accent/40"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-faint" />
        <span className="max-w-[120px] truncate">{currentOrg.name}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-faint" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-line bg-panel p-1 shadow-soft">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Tus empresas</p>
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                switchOrg(o.id)
                setOpen(false)
              }}
              className={clsx(
                'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition',
                o.id === currentOrg.id ? 'bg-accent/10 text-fg' : 'text-muted hover:bg-inset hover:text-fg',
              )}
            >
              <span className="truncate">{o.name}</span>
              {o.id === currentOrg.id && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
