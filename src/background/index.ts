// Araç çubuğu ikonuna tıklanınca popup yerine yan panel açılır.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error('[UX Doktor] Yan panel davranışı ayarlanamadı:', error))
