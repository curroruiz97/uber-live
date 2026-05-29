import { Building2, CheckCircle2, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import CollapsibleCard from '../common/CollapsibleCard'
import { useMensatek } from '../../state/mensatek'
import { clampSenderSms, isValidEmail, smsIssuerReady } from '../../utils/mensatek'

function Field({ label, value, onChange, placeholder, hint, mono, maxLength, type = 'text', invalid }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          'w-full rounded-lg border bg-inset px-3 py-2.5 text-sm text-fg placeholder-faint outline-none transition focus:ring-2 focus:ring-accent/20',
          mono && 'font-mono',
          invalid ? 'border-red-500/50 focus:border-red-500/60' : 'border-line focus:border-accent/60',
        )}
      />
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  )
}

export default function MensatekIssuerBlock() {
  const { config, setConfig } = useMensatek()
  const ready = smsIssuerReady(config)
  const emailReady = isValidEmail(config.senderEmail)

  return (
    <CollapsibleCard
      title="Datos del emisor y remitentes"
      subtitle="Aparecen en el certificado PDF. Obligatorios para el SMS Certificado."
      icon={Building2}
      defaultOpen={!ready}
      right={
        <span
          className={clsx(
            'mr-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            ready ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          )}
        >
          {ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {ready ? 'Completo' : 'Incompleto'}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Contacto (emisor)"
          value={config.contacto}
          onChange={(v) => setConfig({ contacto: v })}
          placeholder="SAPIENS TELCO SL"
          hint="Empresa o persona que figura como emisora en la certificación."
        />
        <Field
          label="CIF / NIF del emisor"
          value={config.cifcontacto}
          onChange={(v) => setConfig({ cifcontacto: v })}
          placeholder="B00000000"
          mono
          hint="Se usa como emisor en el PDF con firma certificada."
        />
        <Field
          label="Teléfono de contacto"
          value={config.telcontacto}
          onChange={(v) => setConfig({ telcontacto: v })}
          placeholder="900000000"
          mono
        />
        <Field
          label="Remitente SMS"
          value={config.senderSms}
          onChange={(v) => setConfig({ senderSms: clampSenderSms(v) })}
          placeholder="Sapiens"
          maxLength={11}
          hint={`Alfanumérico, máx. 11 caracteres (${config.senderSms.length}/11).`}
        />
        <div className="sm:col-span-2">
          <Field
            label="Remitente Email (validado en Mensatek)"
            type="email"
            value={config.senderEmail}
            onChange={(v) => setConfig({ senderEmail: v })}
            placeholder="notificaciones@sapiens.tel"
            mono
            invalid={Boolean(config.senderEmail) && !emailReady}
            hint="Debe ser un email validado previamente en tu panel de Mensatek."
          />
        </div>
      </div>
    </CollapsibleCard>
  )
}
