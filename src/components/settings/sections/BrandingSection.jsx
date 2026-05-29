import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Palette, Save, Loader2, Wand2, RotateCcw, Trash2, UploadCloud, Eye, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useOrg } from '../../../state/OrgContext'
import { useBrand } from '../../../state/BrandContext'
import { useToast } from '../../../state/toast'
import { SettingsCard } from '../SettingsField'
import ColorPicker from '../ColorPicker'
import { lighten, tripletToHex, readableOn } from '../../../utils/color'

const DEFAULT_LIGHT = '249 115 22'
const DEFAULT_DARK = '251 146 60'

// Zona de subida con drag & drop + previsualización + borrar.
function ImageDrop({ url, uploading, disabled, onFile, onRemove, bg, hint, height = 'h-24' }) {
  const [over, setOver] = useState(false)
  const inputRef = useRef(null)
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onFile(e.dataTransfer.files?.[0]) }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={clsx(
          'relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-3 transition',
          height,
          bg,
          over ? 'border-accent bg-accent/5' : 'border-line hover:border-accent/40',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        ) : url ? (
          <img src={url} alt="" className="max-h-full max-w-[80%] object-contain" />
        ) : (
          <>
            <UploadCloud className="h-5 w-5 text-faint" />
            <span className="text-center text-[11px] text-faint">{hint}</span>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon" className="hidden" disabled={disabled} onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {url && !disabled && (
        <button onClick={onRemove} className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted transition hover:text-red-500">
          <Trash2 className="h-3 w-3" /> Quitar
        </button>
      )}
    </div>
  )
}

// Mini maqueta que refleja en vivo el acento elegido (usa bg-accent/text-accent).
function BrandPreview({ light, dark }) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="flex items-center justify-between border-b border-line bg-panel px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-[10px] font-bold text-white">A</span>
            <span className="text-xs font-semibold text-fg">Tu empresa</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">● EN VIVO</span>
        </div>
        <div className="flex gap-3 bg-app p-3">
          <div className="flex w-24 shrink-0 flex-col gap-1">
            <span className="rounded-md bg-accent/15 px-2 py-1 text-[11px] font-medium text-accent ring-1 ring-accent/30">Dashboard</span>
            <span className="px-2 py-1 text-[11px] text-muted">Riders</span>
            <span className="px-2 py-1 text-[11px] text-muted">Mapa</span>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="rounded-lg border border-line bg-panel p-2.5">
              <p className="text-[10px] text-muted">Completadas hoy</p>
              <p className="text-lg font-semibold text-accent">128</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-inset"><div className="h-full w-2/3 bg-accent" /></div>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white">Botón</button>
              <button className="rounded-lg border border-accent/40 px-3 py-1.5 text-[11px] font-medium text-accent">Secundario</button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg p-2 text-center text-[10px] font-medium" style={{ backgroundColor: `rgb(${light})`, color: readableOn(light) }}>
          Claro · {tripletToHex(light)}
        </div>
        <div className="flex-1 rounded-lg p-2 text-center text-[10px] font-medium" style={{ backgroundColor: `rgb(${dark})`, color: readableOn(dark) }}>
          Oscuro · {tripletToHex(dark)}
        </div>
      </div>
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

  useEffect(() => {
    setLight(brand.accentLight)
    setDark(brand.accentDark)
  }, [brand.accentLight, brand.accentDark])

  useEffect(() => () => brand.clearPreview(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = light !== brand.accentLight || dark !== brand.accentDark

  function pickLight(t) { setLight(t); brand.setPreviewAccent(t, dark) }
  function pickDark(t) { setDark(t); brand.setPreviewAccent(light, t) }
  function deriveDark() { const d = lighten(light, 0.14); setDark(d); brand.setPreviewAccent(light, d) }

  async function saveAccent() {
    setSaving(true)
    const { error } = await brand.save({ accentLight: light, accentDark: dark })
    brand.clearPreview()
    setSaving(false)
    toast(error ? { type: 'error', title: 'Error', message: error.message } : { type: 'success', title: 'Color de marca guardado' })
  }

  async function resetAccent() {
    setLight(DEFAULT_LIGHT)
    setDark(DEFAULT_DARK)
    brand.setPreviewAccent(DEFAULT_LIGHT, DEFAULT_DARK)
    const { error } = await brand.save({ accentLight: DEFAULT_LIGHT, accentDark: DEFAULT_DARK })
    brand.clearPreview()
    toast(error ? { type: 'error', title: 'Error', message: error.message } : { type: 'success', title: 'Color restablecido' })
  }

  async function uploadImage(kind, file) {
    if (!file) return
    const max = kind === 'favicon' ? 512 * 1024 : 2 * 1024 * 1024
    if (file.size > max) return toast({ type: 'warning', title: 'Archivo muy grande', message: kind === 'favicon' ? 'Máximo 512 KB.' : 'Máximo 2 MB.' })
    setUploading(kind)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${orgId}/${kind}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('org-branding').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (error) { setUploading(''); return toast({ type: 'error', title: 'Error al subir', message: error.message }) }
    const { data } = supabase.storage.from('org-branding').getPublicUrl(path)
    const field = kind === 'light' ? 'logoLightUrl' : kind === 'dark' ? 'logoDarkUrl' : 'faviconUrl'
    const { error: e2 } = await brand.save({ [field]: data.publicUrl })
    setUploading('')
    toast(e2 ? { type: 'error', title: 'Error', message: e2.message } : { type: 'success', title: 'Imagen actualizada' })
  }

  async function removeImage(kind) {
    const field = kind === 'light' ? 'logoLightUrl' : kind === 'dark' ? 'logoDarkUrl' : 'faviconUrl'
    await brand.save({ [field]: '' })
    toast({ type: 'success', title: 'Imagen quitada' })
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
        subtitle="Acento de toda la interfaz: botones, enlaces, indicadores"
        right={
          <div className="flex items-center gap-2">
            <button onClick={resetAccent} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition hover:bg-inset hover:text-fg" title="Restablecer al color por defecto">
              <RotateCcw className="h-3.5 w-3.5" /> Restablecer
            </button>
            <button onClick={saveAccent} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_auto_1fr]">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Acento · tema claro</p>
            <ColorPicker value={light} onChange={pickLight} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted">Acento · tema oscuro</p>
              <button onClick={deriveDark} className="inline-flex items-center gap-1 text-[11px] text-muted transition hover:text-accent" title="Derivar del color claro">
                <Wand2 className="h-3 w-3" /> derivar
              </button>
            </div>
            <ColorPicker value={dark} onChange={pickDark} />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><Eye className="h-3.5 w-3.5" /> Vista previa en vivo</p>
            <BrandPreview light={light} dark={dark} />
          </div>
        </div>
        {dirty && <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">Cambios sin guardar — pulsa Guardar para aplicarlos a todo el equipo.</p>}
      </SettingsCard>

      <SettingsCard icon={ImageIcon} title="Logotipo" subtitle="Sube tu logo para tema claro y oscuro (PNG/SVG transparente, máx 2 MB)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Logo · fondo claro</p>
            <ImageDrop url={brand.logoLightUrl} uploading={uploading === 'light'} disabled={Boolean(uploading)} bg="bg-white" hint="Arrastra o haz clic" onFile={(f) => uploadImage('light', f)} onRemove={() => removeImage('light')} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Logo · fondo oscuro</p>
            <ImageDrop url={brand.logoDarkUrl} uploading={uploading === 'dark'} disabled={Boolean(uploading)} bg="bg-zinc-900" hint="Arrastra o haz clic" onFile={(f) => uploadImage('dark', f)} onRemove={() => removeImage('dark')} />
          </div>
        </div>
        <p className="mt-2 text-xs text-faint">Aparece en la barra lateral y en las pantallas de acceso. Si no subes ninguno, se usa el logo por defecto.</p>
      </SettingsCard>

      <SettingsCard icon={ImageIcon} title="Favicon" subtitle="El icono de la pestaña del navegador (cuadrado, máx 512 KB)">
        <div className="w-32">
          <ImageDrop url={brand.faviconUrl} uploading={uploading === 'favicon'} disabled={Boolean(uploading)} bg="bg-inset" hint="Sube .png/.ico" height="h-20" onFile={(f) => uploadImage('favicon', f)} onRemove={() => removeImage('favicon')} />
        </div>
      </SettingsCard>
    </div>
  )
}
