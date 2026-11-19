# 软件概念设计工作台 (ConceptDesignStudio)
Electron 33 + React 18 + Vite 5 + TypeScript + Mermaid 11。
- 开发：`npm install`，`npm run build`，`npm start`
- 测试：`npm test`（Playwright for Electron，Linux 下用 `xvfb-run -a npm test`）
- 打包：`npm run dist:win` → release/ConceptDesignStudio-Setup-1.0.0.exe
- 数据：%APPDATA%\ConceptDesignStudio\data\projects.json（JSON，自动保存）
