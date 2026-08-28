/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
}

declare const __LAN_ORIGIN__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
