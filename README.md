# ConceptDesignStudio

**1.5.1** · 软件概念设计工作台：用 AI 辅助完成概念阶段的设计推演，桌面端运行。

## 功能特性

- Electron 桌面应用，使用 React + Vite + TypeScript，并用 Mermaid 呈现设计图。
- 项目数据以 JSON 自动保存在本机 `%APPDATA%\ConceptDesignStudio\data\projects.json`。
- 可用 Playwright 对 Electron 做端到端测试。

## 技术栈

- Electron 33
- React 18 + Vite 5 + TypeScript
- Mermaid 11
- Playwright

## 从源码运行

源码在仓库根目录。本仓库不包含安装包。

```bash
npm install
npm run build
npm start            # Electron
npm run dev          # Vite 开发
npm test             # Playwright（Linux 可用 xvfb-run -a npm test）
```
## 文档

- [源码 README](README.original.md)

## 许可证

`package.json` 声明为 MIT。仓库根目录未附带 LICENSE 文件。

---

## English

# Concept Design Studio

**1.5.1** · A software concept-design workbench: desktop app for AI-assisted concept-phase design.

## Features

- Electron desktop app with React, Vite, TypeScript, and Mermaid diagrams.
- Projects auto-save as JSON at `%APPDATA%\ConceptDesignStudio\data\projects.json` on Windows.
- Playwright end-to-end tests for the Electron app.

## Tech stack

- Electron 33
- React 18 + Vite 5 + TypeScript
- Mermaid 11
- Playwright

## Getting started

Source is at the repository root. This repository does not include installers.

```bash
npm install
npm run build
npm start            # Electron
npm run dev          # Vite dev server
npm test             # Playwright (on Linux: xvfb-run -a npm test)
```
## Documentation

- [源码 README](README.original.md)

## License

`package.json` declares MIT. There is no LICENSE file at the repository root.

