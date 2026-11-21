function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `color-mix(in srgb, var(${variableName}) calc(${opacityValue} * 100%), transparent)`;
    }
    return `var(${variableName})`;
  };
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Ubuntu", "sans-serif"],
        mono: ["Ubuntu Mono", "monospace"],
      },
      colors: {
        canvas: withOpacity("--bg-canvas"),
        mat: withOpacity("--bg-mat"),
        surface: withOpacity("--bg-surface"),
        hairline: withOpacity("--border-hairline"),
        ink: {
          DEFAULT: withOpacity("--text-primary"),
          muted: withOpacity("--text-muted"),
        },
        signal: {
          DEFAULT: withOpacity("--accent-signal"),
          hover: withOpacity("--accent-signal-hover"),
        },
        "paper-canvas": "#F4F2ED",
        "paper-mat": "#E6E3DC",
        "paper-surface": "#FAF9F6",
        "paper-border": "#DCD8D0",
        "paper-ink": "#181715",
        "paper-muted": "#635F59",
        "paper-accent": "#D9381E",
        "paper-accent-hover": "#B82B14",
        "carbon-canvas": "#141312",
        "carbon-mat": "#0D0C0B",
        "carbon-surface": "#1E1D1B",
        "carbon-border": "#2E2C29",
        "carbon-ink": "#EDEAE4",
        "carbon-muted": "#969188",
        "carbon-accent": "#F05D43",
        "carbon-accent-hover": "#FF7259",
      },
      borderRadius: {
        sharp: "3px",
      },
    },
  },
  plugins: [],
};
