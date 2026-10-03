// İsteğe bağlı site erişim izni (manifest: optional_host_permissions). Kurulumda istenmez;
// yalnızca activeTab yetmediğinde kullanıcı düğmeyle açıkça verir, ayarlar sayfasından geri alabilir.

/** manifest.config.ts içindeki optional_host_permissions ile aynı olmalı. */
export const OPTIONAL_ORIGINS = ['http://*/*', 'https://*/*']

export function requestSiteAccess(): Promise<boolean> {
  return chrome.permissions.request({ origins: OPTIONAL_ORIGINS })
}

export function hasSiteAccess(): Promise<boolean> {
  return chrome.permissions.contains({ origins: OPTIONAL_ORIGINS })
}

export function revokeSiteAccess(): Promise<boolean> {
  return chrome.permissions.remove({ origins: OPTIONAL_ORIGINS })
}
