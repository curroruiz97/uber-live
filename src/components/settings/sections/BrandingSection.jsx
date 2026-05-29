import { useEffect, useState } from 'react'
import { Palette, Save, Loader2, Wand2, ImageUp } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useOrg } from '../../../state/OrgContext'
import { useBrand } from '../../../state/BrandContext'
import { useToast } from '../../../state/toast'
import { SettingsCard } from '../SettingsField'
import { hexToTriplet, tripletToHex, lighten } from '../../../utils/color'

function ColorInput({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={tripletToHex(value)}
          onChange={(e) => onChange(hexToTriplet(e.target.value))}
          className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-inset p-1"
        />
        <input
          value={tripletToHex(value)}
          onChange={(e) => {
            const t = hexToTriplet(e.target.value)
            if (t) onChange(t)
          }}
          className="w-28 rounded-lg border border-line bg-inset px-2.5 py-2 font-mono text-sm text-fg outline-none focus:border-accent/60"
        />
      </div>
    </div>
  )
}

function LogoUploader({ label, url, uploading, disabled, onPick, bg }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      <div className={`flex h-20 items-center justify-center rounded-lg border border-line ${bg}`}>
        {url ? (
          <img src={url} alt="logo" className="max-h-12 max-w-[70%] object-contain" />
        ) : (
          <span className="text-xs text-faint">Sin logo</span>
        )}
      </div>
      <label className={`mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-inset ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />} Subir
        <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" disabled={disabled} onChange={(e) => onPick(e.target.files?.[0])} />
      </label>
    </div>
  )
}

export default function BrandingSection() {
  const { currentOrgId: orgId, isOwnerOrAdmin } = useOrg()
  const brand = useBrand()
  const { toast } = useToast()
  const [light, setLight] = useState(brand.accentLight)
  const [dark, setDark] = useState(brand.accentDark)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')

  // Sincroniza los selectores con el branding cargado.
  useEffect(() => {
    setLight(brand.accentLight)
    setDark(brand.accentDark)
  }, [brand.accentLight, brand.accentDark])

  // Limpia la vista previa al salir de la sección.
  useEffect(() => () => brand.clearPreview(), [])  // eslint-disable-line react-hooks/exhaustive-deps

  function pickLight(t) {
    setLight(t)
    brand.setPreviewAccent(t, dark)
  }
  function pickDark(t) {
    setDark(t)
    brand.setPreviewAccent(light, t)
  }
  function deriveDark() {
    const d = lighten(light, 0.14)
    setDark(d)
    brand.setPreviewAccent(light, d)
  }

  async function saveAccent() {
    setSaving(true)
    const { error } = await brand.save({ accentLight: light, accentDark: dark })
    brand.clearPreview()
    setSaving(false)
    toast(error ? { type: 'error', title: 'Error', message: error.message } : { type: 'success', title: 'Color de marca actualizado' })
  }

  async function uploadLogo(which, file) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return toast({ type: 'warning', title: 'Imagen muy grande', message: 'Máximo 2 MB.' })
    setUploading(which)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${orgId}/logo-${which}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('org-branding').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (error) {
      setUploading('')
      return toast({ type: 'error', title: 'Error al subir', message: error.message })
    }
    const { data } = supabase.storage.from('org-branding').getPublicUrl(path)
    const { error: e2 } = await brand.save(which === 'light' ? { logoLightUrl: data.publicUrl } : { logoDarkUrl: data.publicUrl })
    setUploading('')
    toast(e2 ? { type: 'error', title: 'Error', message: e2.message } : { type: 'success', title: 'Logo actualizado' })
  }

  if (!isOwnerOrAdmin) {
    return (
      <SettingsCard icon={Palette} title="Marca" subtitle="Personalización visual de tu empresa">
        <p className="text-sm text-muted">Solo el propietario o un administrador pueden cambiar la marca.</p>
      </SettingsCard>
    )
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        icon={Palette}
        title="Color de marca"
        subtitle="Se aplica a botones, enlaces y acentos de toda la app"
        right={
          <button
            onClick={saveAccent}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        }
      >
        <div className="flex flex-wrap items-end gap-4">
          <ColorInput label="Acento (tema claro)" value={light} onChange={pickLight} />
          <ColorInput label="Acento (tema oscuro)" value={dark} onChange={pickDark} />
          <button
            onClick={deriveDark}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition hover:bg-inset hover:text-fg"
            title="Generar la variante oscura a partir de la clara"
          >
            <Wand2 className="h-3.5 w-3.5" /> Derivar oscuro
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-faint">Vista previa:</span>
          <button className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white">Botón</button>
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">Etiqueta</span>
          <span className="text-sm font-medium text-accent">Enlace</span>
        </div>
        <p className="mt-2 text-xs text-faint">Los cambios se previsualizan en vivo; pulsa Guardar para aplicarlos de forma permanente.</p>
      </SettingsCard>

      <SettingsCard icon={ImageUp} title="Logotipo" subtitle="Dos variantes: una para tema claro y otra para oscuro">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LogoUploader label="Logo (tema claro)" url={brand.logoLightUrl} uploading={uploading === 'light'} disabled={Boolean(uploading)} onPick={(f) => uploadLogo('light', f)} bg="bg-white" />
          <LogoUploader label="Logo (tema oscuro)" url={brand.logoDarkUrl} uploading={uploading === 'dark'} disabled={Boolean(uploading)} onPick={(f) => uploadLogo('dark', f)} bg="bg-zinc-900" />
        </div>
        <p className="mt-2 text-xs text-faint">PNG/SVG con fondo transparente, máx 2 MB. Si no subes ninguno, se usa el logo por defecto.</p>
      </SettingsCard>
    </div>
  )
}
