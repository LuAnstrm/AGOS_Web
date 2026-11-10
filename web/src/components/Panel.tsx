import type { ReactNode } from "react";

/** The one card layout: icon + title + optional meta on the left, actions on the right. */
export function Panel({
  title,
  icon,
  meta,
  actions,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  title: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card flex min-h-0 flex-col ${className}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon && <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
          {title}
        </h2>
        {meta && <span className="text-xs text-muted">{meta}</span>}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</div>}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Segmented control / filter chip. */
export function Chip({
  active,
  onClick,
  children,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
        active ? "border-ink bg-ink text-page" : "border-line text-ink-2 hover:bg-hover"
      }`}
    >
      {children}
    </button>
  );
}
