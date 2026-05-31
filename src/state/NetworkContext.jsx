import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { isNative } from '../native/platform'

// Estado de conexión. En nativo usa @capacitor/network (más fiable que navigator);
// en web cae a navigator.onLine + eventos online/offline. Lo consume el banner de
// "sin conexión" y, más adelante, la cola de mutaciones offline.
const NetworkContext = createContext({ online: true })

export function useNetwork() {
  return useContext(NetworkContext)
}

export function NetworkProvider({ children }) {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let cleanup = () => {}

    if (isNative) {
      let listener
      ;(async () => {
        try {
          const { Network } = await import('@capacitor/network')
          const status = await Network.getStatus()
          setOnline(status.connected)
          listener = await Network.addListener('networkStatusChange', (s) => setOnline(s.connected))
        } catch {
          setOnline(true)
        }
      })()
      cleanup = () => {
        try {
          listener?.remove?.()
        } catch {
          /* ignore */
        }
      }
    } else {
      setOnline(navigator.onLine)
      const on = () => setOnline(true)
      const off = () => setOnline(false)
      window.addEventListener('online', on)
      window.addEventListener('offline', off)
      cleanup = () => {
        window.removeEventListener('online', on)
        window.removeEventListener('offline', off)
      }
    }

    return cleanup
  }, [])

  const value = useMemo(() => ({ online }), [online])
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}
