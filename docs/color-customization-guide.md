# Color Customization Guide

## Overview
All website colors are now centralized in a single CSS file, making it easy to change your color scheme.

## How to Change Colors

### Step 1: Edit the Colors File
Open [`/styles/colors.css`](../styles/colors.css) and modify the hex values:

```css
:root {
  /* Primary Colors - Main brand color */
  --color-primary: #007acc;           /* Change this for your primary color */
  --color-primary-hover: #005a9e;     /* Darker shade for hover states */

  /* Background Colors */
  --color-bg-primary: #1e1e1e;        /* Main background */
  --color-bg-secondary: #252526;      /* Sidebar/panel backgrounds */
  --color-bg-tertiary: #2d2d30;       /* Headers, input backgrounds */
  --color-bg-surface: #3e3e42;        /* Cards, elevated surfaces */

  /* Text Colors */
  --color-text-primary: #ffffff;      /* Main text color */
  --color-text-secondary: #cccccc;    /* Secondary text */
  --color-text-muted: #969696;        /* Disabled/muted text */

  /* Accent Colors */
  --color-accent-teal: #4ec9b0;       /* Success, user avatars */
  --color-accent-yellow: #dcdcaa;     /* Warnings, highlights */

  /* Status Colors */
  --color-success: #4ec9b0;
  --color-warning: #dcdcaa;
  --color-error: #f28b82;

  /* Border & Focus */
  --color-border: #3e3e42;
  --color-border-focus: #007acc;
}
```

### Step 2: Save and Rebuild
After editing the colors:
1. Save the file
2. Restart your development server if needed
3. The changes will apply across the entire website

## Example Color Schemes

### Ocean Blue (Current)
- Primary: `#007acc` (Blue)
- Accent: `#4ec9b0` (Teal)

### Purple Theme
```css
--color-primary: #8b5cf6;
--color-primary-hover: #7c3aed;
--color-accent-teal: #a78bfa;
--color-accent-yellow: #fbbf24;
```

### Forest Green
```css
--color-primary: #10b981;
--color-primary-hover: #059669;
--color-accent-teal: #34d399;
--color-accent-yellow: #fbbf24;
```

### Sunset Orange
```css
--color-primary: #f97316;
--color-primary-hover: #ea580c;
--color-accent-teal: #fb923c;
--color-accent-yellow: #fbbf24;
```

## Technical Details

### Tailwind Integration
The colors are integrated with Tailwind CSS through the `tailwind.config.ts` file using the `app-` prefix:

- Backgrounds: `bg-app-primary`, `bg-app-bg-secondary`
- Text: `text-app-text-primary`, `text-app-text-muted`
- Borders: `border-app-border`
- Hover states: `hover:bg-app-primary-hover`

### Components Updated
All 10 major components use the centralized color system:
1. ✅ ai-chat-panel.tsx
2. ✅ study-interface.tsx
3. ✅ pdf-viewer.tsx
4. ✅ quiz-panel.tsx
5. ✅ flashcard-panel.tsx
6. ✅ key-concepts-panel.tsx
7. ✅ chapter-selector.tsx
8. ✅ auth-form.tsx
9. ✅ login-form.tsx
10. ✅ register-form.tsx

## Color Usage Reference

| Color Variable | Used For |
|---------------|----------|
| `--color-primary` | Primary buttons, links, status bar, focus states |
| `--color-primary-hover` | Button hover states |
| `--color-bg-primary` | Main app background |
| `--color-bg-secondary` | Sidebars, panels |
| `--color-bg-tertiary` | Headers, navbars, input areas |
| `--color-bg-surface` | Cards, modals, elevated components |
| `--color-text-primary` | Headings, important text |
| `--color-text-secondary` | Body text, labels |
| `--color-text-muted` | Placeholders, disabled text |
| `--color-accent-teal` | User avatars, success states |
| `--color-accent-yellow` | Warnings, highlights |
| `--color-error` | Error messages, destructive actions |
| `--color-border` | Component borders, dividers |
| `--color-border-focus` | Input focus rings |

## Tips

1. **Maintain Contrast**: Ensure sufficient contrast between text and background colors for readability
2. **Test All States**: After changing colors, test hover, focus, and active states
3. **Color Harmony**: Use a color palette generator to create harmonious color schemes
4. **Accessibility**: Use tools like WebAIM's contrast checker to ensure WCAG compliance

## Need Help?

- Color palette generators: [Coolors.co](https://coolors.co), [Adobe Color](https://color.adobe.com)
- Contrast checker: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
