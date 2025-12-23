# Android Dev UI Design System

## Overview

This design system provides centralised design tokens, consistent styling patterns, and best-practice UI/UX components for the Android Test Console.

## Design Tokens

All design tokens are defined in `/public/design-tokens.css` using CSS custom properties.

### Usage

```css
/* ✅ GOOD - Use design tokens */
.my-element {
  background: var(--bg-surface);
  colour: var(--text-primary);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
}

/* ❌ BAD - Hardcoded values */
.my-element {
  background: #0f172a;
  colour: #f1f5f9;
  padding: 16px;
  border-radius: 10px;
}
```

### Colour Tokens

#### Backgrounds
- `--bg-base`: Main application background
- `--bg-surface`: Panel/card backgrounds
- `--bg-surface-elevated`: Elevated surfaces (inputs, hover states)
- `--bg-surface-hover`: Hover state background
- `--bg-overlay`: Modal/overlay backgrounds
- `--bg-backdrop`: Backdrop for modals

#### Text Colours
- `--text-primary`: Primary text (highest contrast)
- `--text-secondary`: Secondary text
- `--text-tertiary`: Tertiary text (labels, metadata)
- `--text-disabled`: Disabled text
- `--text-inverse`: Text for dark backgrounds

#### Borders
- `--border-default`: Default border colour
- `--border-strong`: Stronger border (hover, active)
- `--border-focus`: Focus state border

#### Accent Colours
- `--accent-primary`: Primary accent (cyan)
- `--accent-primary-hover`: Primary hover state
- `--accent-primary-active`: Primary active state
- `--accent-secondary`: Secondary accent (blue)

#### Semantic Colours
- `--colour-success`: Success states
- `--colour-success-bg`: Success background
- `--colour-error`: Error states
- `--colour-error-bg`: Error background
- `--colour-warning`: Warning states
- `--colour-warning-bg`: Warning background
- `--colour-info`: Info states
- `--colour-info-bg`: Info background

#### Status Indicators
- `--status-active`: Active/connected state
- `--status-idle`: Idle/inactive state
- `--status-error`: Error state
- `--status-warning`: Warning state

### Spacing Tokens (8px grid)

- `--space-0`: 0px
- `--space-0-5`: 2px
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-10`: 40px
- `--space-12`: 48px
- `--space-16`: 64px

### Typography Tokens

#### Font Sizes
- `--text-2xs`: 10px
- `--text-xs`: 11px
- `--text-sm`: 12px
- `--text-base`: 13px (body text)
- `--text-md`: 14px
- `--text-lg`: 16px
- `--text-xl`: 20px
- `--text-2xl`: 24px

#### Font Weights
- `--font-weight-normal`: 400
- `--font-weight-medium`: 500
- `--font-weight-semibold`: 600
- `--font-weight-bold`: 700

#### Line Heights
- `--line-height-tight`: 1.25
- `--line-height-normal`: 1.5
- `--line-height-relaxed`: 1.625

#### Letter Spacing
- `--letter-spacing-tight`: -0.025em
- `--letter-spacing-normal`: 0em
- `--letter-spacing-wide`: 0.06em
- `--letter-spacing-wider`: 0.08em

### Border Radius

- `--radius-none`: 0px
- `--radius-sm`: 4px
- `--radius-base`: 6px
- `--radius-md`: 8px
- `--radius-lg`: 10px
- `--radius-xl`: 12px
- `--radius-2xl`: 16px
- `--radius-3xl`: 24px
- `--radius-full`: 9999px

### Shadows

- `--shadow-xs`: Subtle shadow
- `--shadow-sm`: Small shadow
- `--shadow-base`: Base shadow
- `--shadow-md`: Medium shadow
- `--shadow-lg`: Large shadow
- `--shadow-xl`: Extra large shadow
- `--shadow-2xl`: Maximum shadow
- `--shadow-focus`: Focus ring shadow

### Transitions

#### Durations
- `--duration-fast`: 120ms
- `--duration-base`: 150ms
- `--duration-slow`: 200ms
- `--duration-slower`: 300ms

#### Easing Functions
- `--ease-out`: Smooth ease out
- `--ease-in-out`: Smooth ease in-out
- `--ease-spring`: Spring-like animation

## Component Patterns

### Buttons

```html
<!-- Primary button -->
<button class="btn btn-primary tooltip" data-tooltip="Start emulator">
  Start
</button>

<!-- Secondary button -->
<button class="btn tooltip" data-tooltip="Stop emulator">
  Stop
</button>
```

### Inputs

```html
<input
  type="text"
  placeholder="Enter value"
  style="background: var(--bg-surface-elevated); border: 1px solid var(--border-default); colour: var(--text-primary); border-radius: var(--radius-lg); padding: var(--space-2) var(--space-3); font-size: var(--text-sm);"
/>
```

### Cards

```html
<div class="card" style="padding: var(--card-padding);">
  <!-- Card content -->
</div>
```

### Status Indicators

```html
<span class="status-indicator active"></span>
<span class="status-indicator idle"></span>
<span class="status-indicator error"></span>
```

## Tooltips

Add tooltips to any element using the `tooltip` class:

```html
<button class="tooltip" data-tooltip="This button does something">
  Hover me
</button>
```

### Tooltip Positions

- Default: Tooltip appears above
- `tooltip-top`: Tooltip appears below
- `tooltip-right`: Tooltip appears to the left
- `tooltip-left`: Tooltip appears to the right

```html
<button class="tooltip tooltip-right" data-tooltip="Tooltip on the left">
  Button
</button>
```

## Themes

### Dark Theme (Default)

Dark theme is the default. All tokens automatically use dark theme values.

### Light Theme

To enable light theme, add `data-theme="light"` to the `<html>` element:

```html
<html data-theme="light">
```

The theme toggle button in the header automatically switches themes and persists the preference in localStorage.

## Best Practices

### 1. Always Use Design Tokens

✅ Use CSS variables instead of hardcoded values
```css
colour: var(--text-primary);
```

❌ Don't use hardcoded colours
```css
colour: #f1f5f9;
```

### 2. Use Semantic Spacing

✅ Use spacing tokens
```css
padding: var(--space-4);
gap: var(--space-3);
```

❌ Don't use arbitrary values
```css
padding: 16px;
gap: 12px;
```

### 3. Consistent Typography

✅ Use typography tokens
```css
font-size: var(--text-sm);
font-weight: var(--font-weight-medium);
line-height: var(--line-height-normal);
```

❌ Don't use arbitrary sizes
```css
font-size: 12px;
font-weight: 500;
```

### 4. Add Tooltips to Interactive Elements

✅ Add helpful tooltips
```html
<button class="tooltip" data-tooltip="Start the emulator">
  Start
</button>
```

### 5. Use Focus States

✅ Always include focus states for accessibility
```css
button:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  box-shadow: var(--shadow-focus);
}
```

### 6. Smooth Transitions

✅ Use transition tokens
```css
transition: all var(--duration-fast) var(--ease-out);
```

### 7. Respect Reduced Motion

The design system automatically respects `prefers-reduced-motion` media query. Animations are disabled for users who need reduced motion.

## Accessibility

- All colours meet WCAG AA contrast requirements (4.5:1 minimum)
- Focus states are clearly visible
- Tooltips provide additional context
- Reduced motion is respected
- Semantic HTML is used throughout
