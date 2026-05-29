import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from './OrgContext'

// Plan y créditos de la organización activa (suscripción + saldo), en vivo.
// Gobierna el acceso (trial/active/past_due) y los límites de envío.
const PlanContext = createContext(null)

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan debe usarse dentro de <PlanProvider>')
  return ctx
}

export function PlanProvider({ children }) {
  const { currentOrgId: orgId } = useOrg()
  const [sub, setSub] = useState(null)
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!orgId) return
    const [s, b] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('org_id', orgId).maybeSingle(),
      supabase.from('credit_balance').select('balance').eq('org_id', orgId).maybeSingle(),
    ])
    setSub(s.data || null)
    setBalance(b.data?.balance ?? null)
    setLoading(false)
  }, [orgId])

  useEffect(() => { setLoading(true); load() }, [load])

  useEffect(() => {
    if (!orgId) return undefined
    const ch = supabase
      .channel(`plan_${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `org_id=eq.${orgId}` }, (p) => setSub(p.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_balance', filter: `org_id=eq.${orgId}` }, (p) => setBalance(p.new?.balance ?? 0))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [orgId])

  const value = useMemo(() => {
    const status = sub?.status || 'trialing'
    const active = ['active', 'trialing'].includes(status)
    const trialEnd = sub?.trial_end ? Date.parse(sub.trial_end) : null
    const daysLeftInTrial = trialEnd ? Math.max(0, Math.ceil((trialEnd - Date.now()) / 86400000)) : null
    const creditBalance = balance ?? 0
    return {
      loading,
      sub,
      status,
      tier: sub?.tier || 'trial',
      riderLimit: sub?.rider_limit ?? null,
      includedCredits: sub?.included_credits ?? 0,
      creditBalance,
      trialEnd,
      daysLeftInTrial,
      isTrial: status === 'trialing',
      isBlocked: !active,
      canSend: (n) => active && creditBalance >= (n || 0),
      refresh: load,
    }
  }, [sub, balance, loading, load])

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}
