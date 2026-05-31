// Pila de manejadores del botón "atrás" de Android (y del gesto atrás).
//
// Patrón: cada superficie efímera (hoja inferior, drawer de rider, lock, command
// palette…) registra un manejador al abrirse y lo elimina al cerrarse. El botón
// atrás físico invoca SIEMPRE el manejador más reciente (LIFO). Si la pila está
// vacía, el llamador decide (volver a 'dashboard' o minimizar la app).
//
// Es un módulo simple (no React) para poder registrarse desde efectos sin recrear
// listeners globales por componente.

const stack = []

// Registra un manejador. Devuelve una función para quitarlo (úsala en el cleanup
// del useEffect). El manejador debe devolver true si "consumió" el atrás.
export function pushBackHandler(fn) {
  const entry = { fn }
  stack.push(entry)
  return () => {
    const i = stack.indexOf(entry)
    if (i >= 0) stack.splice(i, 1)
  }
}

// Ejecuta el manejador superior. Devuelve true si alguno consumió el evento.
export function runTopBackHandler() {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const consumed = stack[i].fn?.()
    if (consumed) return true
    // Un manejador que devuelve undefined/false se considera inactivo: probamos el
    // siguiente (permite registrar manejadores que solo actúan bajo cierta condición).
  }
  return false
}

export function hasBackHandlers() {
  return stack.length > 0
}
