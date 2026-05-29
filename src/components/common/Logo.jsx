import { useContext } from 'react'
import { BrandContext } from '../../state/BrandContext'

// Logotipo. Usa el logo de la empresa activa (BrandContext) si existe; si no, o si
// la imagen falla, cae a los PNG de Sapiens. Cambia claro/oscuro según el tema.
// Funciona también fuera de BrandProvider (login/registro) usando los valores por defecto.
const FALLBACK_LIGHT = '/logo-light.png'
const FALLBACK_DARK = '/logo-dark.png'

export default function Logo({ className = 'h-8 w-auto' }) {
  const brand = useContext(BrandContext)
  const light = brand?.logoLightUrl || FALLBACK_LIGHT
  const dark = brand?.logoDarkUrl || FALLBACK_DARK
  const alt = brand?.companyName || 'Sapiens Telco Live'

  return (
    <>
      <img
        src={light}
        alt={alt}
        onError={(e) => {
          if (e.currentTarget.src !== window.location.origin + FALLBACK_LIGHT) e.currentTarget.src = FALLBACK_LIGHT
        }}
        className={`${className} block dark:hidden`}
        draggable={false}
      />
      <img
        src={dark}
        alt={alt}
        onError={(e) => {
          if (e.currentTarget.src !== window.location.origin + FALLBACK_DARK) e.currentTarget.src = FALLBACK_DARK
        }}
        className={`${className} hidden dark:block`}
        draggable={false}
      />
    </>
  )
}
