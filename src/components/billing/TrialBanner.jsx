import { Sparkles } from 'lucide-react'
import { usePlan } from '../../state/PlanContext'
import { useApp } from '../../state/AppContext'

// Aviso de prueba: días restantes. Lleva a Ajustes ▸ Facturación.
export default function TrialBanner() {
  const { isTrial, daysLeftInTrial } = usePlan()
  const { setActiveNav } = useApp()
  if (!isTrial || daysLeftInTrial == null) return null
  return (
    <button
      onClick={() => setActiveNav('config')}
      className="flex w-full items-center justify-center gap-2 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/15"
    >
      <Sparkles className="h-3.5 w-3.5" />
      {daysLeftInTrial > 0
        ? `Prueba gratuita · te quedan ${daysLeftInTrial} ${daysLeftInTrial === 1 ? 'día' : 'días'}`
        : 'Tu prueba ha terminado'} · gestiona tu plan
    </button>
  )
}
