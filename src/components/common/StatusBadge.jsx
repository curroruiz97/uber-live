import clsx from 'clsx'
import { STATUS } from '../../config/constants'

export default function StatusBadge({ status, size = 'md', className }) {
  const s = STATUS[status] ?? STATUS.offline
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        s.bg,
        s.text,
        s.border,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}
