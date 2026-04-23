# Testing

Unit tests use Jasmine, Karma, and headless Chrome.

Last verified: April 22, 2026.

## Commands

```bash
# Run tests once
npm test -- --no-watch --browsers=ChromeHeadless

# Run tests once with coverage
npm test -- --no-watch --browsers=ChromeHeadless --code-coverage

# Run tests in watch mode during development
npm test
```

Coverage output is written to `coverage/app/`.

## Current Status

The latest verified coverage run completed successfully:

```text
TOTAL: 201 SUCCESS
```

## Test Files

All test files live under `src/tests/` and mirror the `src/app/` structure.

| File | Tests | Covers |
| --- | ---: | --- |
| `src/tests/services/tree.service.spec.ts` | 46 | Loading from GeoJSON/localStorage, CRUD, search, observable emissions, persistence, reset behavior |
| `src/tests/home/home.page.spec.ts` | 89 | Initialization, cardinal direction, heading degrees, nearby-tree detection, mode switching, random and Speelman tour state, geolocation success/error handling, search, selected marker display, popup handling, proximity distance changes, compass state, teardown |
| `src/tests/admin/admin.page.spec.ts` | 19 | Passphrase auth, sessionStorage, create/edit modal flows, delete/reset confirmation alerts, logout |
| `src/tests/admin/components/tree-form/tree-form.component.spec.ts` | 18 | Reactive form validation, create/edit initialization, save/cancel modal dismissal |
| `src/tests/admin/components/tree-list/tree-list.component.spec.ts` | 14 | Tree loading, search filtering, edit/delete event emission, subscription cleanup |
| `src/tests/show-tree-markers/show-tree-markers.component.spec.ts` | 14 | Marker input defaults and bindings |
| `src/tests/app.component.spec.ts` | 1 | Root component smoke test |

**Total:** 201 tests.

## Coverage

Latest verified coverage:

| Metric | Coverage |
| --- | ---: |
| Statements | 74.10% (395/533) |
| Branches | 62.67% (89/142) |
| Functions | 70.89% (95/134) |
| Lines | 75.95% (379/499) |

## Test Design Notes

- Geolocation is mocked before `HomePage` is created so no test requests the real browser location.
- `HomePage` tests override the heavy map/menu template with a minimal host element because those specs exercise component logic, not MapLibre rendering.
- MapLibre and Ionic UI internals are isolated with Angular test schemas or spies where the test only needs component behavior.
- Ionic controllers (`ModalController`, `AlertController`, `ToastController`) are mocked with `jasmine.createSpyObj` and fake return objects.
- `TreeService` tests use real `localStorage` and clear it around each test.
- Tests that exercise retry timers use Jasmine fake timers to avoid waiting on real delays.
