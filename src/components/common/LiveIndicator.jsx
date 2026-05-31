export default function LiveIndicator({ seconds }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      <span className="hidden font-semibold tracking-wide text-green-600 dark:text-green-400 sm:inline">EN VIVO</span>
      {typeof seconds === 'number' && (
        <span className="tabular-nums text-faint">· {seconds}s</span>
      )}
    </div>
  )
}
