import type { OpenfyApi } from '@shared/types'

declare global {
  interface Window {
    api: OpenfyApi
  }
}

export {}
