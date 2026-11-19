import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

// The console keeps the paper-and-crimson identity it had as a static page:
// warm paper, ink text, one accent, status colours only where they mean
// something. Astryx supplies the controls, this supplies the palette.
const sans = '"Geist", system-ui, -apple-system, "Segoe UI", sans-serif';
const mono = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const display = '"Newsreader", Georgia, "Times New Roman", serif';

export const arenaTheme = defineTheme({
  name: 'ai-arena',
  extends: neutralTheme,
  tokens: {
    '--font-family-body': sans,
    '--font-family-heading': display,
    '--font-family-code': mono,

    '--radius-container': '10px',
    '--radius-element': '8px',
    '--radius-inner': '5px',

    '--color-background-body': ['#f8f4ed', '#171412'],
    '--color-background-surface': ['#fffdf9', '#1d1916'],
    '--color-background-card': ['#fffdf9', '#221e1a'],
    '--color-background-popover': ['#fffdf9', '#241f1b'],
    '--color-background-muted': ['#f1eae0', '#26211c'],
    '--color-border': ['#e3dacd', '#332c26'],
    '--color-border-emphasized': ['#cfc3b2', '#453c34'],
    '--color-text-primary': ['#1b1817', '#f6f1e9'],
    '--color-text-secondary': ['#6b625c', '#aaa096'],
    '--color-accent': ['#a32b3f', '#e8828f'],
    '--color-accent-muted': ['#a32b3f1f', '#e8828f24'],
    '--color-on-accent': ['#fffdf9', '#171412'],
    '--color-text-accent': ['#a32b3f', '#e8828f'],
    '--color-icon-accent': ['#a32b3f', '#e8828f'],
  },
});
