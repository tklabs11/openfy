/** O app roda dentro do WebView do Capacitor (Android), sem as APIs do Electron. */
export const isMobileApp = (): boolean => typeof window !== 'undefined' && window.openfyMobile === true
