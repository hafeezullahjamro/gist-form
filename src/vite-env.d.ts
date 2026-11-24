/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EASYPAISA_ACCOUNT_TITLE?: string;
  readonly VITE_EASYPAISA_ACCOUNT_NUMBER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
