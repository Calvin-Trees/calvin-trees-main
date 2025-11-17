# Calvin Trees

An interactive mobile-first web application for exploring the Calvin University campus arboretum. Navigate through campus trees with real-time geolocation, view detailed tree information, and follow curated walking tours.

**Version:** 0.3.2
**Status:** Active Development

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Git Workflow](#git-workflow)
- [Building](#building)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- **Real-time Geolocation Tracking**: See your location on campus with heading indicator
- **Interactive Tree Map**: Browse 113+ trees on Calvin's campus with detailed information
- **Smart Proximity Detection**: Automatic popups when within 10 meters of a tree
- **Search Functionality**: Find trees by common name, scientific name, or commemoration
- **Curated Tours**: Follow Bob Speelman's favorite trees tour
- **Detailed Tree Information**: View scientific names, common names, commemorations, and photos
- **Offline Capability**: Progressive Web App with service worker support
- **Mobile Optimized**: Built with Ionic for native-like mobile experience

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.x or v20.x LTS
- **npm**: v9.x or v10.x
- **Git**: Latest version
- **Angular CLI**: v20.x (`npm install -g @angular/cli@20`)
- **Ionic CLI**: v8.x (`npm install -g @ionic/cli`)

Optional for mobile builds:
- **Capacitor CLI**: v7.x (included in dev dependencies)
- **Xcode**: For iOS builds (macOS only)
- **Android Studio**: For Android builds

---

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd calvin-trees-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create or update `src/environments/environment.ts`:
   ```typescript
   export const environment = {
     production: false,
     mapTilerApiKey: 'YOUR_MAPTILER_API_KEY_HERE'
   };
   ```

   Create or update `src/environments/environment.prod.ts`:
   ```typescript
   export const environment = {
     production: true,
     mapTilerApiKey: 'YOUR_PRODUCTION_MAPTILER_API_KEY_HERE'
   };
   ```

   **Never commit API keys to version control!** Add to `.gitignore`:
   ```bash
   echo "src/environments/environment.ts" >> .gitignore
   echo "src/environments/environment.prod.ts" >> .gitignore
   ```

4. **Verify installation**
   ```bash
   npm run start
   ```

   Navigate to `http://localhost:4200` - you should see the app running.

---

## Development

### Running the Development Server

```bash
npm start
# or
ng serve
```

### Development Tips

- **Enable high accuracy geolocation**: Use HTTPS or localhost (required by browser security)
- **Testing on mobile**: Use `ng serve --host 0.0.0.0` and access via your local IP
- **Debugging maps**: Check browser console for MapLibre GL errors
- **Hot reload**: Changes to TypeScript/HTML/SCSS auto-reload the browser

---

## Git Workflow

This project uses a **Git Flow** branching strategy with two main branches:

### Branch Structure

```
main (production-ready code)
  ↑
  └─── Pull Requests only (for releases)
        ↑
dev (integration branch)
  ↑
  └─── Pull Requests from feature branches
        ↑
feature/* (individual features)
```

### Working with Branches

#### 1. Starting New Work

```bash
# Always start from dev
git checkout dev
git pull origin dev

# Create a feature branch
git checkout -b feature/your-feature-name
# or for bug fixes:
git checkout -b fix/bug-description
```

#### 2. Making Changes

```bash
# Make your changes, then:
git add .
git commit -m "Descriptive commit message"

# Push to remote
git push origin feature/your-feature-name
```

#### 3. Releasing to Production

```bash
# After thorough testing on dev branch:
# Create PR: dev → main on GitHub
# After merge, tag the release:

git checkout main
git pull origin main
git tag -a v0.3.3 -m "Release version 0.3.3 - Description"
git push origin v0.3.3
```

## Building

### Development Build

```bash
npm run build
```

Output: `www/` directory

### Production Build

```bash
ng build --configuration production
```

This creates an optimized build with:
- Minified JavaScript/CSS
- Tree-shaking for smaller bundle size
- Service worker for offline support
- Source maps (optional, disable with `--source-map=false`)

### Mobile Builds

#### iOS

```bash
# Sync web assets to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios

# Build and run from Xcode
```

#### Android

```bash
# Sync web assets to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Build and run from Android Studio
```

---

## Deployment

### Firebase Hosting

This project is configured for Firebase Hosting.

#### Prerequisites

```bash
npm install -g firebase-tools
firebase login
```

#### Deploy

```bash
# Build for production
npm run build -- --configuration production

# Deploy to Firebase
firebase deploy

# Deploy hosting only
firebase deploy --only hosting
```

#### Environments

- **Production**: Deployed from `main` branch
- **Staging** (optional): Deployed from `dev` branch

## Project Structure

```
calvin-trees-main/
├── src/
│   ├── app/
│   │   ├── home/                    # Main map page
│   │   │   ├── home.page.ts        # Map logic, geolocation, search
│   │   │   ├── home.page.html      # Map template
│   │   │   └── home.page.scss      # Map styles
│   │   ├── show-tree-markers/      # Tree marker component
│   │   └── app.component.ts        # Root component
│   ├── assets/
│   │   ├── trees.json              # Tree database (113 trees)
│   │   ├── tour1_geojson.json      # Bob Speelman's tour route
│   │   ├── tree_imgs/              # Tree photographs (111 images)
│   │   ├── treeId2Img.ts           # Image ID mappings
│   │   └── icons/                  # App icons
│   ├── environments/
│   │   ├── environment.ts          # Development config
│   │   └── environment.prod.ts     # Production config
│   └── index.html
├── capacitor.config.ts             # Capacitor configuration
├── angular.json                    # Angular CLI config
├── firebase.json                   # Firebase hosting config
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
├── ISSUES.md                       # Project issues tracker
└── README.md                       # This file
```

---

## Contributing

Please follow these guidelines:

### 1. Find or Create an Issue

- Check [ISSUES.md](./ISSUES.md) for existing issues
- Comment on an issue to claim it
- Create a new issue if needed

### 2. Follow the Git Workflow

- Create feature branch from `dev`
- Make focused, atomic commits
- Write descriptive commit messages
- Keep PRs small and reviewable

### 3. Code Standards

- **TypeScript**: Use strict typing, avoid `any`
- **Formatting**: Run `npm run lint` before committing
- **Testing**: Add tests for new features
- **Documentation**: Update README/ISSUES.md as needed

## Project Status

**Current Version**: 0.3.2
**Last Updated**: November 2025

### Tech Stack

- **Angular**: 20.3.12
- **TypeScript**: 5.8.3
- **Ionic**: 8.0.0
- **Capacitor**: 7.4.4
- **MapLibre GL**: 4.7.1
- **RxJS**: 7.8.2

---

## License

N/A ??

---

## 👥 Contributors

- Original Author: [Professor Victor Norman]
- Current Contributors: [Alim Darmenov, Sam Viss, Peter Brink]