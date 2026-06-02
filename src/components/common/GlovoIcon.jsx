// Badge de marca de Glovo (lucide-react no trae iconos de marca). Tile amarillo
// de marca (#FFC244) con la "G" en verde Glovo (#00A082). Tamaño vía className.
export default function GlovoIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Glovo" role="img">
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#FFC244" stroke="#000000" strokeOpacity="0.08" />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
        fontSize="13"
        fontWeight="800"
        fill="#00A082"
      >
        G
      </text>
    </svg>
  )
}
