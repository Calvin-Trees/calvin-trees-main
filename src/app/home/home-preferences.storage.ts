const HOME_PREFERENCES_KEY = 'calvin-trees-home-preferences-v1';

export interface HomePreferences {
  compassEnabled: boolean;
  proximityDistance: number;
  vibrateWhenNearTree: boolean;
}

export const DEFAULT_HOME_PREFERENCES: HomePreferences = {
  compassEnabled: false,
  proximityDistance: 10,
  vibrateWhenNearTree: false,
};

export function loadHomePreferences(): HomePreferences {
  try {
    const raw = window.localStorage.getItem(HOME_PREFERENCES_KEY);
    if (!raw) return DEFAULT_HOME_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<HomePreferences>;
    return {
      compassEnabled:
        typeof parsed.compassEnabled === 'boolean'
          ? parsed.compassEnabled
          : DEFAULT_HOME_PREFERENCES.compassEnabled,
      proximityDistance:
        typeof parsed.proximityDistance === 'number'
          ? parsed.proximityDistance
          : DEFAULT_HOME_PREFERENCES.proximityDistance,
      vibrateWhenNearTree:
        typeof parsed.vibrateWhenNearTree === 'boolean'
          ? parsed.vibrateWhenNearTree
          : DEFAULT_HOME_PREFERENCES.vibrateWhenNearTree,
    };
  } catch {
    return DEFAULT_HOME_PREFERENCES;
  }
}

export function saveHomePreferences(preferences: HomePreferences): void {
  try {
    window.localStorage.setItem(HOME_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage write failures (private mode, quota, etc.)
  }
}
