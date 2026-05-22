/// <reference types="vite/client" />

declare module '*.wasm' {
  const init: (opts?: WebAssembly.Imports) => Promise<WebAssembly.Exports>
  export default init
}
