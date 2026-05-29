import { Lock, LogOut } from 'lucide-react'
import { useAuth } from '../../state/AuthContext'
import { useOrg } from '../../state/OrgContext'
import { usePlan } from '../../state/PlanContext'

// Pantalla de bloqueo cuando la suscripción no está activa (past_due/canceled/unpaid).
export default function SubscriptionGate() {
  const { signOut } = useAuth()
  const { isOwnerOrAdmin, currentOrg } = useOrg()
  const { status } = usePlan()

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <div className="max-w-md rounded-2xl border border-line bg-panel p-7 text-center shadow-soft">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-fg">Suscripción {status === 'past_due' ? 'con pago pendiente' : 'inactiva'}</h2>
        <p className="mt-2 text-sm text-muted">
          {isOwnerOrAdmin
            ? `El acceso de ${currentOrg?.name || 'tu empresa'} está pausado. Actualiza el método de pago para reactivarlo.`
            : 'El acceso de tu empresa está pausado. Contacta con el propietario de la cuenta.'}
        </p>
        {isOwnerOrAdmin && (
          <p className="mt-4 rounded-lg border border-line bg-inset p-3 text-xs text-muted">
            La gestión de pagos se activa con la integración de Stripe (próximamente).
          </p>
        )}
        <button onClick={signOut} className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
          <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
        </button>
      </div>
    </div>
  )
}
