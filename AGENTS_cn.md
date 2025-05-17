# 项目架构与开发指南

**注意**：本文档为英文版 `AGENTS.md` 的中文翻译。阅读代码时可以忽略本文件，但若修改 `AGENTS.md`，请同步更新此文件。

本项目是一个基于 [Tauri](https://tauri.app/) 和 React/TypeScript 的桌面应用，用于在 OBS、VRChat 等平台提供语音转文字字幕。仓库中还包含位于 `src-tauri` 目录下的 Rust 后端。

## 仓库结构

- `src/`
  - `client/` – React 客户端组件与服务
  - `server/` – 由 Tauri 应用调用的服务端逻辑
  - `shared/` – 客户端与服务端共享的工具（点对点连接、发布订阅等）
  - `assets/`、`i18n.ts`、`index.tsx` – 入口及通用资源
- `src-tauri/` – Tauri 应用及原生插件的 Rust 代码
- `public/` – 应用加载的静态 HTML
- `tests/` – Playwright 测试

### 详细目录

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

## 架构概览

```
+-----------+       +--------+       +--------+       +-----------+
| React UI  | <-->  | Shared | <-->  | Server | <-->  | Rust/Tauri|
|  客户端   |       | 工具库 |       | Node端 |       | 后端      |
+-----------+       +--------+       +--------+       +-----------+
```

## 工具链

- **构建**：[Vite](https://vitejs.dev/)（React + SWC）
- **样式**：[TailwindCSS](https://tailwindcss.com/) 与 [DaisyUI](https://daisyui.com/)
- **状态管理**：[`valtio`](https://github.com/pmndrs/valtio) 结合 `immer-yjs`
- **测试**：Playwright
- **格式化**：Prettier（见 `package.json`）
- **Rust**：`src-tauri` 中配置的 Tauri 插件

## TypeScript 设置

项目启用 strict 模式，使用 ESNext 模块与 React JSX，路径通过 `@/*` 进行别名。`tsconfig.json` 关键配置如下：

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

## 服务模式

`src/types.ts` 定义了客户端与服务端共用的接口：

```ts
export interface IServiceInterface {
  init(): void;
}
```

客户端和服务端都会构建一系列服务类，示例摘自 `src/server/index.ts`：

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

每个服务都实现 `init()`，并在全局 `ApiServer` 或 `ApiClient` 对象中实例化。共享工具（如 `pubsub`、`peer`）位于 `src/shared`。

## Rust 后端

Tauri 后端采用插件化架构，`Cargo.toml` 中列出了所需依赖：

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
tauri = { version = "1.6", features = ["http-all", "dialog-all", "fs-all", "global-shortcut-all", "shell-open", "window-all"] }
warp = "0.3.3"
tokio = { version = "1.23.0", features = ["full"] }
```

`src-tauri/src/main.rs` 中初始化诸如 `web`、`audio`、`windows_tts` 等插件。

## React 组件

React 组件以函数式组件结合 hooks 编写，示例取自 `src/client/ui/view.tsx`：

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

## 贡献规范

- 所有前端代码均使用 **TypeScript**，保持编译器严格模式
- 代码需使用 **Prettier** 格式化
- 使用函数式 React 组件与 hooks
- 保持服务式架构，新功能以实现 `IServiceInterface` 的服务形式添加
- 遵循现有文件命名规范（如 `Service_Name`、`Element_Name`）
- Rust 代码遵循 `src-tauri/rustfmt.toml` 中的设置（导入分组、行宽 150）

## 测试

执行 Playwright 测试：

```bash
pnpm exec playwright test
```

## 其他说明

- 客户端与服务端通过 peer 连接和 WebSocket 发布订阅通信，代码位于 `src/shared`
- UI 样式使用 Tailwind 与 DaisyUI，主题在 `tailwind.config.cjs` 中定义
