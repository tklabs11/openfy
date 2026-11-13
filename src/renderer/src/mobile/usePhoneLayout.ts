import { useEffect, useState } from 'react'

const QUERY = '(max-width: 620px)'

/**
 * No celular o app usa a navegação por abas. A janela do desktop tem largura
 * mínima de 900px, então este layout só é ativado no WebView do Android.
 */
export function usePhoneLayout(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)

  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const update = (): void => setPhone(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return phone
}
