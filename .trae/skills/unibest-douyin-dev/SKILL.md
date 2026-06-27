---
name: unibest-douyin-dev
description: 基于 unibest 框架开发抖音小程序的完整技能树与规范指南，涵盖 Vue3、TypeScript、UnoCSS 及多端适配技巧。
---

# unibest 抖音小程序开发技能指南

本指南基于 unibest 框架，重点梳理开发抖音小程序所需的核心技能点、规范及最佳实践。

## 1. 核心技术栈掌握
- **Runtime**: [Vue 3](https://vuejs.org/) (Composition API + `<script setup>`)
- **Framework**: [uni-app](https://uniapp.dcloud.net.cn/) (跨平台框架)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (全量类型安全)
- **Build Tool**: [Vite 5](https://vitejs.dev/) (极速构建)
- **Styling**: [UnoCSS](https://unocss.dev/) (原子化 CSS)
- **State Management**: [Pinia](https://pinia.vuejs.org/) (状态管理 + 持久化)

## 2. 工程化配置技能
### 环境管理
- **多环境配置**: 熟练使用 `.env.development` 和 `.env.production` 管理 `VITE_SERVER_BASEURL` 等环境变量。
- **Manifest 配置**: 通过 `manifest.config.ts` 动态配置各平台的 AppID 和权限，替代传统的 `manifest.json` 修改。

### 路由与页面
- **约定式路由**: 理解 `src/pages` 目录结构即路由规则。
- **definePage 宏**: 掌握在 `.vue` 文件中使用 `definePage` 定义页面标题、导航栏样式及各种平台特有配置（如 `enablePullDownRefresh`）。
- **Pages 配置**: 使用 `pages.config.ts` 配置全局 TabBar 和 easycom 组件自动引入规则。

## 3. 抖音小程序开发专项
### 编译与调试
- **命令**: 熟练使用 `pnpm dev:mp-toutiao` 启动开发服务器。
- **工具**: 结合抖音开发者工具进行真机调试和预览。

### 平台差异适配
- **API 命名空间**: 理解 uni-app 自动将 `uni.*` 映射为 `tt.*`，但在特定场景下需注意 `tt` 命名空间的特有 API。
- **条件编译**: 熟练使用 `<!-- #ifdef MP-TOUTIAO -->` 和 `// #ifdef MP-TOUTIAO` 处理抖音端特有的模板和逻辑。
- **样式兼容**: 抖音小程序对部分 CSS 选择器支持有限，开发时应优先使用 UnoCSS 原子类，避免复杂的后代选择器。

## 4. UI 开发体系
### UnoCSS 原子化实践
- **基本用法**: 掌握 `flex`, `text-center`, `m-4`, `text-primary` 等常用原子类。
- **图标方案**: 使用 `i-carbon-xxx` 或自定义 `i-my-icons-xxx` (基于 `src/static/my-icons`) 引入 SVG 图标。
- **安全区适配**: 使用 `pt-safe`, `pb-safe` 适配刘海屏和底部手势区。

### 组件库集成
- **uView Pro**: 熟悉 `u-` 开头的组件使用（Button, Toast, MessageBox 等）。
- **z-paging**: 掌握使用 `z-paging` 实现高性能的下拉刷新和上拉加载列表。
- **组件规范**: 全局组件置于 `src/components`，页面级组件置于 `src/pages/xxx/components`，并遵循 PascalCase 命名。

## 5. 逻辑开发规范
### 网络请求
- **请求封装**: 熟练使用 `src/http/http.ts` 中的 `http.get/post`。
- **双 Token 机制**: 理解并维护 `accessToken` 和 `refreshToken` 的无感刷新逻辑。
- **类型定义**: 为所有 API 响应数据定义 TypeScript 接口 (`interface`)，杜绝 `any`。

### 状态管理
- **Store 定义**: 使用 `defineStore` 创建模块化的 Store（如 `user`, `token`）。
- **持久化**: 利用 `pinia-plugin-persistedstate` 实现数据的自动本地存储。

## 6. 开发流程与规范
- **Git 规范**: 遵循团队的 Commit Message 规范。
- **Linting**: 提交前确保通过 `ESLint` 检查，保持代码风格统一。
- **资源管理**: 静态资源分类存放于 `src/static`，避免引用过大的本地图片，尽量使用 CDN。