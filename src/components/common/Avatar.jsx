import clsx from 'clsx'

// Avatar con iniciales y color determinista por nombre (fallback sin foto, estilo
// fintech). Mismo nombre → mismo color siempre. Solo presentación.
const PALETTE = [
  ['bg-blue-500/15', 'text-blue-500 dark:text-blue-400'],
  ['bg-green-500/15', 'text-green-500 dark:text-green-400'],
  ['bg-amber-500/15', 'text-amber-500 dark:text-amber-400'],
  ['bg-violet-500/15', 'text-violet-500 dark:text-violet-400'],
  ['bg-pink-500/15', 'text-pink-500 dark:text-pink-400'],
  ['bg-cyan-500/15', 'text-cyan-500 dark:text-cyan-400'],
  ['bg-orange-500/15', 'text-orange-500 dark:text-orange-400'],
  ['bg-teal-500/15', 'text-teal-500 dark:text-teal-400'],
]

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function hueIndex(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % PALETTE.length
}

const SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

export default function Avatar({ name, size = 'sm', className }) {
  const [bg, text] = PALETTE[hueIndex(name)]
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        bg,
        text,
        SIZES[size] ?? SIZES.sm,
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
