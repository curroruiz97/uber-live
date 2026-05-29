import { useState } from 'react'
import clsx from 'clsx'
import { Building2, Users, Plug, CreditCard, Palette, Bell } from 'lucide-react'
import AccountCompanySection from './sections/AccountCompanySection'
import TeamSection from './sections/TeamSection'
import IntegrationsSection from './sections/IntegrationsSection'
import BillingSection from './sections/BillingSection'
import BrandingSection from './sections/BrandingSection'
import NotificationsSection from './sections/NotificationsSection'

const SECTIONS = [
  { id: 'cuenta', label: 'Cuenta y empresa', icon: Building2, Comp: AccountCompanySection },
  { id: 'equipo', label: 'Equipo y roles', icon: Users, Comp: TeamSection },
  { id: 'integraciones', label: 'Integraciones / APIs', icon: Plug, Comp: IntegrationsSection },
  { id: 'facturacion', label: 'Facturación y plan', icon: CreditCard, Comp: BillingSection },
  { id: 'marca', label: 'Marca', icon: Palette, Comp: BrandingSection },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, Comp: NotificationsSection },
]

export default function SettingsLayout() {
  const [active, setActive] = useState('cuenta')
  const current = SECTIONS.find((s) => s.id === active) || SECTIONS[0]
  const Comp = current.Comp

  return (
    <div className="w-full">
      {/* Móvil: tabs horizontales */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1 md:hidden">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={clsx(
              'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition',
              active === s.id ? 'bg-accent/15 text-accent ring-1 ring-accent/30' : 'text-muted hover:bg-inset',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="md:grid md:grid-cols-[14rem_1fr] md:gap-6">
        {/* Escritorio: sub-nav lateral */}
        <nav className="hidden md:block">
          <div className="sticky top-20 space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const on = active === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={clsx(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                    on ? 'bg-accent/15 text-fg ring-1 ring-accent/30' : 'text-muted hover:bg-inset hover:text-fg',
                  )}
                >
                  <Icon className={clsx('h-4 w-4 shrink-0', on && 'text-accent')} />
                  <span className="truncate">{s.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="min-w-0">
          <Comp />
        </div>
      </div>
    </div>
  )
}
