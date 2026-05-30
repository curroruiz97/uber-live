import { Plus, Trash2, MessageSquareText } from 'lucide-react'
import { useWhatsApp } from '../../state/whatsapp'
import { TEMPLATE_VARS } from '../../utils/whatsapp'
import CollapsibleCard from '../common/CollapsibleCard'

export default function QuickTemplatesBlock() {
  const { settings, addTemplate, updateTemplate, removeTemplate } = useWhatsApp()
  const count = settings.quickTemplates.length

  return (
    <CollapsibleCard
      title="Mensajes rápidos"
      subtitle="Plantillas para envío masivo y respuestas"
      icon={MessageSquareText}
      right={
        <span className="rounded-full bg-inset px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
          {count}
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted">
        Variables:
        {TEMPLATE_VARS.map((v) => (
          <code key={v} className="rounded bg-inset px-1.5 py-0.5 font-mono text-[11px] text-accent">
            {`{${v}}`}
          </code>
        ))}
      </div>

      <div className="space-y-3">
        {count === 0 && <p className="text-sm text-faint">Sin plantillas. Añade una con el botón de abajo.</p>}
        {settings.quickTemplates.map((t) => (
          <div key={t.id} className="rounded-lg border border-line bg-inset/50 p-3">
            <div className="flex items-center gap-2">
              <input
                value={t.title}
                onChange={(e) => updateTemplate(t.id, { title: e.target.value })}
                className="flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium text-fg outline-none transition focus:border-accent/60"
                placeholder="Título"
              />
              <button
                onClick={() => removeTemplate(t.id)}
                className="rounded-md p-1.5 text-faint transition hover:bg-red-500/10 hover:text-red-500"
                aria-label="Eliminar plantilla"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={t.text}
              onChange={(e) => updateTemplate(t.id, { text: e.target.value })}
              rows={2}
              className="mt-2 w-full resize-y rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-fg outline-none transition focus:border-accent/60"
              placeholder="Texto del mensaje… usa {nombre}, {pedido_id}…"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => addTemplate({ title: 'Nueva plantilla', text: '' })}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-inset hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5" /> Añadir plantilla
      </button>
    </CollapsibleCard>
  )
}
