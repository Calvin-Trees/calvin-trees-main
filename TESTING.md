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

| File | Tests | Covers |
|---|---|---|
| `services/tree.service.spec.ts` | 46 | CRUD, search, localStorage persistence, observable behavior, GeoJSON parsing, reset |
| `home/home.page.spec.ts` | 67 | Geolocation, compass, mode switching, proximity detection, random tour lifecycle, search + selection, popup handling |
| `admin/admin.page.spec.ts` | 23 | Passphrase auth, sessionStorage, create/edit modals, delete/reset confirmation alerts, logout |
| `admin/components/tree-form/tree-form.component.spec.ts` | 16 | Reactive form validation, create vs edit mode, save/cancel dismiss |
| `admin/components/tree-list/tree-list.component.spec.ts` | 12 | Tree loading, search filtering, editTree/deleteTree event emission, subscription cleanup |
| `show-tree-markers/show-tree-markers.component.spec.ts` | 14 | Input defaults, input binding |
| `app.component.spec.ts` | 1 | Smoke test |

**Total: 188 tests**

## Coverage

| Metric | Coverage |
|---|---|
| Statements | 85% |
| Branches | 77% |
| Functions | 84% |
| Lines | 85% |

## Notes

- **Geolocation** is mocked via `spyOn(navigator.geolocation, 'watchPosition')` with `jasmine.clock()` to prevent real timers from firing during retry logic.
- **MapLibre GL** components are skipped in templates using `CUSTOM_ELEMENTS_SCHEMA` since they require a live WebGL context.
- **Ionic controllers** (`ModalController`, `AlertController`, `ToastController`) are mocked with `jasmine.createSpyObj` and fake return objects.
- The `TreeService` tests use real `localStorage` (cleared in `beforeEach`/`afterEach`) and the actual `trees.json` asset.
