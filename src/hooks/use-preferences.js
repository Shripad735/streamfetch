import { useCallback, useEffect, useState } from "react";

const DEFAULT_SETTINGS = {
  clipboardWatcherEnabled: false,
  theme: "light",
  defaultMode: "video",
  defaultQuality: "best",
  defaultConcurrentFragments: 1,
  defaultOutputFolder: "",
  globalSpeedLimit: ""
};

export function usePreferences(hasElectron, pushToast) {
  const [preferences, setPreferences] = useState(DEFAULT_SETTINGS);
  const [preferencesLoaded, setPreferencesLoaded] = useState(!hasElectron);

  useEffect(() => {
    let disposed = false;
    if (!hasElectron || !window.electronAPI?.getSettings) return () => {};

    window.electronAPI
      .getSettings()
      .then((payload) => {
        if (disposed) return;
        setPreferences((prev) => ({
          ...prev,
          ...payload
        }));
        setPreferencesLoaded(true);
      })
      .catch(() => {
        if (disposed) return;
        setPreferences(DEFAULT_SETTINGS);
        setPreferencesLoaded(true);
      });

    return () => {
      disposed = true;
    };
  }, [hasElectron]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", preferences.theme === "dark" ? "dark" : "light");
  }, [preferences.theme]);

  const updatePreferences = useCallback(
    async (partial, options = {}) => {
      const optimistic = options.optimistic !== false;
      const previous = preferences;

      if (optimistic) {
        setPreferences((prev) => ({ ...prev, ...partial }));
      }

      if (!hasElectron || !window.electronAPI?.updateSettings) {
        return { success: !hasElectron, settings: { ...previous, ...partial } };
      }

      try {
        const response = await window.electronAPI.updateSettings(partial);
        const nextSettings = response?.settings || { ...previous, ...partial };
        setPreferences((prev) => ({
          ...prev,
          ...nextSettings
        }));
        return { success: true, settings: nextSettings };
      } catch (error) {
        if (optimistic) {
          setPreferences(previous);
        }
        pushToast({
          type: "error",
          title: "Settings Failed",
          message: error.message || "Unable to save your preferences."
        });
        return { success: false, error };
      }
    },
    [hasElectron, preferences, pushToast]
  );

  return {
    preferences,
    preferencesLoaded,
    setPreferences,
    updatePreferences
  };
}
