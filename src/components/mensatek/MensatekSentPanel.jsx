import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ScrollText, Search, X, ShieldCheck, FileSignature, Mail } from 'lucide-react'
import { useMensatek } from '../../state/mensatek'
import EmptyState from '../common/EmptyState'
import DatePicker from '../common/DatePicker'

const CHANNEL_META = {
  sms: { label: 'SMS Cert.', icon: ShieldCheck, cls: 'bg-accent/10 text-accent' },
  sms_contrato: { label: 'Contrato', icon: FileSignature, cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  email: { label: 'Email Cert.', icon: Mail, cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
}

const STATUS_STYLE = {
  enviado: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  entregado: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  certificado: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  error: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

function fmt(ts) {
  return new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function MensatekSentPanel() {
  const { sentLog } = useMensatek()
  const [q, setQ] = useState('')
  const [date, setDate] = useState('')

  const filtered = useMemo(
    () =>
      sentLog.filter((m) => {
        if (q && !`${m.riderName} ${m.target}`.toLowerCase().includes(q.toLowerCase())) return false
        if (date && new Date(m.ts).toISOString().slice(0, 10) !== date) return false
        return true
      }),
    [sentLog, q, date],
  )
  const hasFilters = Boolean(q || date)

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <ScrollText className="h-4 w-4" />
          </span>
          Envíos certificados
          <span className="rounded-full bg-inset px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">{filtered.length}</span>
        </h3>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-initial">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por rider o destino…"
              className="w-full rounded-lg border border-line bg-inset py-1.5 pl-7 pr-2 text-xs text-fg placeholder-faint outline-none transition focus:border-accent/60 sm:w-48"
            />
          </div>
          <DatePicker value={date} onChange={setDate} />
          {hasFilters && (
            <button
              onClick={() => { setQ(''); setDate('') }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted transition hover:text-fg"
            >
              <X className="h-3.5 w-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={hasFilters ? 'Sin resultados' : 'Sin envíos'}
          hint={hasFilters ? 'Ajusta los filtros para ver más.' : 'Los SMS y emails certificados enviados aparecerán aquí.'}
        />
      ) : (
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-panel/95 backdrop-blur">
              <tr className="border-b border-line text-xs text-faint">
                <th className="px-4 py-2 font-medium">Hora</th>
                <th className="px-4 py-2 font-medium">Destinatario</th>
                <th className="px-4 py-2 font-medium">Canal</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Contenido</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const cm = CHANNEL_META[m.channel] ?? CHANNEL_META.sms
                const CIcon = cm.icon
                return (
                  <tr key={m.id} className="border-b border-line transition-colors hover:bg-inset/50">
                    <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-muted">{fmt(m.ts)}</td>
                    <td className="px-4 py-2 text-sm text-fg">
                      {m.riderName || '—'}
                      <span className="block font-mono text-[11px] text-faint">{m.target}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={clsx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', cm.cls)}>
                        <CIcon className="h-3 w-3" /> {cm.label}
                      </span>
                    </td>
                    <td className="hidden max-w-[280px] truncate px-4 py-2 text-sm text-muted md:table-cell" title={m.subject ? `${m.subject} — ${m.message}` : m.message}>
                      {m.subject ? <span className="font-medium text-fg">{m.subject} · </span> : null}
                      {m.message}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_STYLE[m.status] ?? 'bg-zinc-500/10 text-muted')}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                        {m.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
