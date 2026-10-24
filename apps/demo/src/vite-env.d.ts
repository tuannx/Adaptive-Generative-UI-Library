/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Same-origin CORS proxy prefix, set by `vite build --mode cloudflare` (see .env.cloudflare). */
  readonly VITE_AGUL_PROXY?: string;
  /** Decision API for AI layout (the Worker's /decide route), set by `--mode cloudflare`. */
  readonly VITE_AGUL_DECIDE?: string;
}
