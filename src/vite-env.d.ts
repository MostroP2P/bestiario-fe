/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** SPEC 3: the publisher pubkey, resolved at build time and never at runtime. */
  readonly VITE_PUBLISHER_PUBKEY?: string
  /** SPEC 10.2: `/` for a custom domain, `/<repo>/` for a project page. */
  readonly VITE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
