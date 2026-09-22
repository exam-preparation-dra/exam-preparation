/* Physics Lover 2.0 — Final Improvement Loader
 * Load this once from profile-final.html / improvement-test.html where needed.
 * It intentionally does not replace existing day/night/theme code.
 */
export async function loadImprovementFinalLayer({ profile = false } = {}) {
  const modules = [];

  if (profile) {
    modules.push(import("./improvement-profile-final-integration.js"));
  }

  modules.push(import("./improvement-profile-refresh.js"));
  modules.push(import("./improvement-xp-integration.js"));

  const loaded = await Promise.all(modules);
  loaded.forEach(mod => {
    const fn = mod?.initFinalImprovementProfileIntegration;
    if (typeof fn === "function") fn();
  });

  return { loaded: true, moduleCount: loaded.length };
}
