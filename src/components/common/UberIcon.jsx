// Badge de marca de Uber (lucide-react no trae iconos de marca). Colores fijos de
// marca (tile negro + wordmark blanco) con un borde sutil para que se vea también
// sobre fondos oscuros. Tamaño vía className (p. ej. h-5 w-5).
export default function UberIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Uber" role="img">
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#000000" stroke="#FFFFFF" strokeOpacity="0.18" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
        fontSize="10"
        fontWeight="700"
        letterSpacing="-0.5"
        fill="#FFFFFF"
      >
        Uber
      </text>
    </svg>
  )
}
