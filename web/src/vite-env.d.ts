/// <reference types="vite/client" />

import type { PipyterRuntimeConfig } from './runtime/config'

declare global {
  interface Window {
    __PIPYTER_CONFIG__?: PipyterRuntimeConfig
  }
}

export {}
