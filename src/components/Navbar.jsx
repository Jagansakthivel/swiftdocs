import { useState, useEffect } from "react";
import { Sun, Moon, FilePdf } from "@phosphor-icons/react";

export default function Navbar({ darkMode: propDarkMode, onToggleTheme, onGoHome }) {
  const [internalDarkMode, setInternalDarkMode] = useState(() => {
    const saved = localStorage.getItem("swiftdocs-theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const isControlled = typeof onToggleTheme === "function" && propDarkMode !== undefined;
  const darkMode = isControlled ? propDarkMode : internalDarkMode;
  const handleToggle = isControlled ? onToggleTheme : () => setInternalDarkMode(!internalDarkMode);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("swiftdocs-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("swiftdocs-theme", "light");
    }
  }, [darkMode]);

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-surface transition-colors duration-100">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
        {/* Brand Identity */}
        <button
          type="button"
          onClick={onGoHome}
          className="group flex items-center gap-2.5 text-left transition-transform duration-100 active:translate-y-[1px]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-sharp bg-signal text-white dark:text-canvas">
            <FilePdf size={19} weight="bold" />
          </div>
          <span className="text-lg font-bold tracking-[-0.02em] text-ink">
            SwiftDocs
          </span>
        </button>

        {/* Right: Trust Badge + Theme Switch */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-sharp border border-hairline bg-mat px-2.5 py-1 text-xs font-medium text-ink-muted">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            </span>
            <span className="hidden sm:inline">100% browser-local processing</span>
            <span className="sm:hidden">Local-only</span>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-sharp border border-hairline bg-surface text-ink-muted transition-all duration-100 ease-out hover:border-ink/30 hover:text-ink active:translate-y-[1px]"
          >
            {darkMode ? (
              <Sun size={16} weight="bold" />
            ) : (
              <Moon size={16} weight="bold" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
