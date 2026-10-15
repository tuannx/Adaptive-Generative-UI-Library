/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Same-origin CORS proxy prefix, set by `vite build --mode cloudflare` (see .env.cloudflare). */
  readonly VITE_AGUL_PROXY?: string;
}
