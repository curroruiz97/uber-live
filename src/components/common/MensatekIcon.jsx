// Glifo de Mensatek: un sobre/mensaje con sello de verificación (comunicación certificada).
export default function MensatekIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v7A1.5 1.5 0 0 1 19.5 15H9l-4 3v-3H4.5A1.5 1.5 0 0 1 3 13.5z" />
      <path d="m8.5 9.5 2.5 2 4-4.5" />
      <circle cx="18.5" cy="18" r="3.2" fill="currentColor" stroke="none" />
      <path d="m17.2 18 1 1 1.6-1.9" stroke="#fff" strokeWidth="1.6" />
    </svg>
  )
}
