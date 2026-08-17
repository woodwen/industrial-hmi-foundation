import type { HmiApi } from '../shared/hmi-api'

declare global {
  interface Window {
    hmi: HmiApi
  }
}

export {}
