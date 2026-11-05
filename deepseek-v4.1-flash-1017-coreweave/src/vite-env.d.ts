/// <reference types="vite/client" />

declare global {
  interface Window {
    __pocket?: Record<string, unknown>;
  }
}

export {};
