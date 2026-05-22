import { useEffect, useState } from 'react'

// Reloj compartido: re-renderiza cada `intervalMs` para cronómetros y tiempos relativos.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
