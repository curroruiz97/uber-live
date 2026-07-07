import { useState } from 'react'
import clsx from 'clsx'
import { Building2, Users, Plug, CreditCard, Palette, Bell, ShieldCheck, CalendarClock } from 'lucide-react'
import { useOrg } from '../../state/OrgContext'
import AccountCompanySection from './sections/AccountCompanySection'
import TeamSection from './sections/TeamSection'
import IntegrationsSection from './sections/IntegrationsSection'
import BillingSection from './sections/BillingSection'
import BrandingSection from './sections/BrandingSection'
import NotificationsSection from './sections/NotificationsSection'
import SecuritySection from './sections/SecuritySection'
import SchedulesSection from './sections/SchedulesSection'
import { VIEWER_SETTINGS } from '../../config/nav'

const SECTIONS = [
  { id: 'cuenta', label: 'Cuenta y empresa', icon: Building2, Comp: AccountCompanySection },
  { id: 'equipo', label: 'Equipo y roles', icon: Users, Comp: TeamSection },
  { id: 'integraciones', label: 'Integraciones / APIs', icon: Plug, Comp: IntegrationsSection },
  { id: 'horarios', label: 'Cumplimiento', icon: CalendarClock, Comp: SchedulesSection },
  { id: 'facturacion', label: 'Facturación y plan', icon: CreditCard, Comp: BillingSection },
  { id: 'marca', label: 'Marca', icon: Palette, Comp: BrandingSection },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, Comp: NotificationsSection },
  { id: 'seguridad', label: 'Seguridad', icon: ShieldCheck, Comp: SecuritySection },
]

export default function SettingsLayout() {
  const { isViewer } = useOrg()
  const sections = isViewer ? SECTIONS.filter((s) => VIEWER_SETTINGS.has(s.id)) : SECTIONS
  const [active, setActive] = useState(sections[0].id)
  const current = sections.find((s) => s.id === active) || sections[0]
  const Comp = current.Comp

  return (
    <div className="w-full">
      {/* Móvil: tabs horizontales */}
      <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 md:hidden">
        {sections.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
                active === s.id ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-inset',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          )
        })}
      </div>

      <div className="md:grid md:grid-cols-[14rem_1fr] md:gap-6">
        {/* Escritorio: sub-nav lateral */}
        <nav className="hidden md:block">
          <div className="sticky top-20 space-y-1">
            {sections.map((s) => {
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
