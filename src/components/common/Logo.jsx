// Logotipo de Sapiens Telco Live. Cambia automáticamente según el tema (.dark):
// logo negro en claro, logo blanco en oscuro. Pasa className para ajustar el alto.
export default function Logo({ className = 'h-8 w-auto' }) {
  return (
    <>
      <img
        src="/logo-light.png"
        alt="Sapiens Telco Live"
        className={`${className} block dark:hidden`}
        draggable={false}
      />
      <img
        src="/logo-dark.png"
        alt="Sapiens Telco Live"
        className={`${className} hidden dark:block`}
        draggable={false}
      />
    </>
  )
}
