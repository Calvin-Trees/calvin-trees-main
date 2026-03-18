# Testing

Unit tests use **Jasmine** + **Karma** with headless Chrome.

## Commands

```bash
# Run tests once (CI-friendly)
ng test --no-watch --browsers=ChromeHeadless

# Run tests with coverage report
ng test --no-watch --browsers=ChromeHeadless --code-coverage

# Run tests in watch mode (development)
ng test
```

Coverage output is written to `./coverage/app/` (HTML + text-summary).

## Test Files

All test files are located under `src/tests/`, mirroring the `src/app/` structure.

| File | Tests | Covers |
|---|---|---|
| `src/tests/services/tree.service.spec.ts` | 46 | CRUD, search, localStorage persistence, observable behavior, GeoJSON parsing, reset |
| `src/tests/home/home.page.spec.ts` | 91 | Initialization, cardinal direction, heading degrees, highlightNearbyTrees, mode switching, random tour lifecycle + proximity + advancement, geolocation error/retry, search + selection, showAllTrees, showMarkersForOnlySelected, popup handling, distanceToTreeChanged, compass, ngOnDestroy |
| `src/tests/admin/admin.page.spec.ts` | 19 | Passphrase auth, sessionStorage, create/edit modals, delete/reset confirmation alerts, logout |
| `src/tests/admin/components/tree-form/tree-form.component.spec.ts` | 18 | Reactive form validation, create vs edit mode, save/cancel dismiss |
| `src/tests/admin/components/tree-list/tree-list.component.spec.ts` | 15 | Tree loading, search filtering, editTree/deleteTree event emission, subscription cleanup |
| `src/tests/show-tree-markers/show-tree-markers.component.spec.ts` | 14 | Input defaults, input binding |
| `src/tests/app.component.spec.ts` | 1 | Smoke test |

**Total: 203 tests (all passing)**

## Coverage

| Metric | Coverage |
|---|---|
| Statements | 87.17% (408/468) |
| Branches | 83.19% (99/119) |
| Functions | 84.34% (97/115) |
| Lines | 88.08% (392/445) |

## Notes

- **Geolocation** is mocked via `spyOn(navigator.geolocation, 'watchPosition')` with `jasmine.clock()` to prevent real timers from firing during retry logic.
- **MapLibre GL** components are skipped in templates using `CUSTOM_ELEMENTS_SCHEMA` since they require a live WebGL context.
- **Ionic controllers** (`ModalController`, `AlertController`, `ToastController`) are mocked with `jasmine.createSpyObj` and fake return objects.
- The `TreeService` tests use real `localStorage` (cleared in `beforeEach`/`afterEach`) and the actual `trees.json` asset.
