import Segmented from './Segmented'
import DatePicker from '../common/DatePicker'

// Controles de periodo a ancho completo: fila de presets + (si "Personalizado")
// una fila con dos selectores de fecha Desde/Hasta a ancho completo.
export default function RangeControls({ ctl, presets }) {
  return (
    <div className="space-y-2">
      <Segmented options={presets} value={ctl.period} onChange={ctl.setPeriod} fullWidth />
      {ctl.period === 'custom' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DatePicker block value={ctl.customFrom} onChange={ctl.setCustomFrom} placeholder="Desde" />
          <DatePicker block value={ctl.customTo} onChange={ctl.setCustomTo} placeholder="Hasta" />
        </div>
      )}
    </div>
  )
}
