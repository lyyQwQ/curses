# Project Architecture and Guidelines

**Note**: This document is in English. A Chinese translation is available in `AGENTS_cn.md`. Ignore the translation when analyzing code, but keep both files in sync whenever `AGENTS.md` is modified.

This project is a desktop application built with [Tauri](https://tauri.app/) and React/TypeScript. It provides speech-to-text captions for OBS, VRChat, and other platforms. The repository also contains a Rust backend under `src-tauri`.

## Repository Structure

- `src/`
  - `client/` – React client components and services.
  - `server/` – server side services invoked from the Tauri application.
  - `shared/` – utilities shared between client and server (peer connections, pub/sub, etc.).
  - `assets/`, `i18n.ts`, `index.tsx` – entry point and shared assets.
- `src-tauri/` – Rust code for the Tauri application and native plugins.
- `public/` – static HTML files loaded by the app.
- `tests/` – Playwright tests.

### Detailed Directory Overview

```
src
├─ assets
│  └─ fonts
├─ client
│  ├─ elements
│  │  ├─ image
│  │  └─ text
│  ├─ schema
│  ├─ services
│  │  └─ sound
│  └─ ui
├─ server
│  ├─ services
│  │  ├─ stt
│  │  │  └─ services
│  │  ├─ tts
│  │  │  └─ services
│  │  ├─ translation
│  │  │  └─ services
│  │  ├─ vrc
│  │  │  └─ targets
│  │  ├─ discord
│  │  └─ twitch
│  └─ ui
│     ├─ inspector
│     │  └─ components
│     └─ dropdown
├─ shared
│  └─ services
│     ├─ peer
│     └─ pubsub
└─ utils

src-tauri
├─ src
│  └─ services
│     ├─ web
│     ├─ audio
│     ├─ keyboard
│     └─ translate
└─ icons

tests
```

## Architecture Overview

```
+-----------+       +--------+       +--------+       +-----------+
| React UI  | <-->  | Shared | <-->  | Server | <-->  | Rust/Tauri|
|  Client   |       | Utils  |       |  Node  |       |  Backend  |
+-----------+       +--------+       +--------+       +-----------+
```

## Tooling

- **Build**: [Vite](https://vitejs.dev/) with React and SWC.
- **Styling**: [TailwindCSS](https://tailwindcss.com/) and [DaisyUI](https://daisyui.com/).
- **State Management**: [`valtio`](https://github.com/pmndrs/valtio) with `immer-yjs` for document binding.
- **Testing**: Playwright.
- **Formatting**: Prettier (see `package.json` dev dependencies).
- **Rust**: Tauri plugins configured in `src-tauri`.

## TypeScript Configuration

TypeScript uses strict mode with ESNext modules and React JSX. Paths are aliased under `@/*`. Relevant excerpt from `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "strict": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Services Pattern

`src/types.ts` defines a simple interface used by both client and server services:

```ts
export interface IServiceInterface {
  init(): void;
}
```

Both the client and server construct a collection of service classes. Example from `src/server/index.ts`:

```ts
export enum Services {
  vrc = "vrc",
  stt = "stt",
  tts = "tts",
  translation = "translation",
  twitch = "twitch",
  discord = "discord",
  bilibili = "bilibili",
}

class ApiServer {
  private readonly _state = new Service_State();
  public readonly stt = new Service_STT();
  public readonly tts = new Service_TTS();
  // ...
}
```

Each service implements `init()` and is instantiated in the global `ApiServer` or `ApiClient` objects. Shared utilities (`pubsub`, `peer`) reside under `src/shared`.

## Rust Backend

The Tauri backend uses a plugin-based architecture. `Cargo.toml` lists the dependencies and features required by the application:

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
tauri = { version = "1.6", features = ["http-all", "dialog-all", "fs-all", "global-shortcut-all", "shell-open", "window-all"] }
warp = "0.3.3"
tokio = { version = "1.23.0", features = ["full"] }
```

Plugins such as `web`, `audio`, `windows_tts`, etc., are initialized in `src-tauri/src/main.rs`.

## React Components

React components are written as functional components using hooks. Example simplified from `src/client/ui/view.tsx`:

```tsx
const View: FC = () => {
  const canvas = useGetState(state => state.canvas);
  const ids = useGetState(state => state.elementsIds);
  return (
    <div className="overflow-hidden w-screen h-screen flex items-center justify-center">
      <div style={{ width: canvas?.w, height: canvas?.h }} className="relative">
        {ids?.map(id => <ElementSimpleTransform id={id} key={id} />)}
      </div>
    </div>
  );
};
```

## Contribution Guidelines

- Use **TypeScript** for all frontend code. Keep the compiler options strict.
- Format code with **Prettier**.
- Use functional React components and hooks.
- Maintain the service architecture – new features should be implemented as services implementing `IServiceInterface`.
- Follow existing file naming conventions (`Service_Name`, `Element_Name`).
- Rust code follows the settings in `src-tauri/rustfmt.toml` (imports grouped, line width 150).

## Testing

Run Playwright tests with:

```bash
pnpm exec playwright test
```

## Additional Notes

- The client and server communicate via a peer connection and WebSocket pub/sub implemented under `src/shared`.
- UI styling uses Tailwind with DaisyUI themes defined in `tailwind.config.cjs`.
