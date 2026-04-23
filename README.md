# Calvin Trees

Calvin Trees is a mobile-first Ionic/Angular application for exploring trees on
Calvin University's campus. The main screen is an interactive MapLibre map with
geolocation, searchable tree markers, tree detail cards, proximity alerts, and
two walking-tour modes.

**Current app version:** 0.3.8  
**Status:** active coursework/development build  
**Primary routes:** `/home`, `/admin`

## Features

- **Interactive campus map:** Renders the campus tree dataset from `src/assets/trees.json`.
- **User location tracking:** Uses browser geolocation to center the map and show the user's current position.
- **Nearby tree detection:** Highlights trees within the selected proximity radius, defaulting to 10 meters.
- **Search:** Finds trees by common name, scientific name, or commemoration text.
- **Tree details:** Shows common name, scientific name, commemoration, coordinates, and local tree photos when mapped.
- **Random tour:** Selects a random set of target trees and advances as the user reaches each target.
- **Bob Speelman's 12 Favorites:** Curated tour data in `src/assets/speelman-tour.ts`.
- **Admin maintenance:** Passphrase-gated CRUD UI for local tree edits stored in browser `localStorage`.
- **PWA support:** Production builds register the Angular service worker.
- **Native shells:** Capacitor iOS and Android project folders are present.

Current tour modes show target markers and distance to the next tree. They do
not currently render turn-by-turn route geometry from a directions API.

## Requirements

- Node.js 18 LTS or 20 LTS
- npm 9 or 10
- Git
- Angular CLI 20 (`npm install -g @angular/cli@20`) or `npx ng`
- Ionic CLI 8 (`npm install -g @ionic/cli`) for Ionic/Capacitor workflows

Optional native build tools:

- Xcode for iOS builds on macOS
- Android Studio for Android builds

## Setup

```bash
git clone <repository-url>
cd calvin-trees-main
npm install
npm start
```

Open `http://localhost:4200`.

Geolocation works on `localhost` during development. For testing on a phone,
serve on the local network:

```bash
ng serve --host 0.0.0.0
```

Then open the machine's local IP address from the phone.

## Environment

Map tiles use `environment.maptilerApiKey`.

Files:

- `src/environments/environment.ts` for development
- `src/environments/environment.prod.ts` for production builds
- `src/environments/environment.example.ts` as the template

Example:

```ts
export const environment = {
  production: false,
  maptilerApiKey: 'YOUR_MAPTILER_API_KEY_HERE'
};
```

Security note: MapTiler browser keys are public client-side credentials once the
app is shipped. The current repository includes environment files for this
coursework build; rotate the key before publishing the app outside the class
context.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Run the Angular dev server on `localhost:4200`. |
| `npm run build` | Build the web app into `www/`. |
| `npm test -- --no-watch --browsers=ChromeHeadless` | Run the unit test suite once. |
| `npm test -- --no-watch --browsers=ChromeHeadless --code-coverage` | Run tests with coverage output. |
| `npm run lint` | Run Angular ESLint over `src/**/*.ts` and `src/**/*.html`. |

## Architecture

### App Shell

- `src/main.ts` bootstraps `AppModule`.
- `src/app/app.module.ts` centralizes Ionic, routing, and service worker setup.
- `src/app/app.component.ts` owns service worker update polling and reloads when a new production version is ready.

### Routes

- `/home` lazy-loads `HomePage`.
- `/admin` lazy-loads `AdminPage`.
- `/` redirects to `/home`.

### Home Map

`src/app/home/home.page.ts` owns the main user experience:

- Browser geolocation watch and retry behavior
- MapLibre setup and user-location image registration
- Nearby-tree detection
- Search UI state
- Tree detail modal state
- Random tour state
- Bob Speelman tour state
- Compass/device-orientation behavior

`src/app/show-tree-markers/` is the shared marker-layer component used by the
home map for all marker categories.

### Data Layer

`TreeService` is the in-browser repository:

- Loads the checked-in GeoJSON tree dataset on first run
- Exposes the current tree list through `trees$`
- Searches by name, scientific name, and commemoration
- Persists admin changes in `localStorage`
- Can reset local edits back to the checked-in dataset

No backend database is currently used.

### Admin

The admin page is a local maintenance tool, not production-grade authentication.
The passphrase is defined in `src/app/admin/admin.page.ts`; it protects the UI
from casual use but is visible to anyone inspecting the client bundle.

Admin changes are local to the browser. They do not modify `trees.json` and do
not sync between devices.

## Project Structure

```text
calvin-trees-main/
├── src/
│   ├── app/
│   │   ├── admin/                 # Local CRUD admin page and modal/list components
│   │   ├── home/                  # Main map, search, geolocation, and tour page
│   │   ├── services/              # TreeService local repository
│   │   ├── shared/interfaces/     # Shared tree and GeoJSON TypeScript shapes
│   │   ├── show-tree-markers/     # Shared MapLibre marker layer component
│   │   ├── app-routing.module.ts  # Lazy route definitions
│   │   ├── app.component.*        # Root shell and service worker update behavior
│   │   └── app.module.ts          # Angular/Ionic module bootstrap
│   ├── assets/
│   │   ├── trees.json             # Campus tree GeoJSON source data
│   │   ├── tree_imgs/             # Local tree photos
│   │   ├── treeId2Img.ts          # Tree id to photo id mapping
│   │   ├── speelman-tour.ts       # Curated tour copy and order
│   │   └── tracking_dot.png       # User-location marker image
│   ├── environments/              # MapTiler/environment configuration
│   ├── tests/                     # Jasmine/Karma unit tests
│   ├── global.scss                # Global styles and Ionic overrides
│   └── theme/variables.scss       # App CSS custom properties
├── android/                       # Capacitor Android project
├── ios/                           # Capacitor iOS project
├── capacitor.config.ts            # Capacitor app config
├── firebase.json                  # Firebase hosting config
├── TESTING.md                     # Test-suite details and current coverage
└── README.md                      # Project overview
```

## Build

Development build:

```bash
npm run build
```

Production build:

```bash
ng build --configuration production
```

Both write web assets to `www/`.

## Native Builds

Both Capacitor platforms are installed in this repository.

iOS:

```bash
npx cap sync ios
npx cap open ios
```

Android:

```bash
npx cap sync android
npx cap open android
```

Build and run from Xcode or Android Studio after syncing.

## Deployment

Firebase Hosting is configured through `firebase.json`.

```bash
npm run build -- --configuration production
firebase deploy
```

Use `firebase deploy --only hosting` when only hosting assets changed.

## Contributing

1. Start from the current integration branch used by the team.
2. Keep PRs focused on one behavior or documentation area.
3. Update `README.md` and/or `TESTING.md` when behavior, setup, test status, or known risks change.
4. Run `npm run build`, `npm run lint`, and the headless test command before handing off.
5. Avoid committing real production credentials. Browser map keys should be scoped and replaceable.

## Troubleshooting

- **Map does not load:** Check `environment.maptilerApiKey` and browser console network errors.
- **Geolocation does not update:** Use `localhost`, HTTPS, or a secure mobile test origin. Browser geolocation is blocked on insecure origins.
- **Phone testing cannot reach dev server:** Run `ng serve --host 0.0.0.0` and confirm the phone is on the same network.
- **Admin edits disappear in another browser:** Admin edits are stored in the current browser's `localStorage`.
- **Old PWA content persists:** Production service worker updates are activated by `AppComponent`; close/reopen the PWA if a device still shows an old cached build.

## License

TBD.

## Contributors

- Original author: Professor Victor Norman
- Current contributors: Alim Darmenov, Sam Viss, Peter Brink
