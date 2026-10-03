import SettingsSummary, { useSettings } from './SettingsSummary'

export default function App() {
  const settings = useSettings()
  return (
    <main>
      <h1>UX Doktor</h1>
      <SettingsSummary settings={settings} />
      <p className="muted">Sayfa analizi sonraki fazlarda eklenecek.</p>
    </main>
  )
}
