import clsx from 'clsx'

export default function Skeleton({ className }) {
  return (
    <div className={clsx('relative overflow-hidden rounded-md bg-inset', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-fg/10 to-transparent" />
    </div>
  )
}
