import { ArrowUpRight, GithubLogo, LinkedinLogo } from "@phosphor-icons/react";

export default function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3.5 px-6 py-5 text-center sm:flex-row sm:text-left">
        {/* Left: Privacy Statement with 6px × 6px Vermilion Square */}
        <div className="flex items-center justify-center gap-2 text-xs text-ink-muted sm:justify-start">
          <span className="inline-block h-1.5 w-1.5 shrink-0 bg-signal" />
          <span>Zero server uploads · All files stay in browser memory</span>
        </div>

        {/* Right: Tactile Author Nameplate + Matched External Link Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <a
            href="https://github.com/Jagansakthivel"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex h-8 items-center gap-1.5 rounded-sharp border border-hairline border-l-2 border-l-signal bg-surface px-2.5 transition-all duration-100 ease-out active:translate-y-[1px]"
          >
            <span className="text-xs text-ink-muted">Built by</span>
            <span className="text-sm font-bold tracking-tight text-ink transition-colors duration-150 group-hover:text-signal">
              Jagan
            </span>
            <ArrowUpRight
              size={13}
              weight="bold"
              className="text-ink-muted transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-signal"
            />
          </a>

          <span aria-hidden="true" className="h-4 w-px bg-hairline" />

          <a
            href="https://github.com/Jagansakthivel"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="group inline-flex h-8 items-center gap-1.5 rounded-sharp border border-hairline bg-surface px-2.5 text-xs font-medium text-ink-muted transition-all duration-150 hover:border-ink/30 hover:text-ink active:translate-y-[1px]"
          >
            <GithubLogo
              size={15}
              weight="regular"
              className="transition-colors duration-150 group-hover:text-signal"
            />
            <span>GitHub</span>
          </a>

          <a
            href="https://www.linkedin.com/in/jagan-sakthivel-dev/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="group inline-flex h-8 items-center gap-1.5 rounded-sharp border border-hairline bg-surface px-2.5 text-xs font-medium text-ink-muted transition-all duration-150 hover:border-ink/30 hover:text-ink active:translate-y-[1px]"
          >
            <LinkedinLogo
              size={15}
              weight="regular"
              className="transition-colors duration-150 group-hover:text-signal"
            />
            <span>LinkedIn</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
