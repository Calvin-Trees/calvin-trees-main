# Calvin Trees — AI Code Analysis Findings

## Critical Issues

1. **Bug: Missing `()` on `highlightNearbyTrees`** (`home.page.ts:663`) — The proximity slider has no effect until next GPS update
2. **Hardcoded admin password** (`admin.page.ts:8`) — `'calvin'` in plaintext, trivially bypassable via DevTools
3. **Non-null assertion crash risk** (`home.page.html:357`) — `currentTree!.localImgFile` can throw if modal renders before tree is set

---

## High Priority Improvements

| Issue | Details |
|-------|---------|
| **Monolithic HomePage** (763 lines) | Extract geolocation (~300 lines), search (~90 lines), and tour state (~110 lines) into services/components |
| **Dead Tour1 code** | Tour1 radio is commented out but constant, type, constructor mapping, and branch logic remain |
| **Duplicate debug overlays** | Two overlays show identical geo/map info (lines 120-147 and 165-183), both visible in production (`debugGeo = true`) |
| **Image lookup duplicated 4x** | Same `treeImgs.find()` pattern at lines 537, 613, 623, and constructor — extract to utility |
| **Duplicate search logic** | `HomePage.doSearch()` reimplements `TreeService.searchTrees()` |
| **Mutable module-level variable** | `let HOW_CLOSE_IS_CLOSE` at module scope should be a component property |
| **No tests** | Zero `.spec.ts` files for distance calc, Fisher-Yates, tour state, search |

---

## Medium Priority

- **Mixed `*ngFor` and `@for`** — Two `*ngFor` usages remain while rest uses modern control flow
- **`standalone: false`** on HomePage/AdminPage while other components are standalone
- **No `OnPush` change detection** — GPS updates trigger full change detection every second
- **Parallel array anti-pattern** — `searchResultTrees`, `searchResultStr`, `selectedSearchResults` tracked by index
- **Shared state mutation** — `tree.localImgFile` mutates objects from service BehaviorSubject
- **Geolocation in constructor** — Should be in `ngOnInit`; retry timeout not cleared in `ngOnDestroy`
- **No CSS variables** — `variables.scss` is empty; colors hardcoded everywhere (`#2d6a4f`, `#f59e0b`, etc.)

---

## Low Priority / Polish

- **Accessibility gaps** — Search icon missing `aria-label`, clickable divs not keyboard-accessible, no screen reader info for tour progress dots
- **No exit animations** — Tour HUD/arrival overlay disappear instantly when `@if` becomes false
- **Search results** — No `max-height` constraint, can cover entire map
- **Tour HUD** — Missing `--ion-safe-area-bottom` for notched devices
- **Dead code** — `imageLoaded` never set to true, `GeometryType` interface unused, `FormsModule` imported but unused, `OnInit` imported in marker component but not implemented
- **Inline styles** — Debug control has extensive inline styling that should move to SCSS
- **Vibrate checkbox** — UI element not wired to any handler

---

## Frontend Design Specifics

### CSS/SCSS
- `variables.scss` is empty — no design tokens or brand colors defined
- `::ng-deep` used for MapLibre popup styling (deprecated) — move to `global.scss`
- `.center-text` uses `display: table` for centering (outdated)
- Inline styles scattered in template (debug controls, spacers)

### Responsive Design
- No `@media` breakpoints anywhere — purely mobile-targeted
- Search results list has no `max-height` or scroll constraint
- Tour HUD missing `--ion-safe-area-bottom` for notched iPhones

### Accessibility (a11y)
- Search icon button (line 80-82) has no `aria-label`
- Popup `<div>` with `(click)` handler needs `role="button"`, `tabindex="0"`, `(keydown.enter)`
- `ion-range` for distance has no `aria-label` or associated label
- Tour progress dots are purely visual with no text alternative
- Tree picture modal has no visible close button or keyboard dismiss
- Color alone distinguishes marker types (green/maroon/orange/gold)

### Ionic Components
- Tree picture modal lacks standard structure (`ion-header`, close button)
- Inconsistent use of `ion-img` vs native `<img>`
- Version string "Calvin Trees v0.3.2" hardcoded in `ion-title`

---

## Simplification Opportunities

### Dead Code to Remove
- `Tour1` constant, `tour1Trees` property, `tour1Json` import, `TourInfo` interface, all `mode === 'tour1'` branches
- `GeometryType` interface (defined but never referenced)
- `imageLoaded` property (never set to `true`)
- `OnInit` import in `ShowTreeMarkersComponent` (not implemented)
- `FormsModule` import in `home.module.ts` (no forms in HomePage)
- Commented-out SCSS blocks and template blocks
- One of the two duplicate debug overlays

### Code to Consolidate
- Image lookup (`treeImgs.find(...)` repeated 4x) → single `getTreeImagePath()` utility
- GeoJSON-to-TreeInfo mapping (duplicated in constructor vs `TreeService.parseGeoJsonToTrees`)
- Search logic (duplicated between `HomePage.doSearch()` and `TreeService.searchTrees()`)
- Toast creation (duplicated warning toast pattern at lines 361-373 and 415-427)

### Patterns to Simplify
- `handleTimeout`/`handlePositionUnavailable` are trivial wrappers → call `handleTransientError` directly
- `searchSelectionChanged` → replace with `this.selectAllSelected = this.selectedSearchResults.every(x => x)`
- `selectAllCheckboxChanged` → replace loop with `.fill(true)` / `.fill(false)`
- Three parallel search arrays → single array of `{ tree, displayStr, selected }` objects
- `doSearch` uses `.indexOf() != -1` → use `.includes()`

### Modernization
- Migrate `standalone: false` components to standalone (eliminates `home.module.ts`)
- Replace `*ngFor` with `@for` in remaining two locations
- Use Angular signals (`input()`, `computed()`, `effect()`) instead of `@Input()` + manual subscriptions
- Remove `CommonModule` import from `ShowTreeMarkersComponent` after `@for` migration
- Remove empty constructor from `ShowTreeMarkersComponent`
