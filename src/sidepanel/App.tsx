export default function App() {
  return (
    <main>
      <h1>UX Doktor</h1>
      <p>Sayfa analizi sonraki fazlarda eklenecek.</p>
      <button type="button" onClick={() => chrome.runtime.openOptionsPage()}>
        Ayarları aç
      </button>
    </main>
  )
}
