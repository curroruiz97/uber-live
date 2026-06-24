import { Users, Package, CheckCircle2, Timer } from 'lucide-react'
import { useFleet } from '../../state/useFleetData'
import KpiCard from './KpiCard'

export default function KpiCards() {
  const { kpis, kpiHistory, kpiDeltas } = useFleet()
  const h = kpiHistory ?? {}
  const d = kpiDeltas ?? {}
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      <KpiCard
        label="Riders activos"
        value={kpis.activeRiders}
        icon={Users}
        accent="emerald"
        history={h.activeRiders}
        delta={d.activeRiders}
        hint={`${kpis.inactiveRiders} inactivos · ${kpis.totalRiders} en total`}
      />
      <KpiCard label="Pedidos en curso" value={kpis.ordersInProgress} icon={Package} accent="sky" history={h.ordersInProgress} delta={d.ordersInProgress} />
      <KpiCard label="Completadas hoy" value={kpis.completedToday} icon={CheckCircle2} accent="indigo" history={h.completedToday} delta={d.completedToday} />
      <KpiCard label="Tiempo medio" value={kpis.avgDeliveryMin} format="mmss" icon={Timer} accent="amber" history={h.avgDeliveryMin} delta={d.avgDeliveryMin} />
    </div>
  )
}
