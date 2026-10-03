import { useEffect, useState } from 'react'
import { getModelOption } from '@/shared/models'
import { getPublicSettings, type PublicSettings } from '@/shared/settings'

/** Yan panelin üstünde anahtar/model durumunu gösterir; ayarlar değişince kendini günceller. */
export function useSettings(): PublicSettings | null {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  useEffect(() => {
    const load = () => getPublicSettings().then(setSettings)
    load()
    const onChanged = (_changes: unknown, area: string) => {
      if (area === 'local') load()
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])
  return settings
}

export default function SettingsSummary({ settings }: { settings: PublicSettings | null }) {
  if (!settings) return null
  return (
    <div className="row settings-summary">
      <span>
        Model: <strong>{getModelOption(settings.model)?.id ?? settings.model}</strong>
      </span>
      <span>
        API anahtarı: <strong>{settings.hasApiKey ? 'kayıtlı' : 'yok'}</strong>
      </span>
      <button type="button" className="secondary" onClick={() => chrome.runtime.openOptionsPage()}>
        Ayarlar
      </button>
    </div>
  )
}
