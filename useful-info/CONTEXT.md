# Useful Info Page

## Purpose
A curated resource page providing essential links and information for ski touring in the Allgäu region. This page serves as a central hub for external resources that complement the archive's data.

## Structure

### File Organization
```
useful-info/
├── index.html          # Main page with organized resource sections
├── styles.css          # Custom styling for card layouts and info boxes
└── CONTEXT.md          # This file
```

## Content Sections

### 🌤️ Local Weather Forecasting
- **MeteoBlue**: Mobile app for detailed weather forecasts (mountain tops and towns)
- **Snow-Forecast**: Freezing level data and snow predictions

### 🗺️ 3D Mapping
- **Reality Maps**: High-quality 3D terrain visualization for route planning

### ⚠️ Avalanche Reports
- **European Avalanche Report** (avalanche.report): Multi-region coverage
- **LWD Bayern**: Bavarian-specific reports with weather context
- **Historic Archive**: Past avalanche reports for research
- **Info Box**: Guidance on how to read and interpret avalanche reports

### 🏠 Mountain Huts
- Schwarzwasserhütte
- Berghaus Schwaben
- Schwarzenberghütte

### ⛷️ Ski Tour Routes
- **Outdooractive**: Comprehensive route database for the Allgäu

### 🎿 On-Piste Info
- **OK Bergbahnen**: Lift status, parking, and slope information
- **Live Piste Map**: Interactive map with real-time closures
- **Mobile Apps**: iOS and Android app links

## Design System

### Layout Components
- **`.info-section`**: Main section container with bottom margin
- **`.info-grid`**: Responsive grid (auto-fill, min 280px columns)
- **`.info-card`**: Individual resource cards with hover effects
- **`.info-box`**: Highlighted informational callouts (blue accent)
- **`.app-links`**: Styled app download buttons

### Visual Elements
- Large emoji icons for quick visual identification
- Card-based layout with elevation on hover
- Blue-accented info boxes for important details
- Responsive design (single column on mobile)

## Integration

### Navigation
- Linked from main `index.html` as "📚 Useful Info"
- Back links to home page in header and footer
- All external links open in new tabs (`target="_blank"`)

## Maintenance Notes

### When to Update
- Add new resources as they become relevant to ski touring
- Update URLs if external services change
- Add seasonal information if needed (e.g., hut opening times)

### Content Guidelines
- Keep descriptions concise (1-2 sentences per resource)
- Use emoji icons consistently for visual hierarchy
- Maintain alphabetical or logical ordering within sections
- Include warnings/notes where relevant (e.g., Snow-Forecast optimism note)

## Related Files
- **Main site**: `../index.html` (contains link to this page)
- **Shared styles**: `../styles.css` (base design system)
- **Architecture**: `../.ai/CONTEXT.md` (system overview)
