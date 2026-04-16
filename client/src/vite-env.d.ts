/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
