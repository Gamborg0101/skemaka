/**
 * A labelled cluster of settings cards. Purely presentational — groups the
 * growing list of sections under a heading so managers can orient themselves.
 */
export function SettingsGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {title}
      </h2>
      {children}
    </section>
  )
}
