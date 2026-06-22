import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from './OrgContext'
import { useFleet } from './useFleetData'
import { useApp } from './AppContext'

function digits(s) {
  return String(s || '').replace(/\D/g, '')
}

export function useSessionTracker() {
  const { currentOrgId } = useOrg()
  const { riders, isDemo } = useFleet()
  const { demoMode } = useApp()
  const prevRef = useRef(new Map())
  const openSessionsRef = useRef(new Set())
  const initedRef = useRef(false)
  const writingRef = useRef(false)

  useEffect(() => {
    if (demoMode || isDemo || !currentOrgId || !riders.length) return

    const prev = prevRef.current
    const openSessions = openSessionsRef.current

    if (!initedRef.current) {
      initedRef.current = true
      ;(async () => {
        const { data } = await supabase
          .from('rider_sessions')
          .select('id, rider_key, connected_at')
          .eq('org_id', currentOrgId)
          .is('disconnected_at', null)

        const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const staleIds = []
        for (const s of data || []) {
          if (s.connected_at < staleThreshold) {
            staleIds.push(s.id)
          } else {
            openSessions.add(s.rider_key)
          }
        }

        if (staleIds.length) {
          await supabase
            .from('rider_sessions')
            .update({ disconnected_at: new Date().toISOString() })
            .in('id', staleIds)
        }

        const opens = []
        for (const r of riders) {
          const key = r.phone ? digits(r.phone) : r.id
          prev.set(r.id, { status: r.status, riderKey: key })
          if (r.status !== 'offline' && !openSessions.has(key)) {
            opens.push({
              org_id: currentOrgId,
              rider_key: key,
              rider_name: r.name,
              provider: r.provider || 'uber',
              city: r.zone?.city || null,
              vehicle_type: r.vehicleType || null,
              last_status: r.status,
              trips_start: r.tripsToday || 0,
            })
            openSessions.add(key)
          }
        }
        if (opens.length) {
          await supabase.from('rider_sessions').insert(opens)
        }
      })()
      return
    }

    const curr = new Map()
    const opens = []
    const closes = []

    for (const r of riders) {
      const key = r.phone ? digits(r.phone) : r.id
      curr.set(r.id, { status: r.status, riderKey: key })

      const p = prev.get(r.id)
      if (p && p.status === 'offline' && r.status !== 'offline') {
        opens.push({
          org_id: currentOrgId,
          rider_key: key,
          rider_name: r.name,
          provider: r.provider || 'uber',
          city: r.zone?.city || null,
          vehicle_type: r.vehicleType || null,
          last_status: r.status,
          trips_start: r.tripsToday || 0,
        })
        openSessions.add(key)
      } else if (p && p.status !== 'offline' && r.status === 'offline') {
        closes.push({ riderKey: key, tripsEnd: r.tripsToday || 0 })
        openSessions.delete(key)
      }
    }

    for (const [id, p] of prev) {
      if (!curr.has(id) && p.status !== 'offline') {
        closes.push({ riderKey: p.riderKey, tripsEnd: 0 })
        openSessions.delete(p.riderKey)
      }
    }

    prevRef.current = curr

    if ((opens.length || closes.length) && !writingRef.current) {
      writingRef.current = true
      ;(async () => {
        try {
          if (opens.length) {
            await supabase.from('rider_sessions').insert(opens)
          }
          for (const c of closes) {
            await supabase
              .from('rider_sessions')
              .update({ disconnected_at: new Date().toISOString(), trips_end: c.tripsEnd })
              .eq('org_id', currentOrgId)
              .eq('rider_key', c.riderKey)
              .is('disconnected_at', null)
          }
        } catch (e) {
          console.warn('Session tracker:', e)
        } finally {
          writingRef.current = false
        }
      })()
    }
  }, [riders, currentOrgId, demoMode, isDemo])
}
