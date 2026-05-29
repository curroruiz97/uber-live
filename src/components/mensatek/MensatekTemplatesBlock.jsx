import { useState } from 'react'
import clsx from 'clsx'
import { FileText, Plus, Trash2, Mail, MessageSquareText } from 'lucide-react'
import CollapsibleCard from '../common/CollapsibleCard'
import { useMensatek } from '../../state/mensatek'
import { TEMPLATE_VARS } from '../../utils/mensatek'

export default function MensatekTemplatesBlock() {
  const { templates, addTemplate, updateTemplate, removeTemplate } = useMensatek()
  const [newChannel, setNewChannel] = useState('sms')

  return (
    <CollapsibleCard
      title="Plantillas"
      subtitle={`${templates.length} guardadas · reutilízalas al redactar`}
      icon={FileText}
      right={
        <span className="mr-1 rounded-full bg-inset px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
          {templates.length}
        </span>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-faint">
          Variables disponibles:{' '}
          {TEMPLATE_VARS.map((v) => (
            <code key={v} className="mr-1 rounded bg-inset px-1 py-0.5 font-mono text-[11px] text-accent">{`{${v}}`}</code>
          ))}
        </p>

        {templates.length === 0 && (
          <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-faint">
            Aún no hay plantillas. Crea una para reutilizar mensajes frecuentes.
          </p>
        )}

        {templates.map((t) => (
          <div key={t.id} className="rounded-lg border border-line bg-inset/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={clsx(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  t.channel === 'email' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-accent/10 text-accent',
                )}
              >
                {t.channel === 'email' ? <Mail className="h-3 w-3" /> : <MessageSquareText className="h-3 w-3" />}
                {t.channel === 'email' ? 'Email' : 'SMS'}
              </span>
              <input
                value={t.title}
                onChange={(e) => updateTemplate(t.id, { title: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-fg outline-none transition hover:border-line focus:border-accent/60 focus:bg-inset"
              />
              <button
                onClick={() => removeTemplate(t.id)}
                className="rounded-md p-1.5 text-faint transition hover:bg-red-500/10 hover:text-red-500"
                aria-label="Eliminar plantilla"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {t.channel === 'email' && (
              <input
                value={t.subject}
                onChange={(e) => updateTemplate(t.id, { subject: e.target.value })}
                placeholder="Asunto…"
                className="mb-2 w-full rounded-md border border-line bg-inset px-2 py-1.5 text-xs text-fg placeholder-faint outline-none focus:border-accent/60"
              />
            )}
            <textarea
              value={t.body}
              onChange={(e) => updateTemplate(t.id, { body: e.target.value })}
              rows={t.channel === 'email' ? 3 : 2}
              className="w-full resize-y rounded-md border border-line bg-inset px-2 py-1.5 text-sm text-fg outline-none focus:border-accent/60"
            />
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1">
          <select
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            className="rounded-lg border border-line bg-inset px-2.5 py-2 text-sm text-fg outline-none focus:border-accent/60"
          >
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
          <button
            onClick={() =>
              addTemplate({
                channel: newChannel,
                title: 'Nueva plantilla',
                subject: newChannel === 'email' ? 'Asunto' : '',
                body: 'Hola {nombre}, ',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" /> Añadir plantilla
          </button>
        </div>
      </div>
    </CollapsibleCard>
  )
}
