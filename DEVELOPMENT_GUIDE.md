# unibest 项目开发文档

这是一个基于 **unibest** 框架的项目，集成了 **uni-app + Vue3 + TypeScript + Vite5 + UnoCSS**。本文档旨在帮助团队成员快速熟悉项目架构并上手开发。

## 目录
1. [项目配置说明](#1-项目配置说明)
2. [页面架构体系](#2-页面架构体系)
3. [开发方法论](#3-开发方法论)
4. [UI组件体系](#4-ui组件体系)
5. [多端编译部署](#5-多端编译部署)
6. [补充开发要点](#6-补充开发要点)

---

## 1. 项目配置说明

### 1.1 接口配置
项目对 `uni.request` 进行了二次封装，支持拦截器、Token 自动刷新等功能。

*   **BaseURL 配置**：
    *   配置文件：`env/.env.development` (开发) 和 `env/.env.production` (生产)。
    *   变量名：`VITE_SERVER_BASEURL`。
    *   示例：`VITE_SERVER_BASEURL = 'https://dev.xxx.com'`。

*   **请求封装**：
    *   核心文件：`src/http/http.ts`。
    *   **使用方式**：
        ```typescript
        // src/api/login.ts
        import { http } from '@/http/http'

        export function login(data) {
          return http.post<ResType>('/auth/login', data)
        }
        ```
    *   **特性**：
        *   自动携带 Token。
        *   **双 Token 无感刷新**：检测到 401 错误时，自动使用 `refreshToken` 刷新 access token 并重试请求（详见 `src/http/http.ts`）。
        *   全局错误提示（Toast）。

### 1.2 环境配置
通过 `.env` 文件区分环境，Vite 会自动加载。

| 环境 | 配置文件 | 启动命令 | 说明 |
| :--- | :--- | :--- | :--- |
| **开发** | `.env.development` | `pnpm dev:xxx` | 开启 Sourcemap，保留 Console |
| **生产** | `.env.production` | `pnpm build:xxx` | 压缩代码，去除 Console |

**关键环境变量**：
*   `VITE_APP_TITLE`: 应用标题。
*   `VITE_DELETE_CONSOLE`: 是否移除 console (生产环境默认为 true)。
*   `VITE_APP_PROXY_ENABLE`: H5 是否开启代理。

### 1.3 路由配置
项目使用 **文件系统路由** + **pages.config.ts** 结合的方式。

*   **路由定义**：
    *   页面文件位于 `src/pages/` 目录下。
    *   使用 `definePage` 宏在页面组件内配置路由元信息（无需手动修改 `pages.json`）。
    *   **示例** (`src/pages/index/index.vue`)：
        ```typescript
        <script lang="ts" setup>
        definePage({
          type: 'home', // 设置为首页
          style: {
            navigationStyle: 'custom',
            navigationBarTitleText: '首页',
          },
        })
        </script>
        ```

*   **全局配置**：
    *   文件：`pages.config.ts`。
    *   配置 TabBar、easycom 组件自动引入规则等。

### 1.4 第三方服务
*   **配置位置**：`manifest.config.ts`。
*   **SDK 集成**：通过环境变量注入 AppID（如 `VITE_WX_APPID`），在 `manifest.config.ts` 中动态读取。

---

## 2. 页面架构体系

### 2.1 页面创建规范
1.  **新建文件**：在 `src/pages/` 下创建目录和 `vue` 文件，例如 `src/pages/demo/index.vue`。
2.  **配置路由**：在 `.vue` 文件顶部使用 `definePage` 配置标题等。
3.  **组件结构**：
    ```vue
    <script lang="ts" setup>
    // 1. 导入工具/组件
    // 2. definePage 配置
    // 3. 逻辑代码
    </script>

    <template>
      <view class="page-container">
        <!-- 4. 布局内容 -->
      </view>
    </template>

    <style lang="scss" scoped>
    // 5. 样式（推荐优先使用 UnoCSS）
    </style>
    ```

### 2.2 页面类型
*   **主要页面**：位于 `src/pages/`，通常对应 TabBar 页面或核心业务流。
*   **布局 Layout**：位于 `src/layouts/`，例如 `default.vue`，可封装通用的导航栏或底部。

### 2.3 生命周期
*   **Vue 生命周期**：`onMounted`, `onUnmounted` 等。
*   **UniApp 生命周期**：
    *   `onLoad(options)`: 页面加载，获取参数。
    *   `onShow()`: 页面显示。
    *   `onPullDownRefresh()`: 下拉刷新（需在 `definePage` style 中开启 `enablePullDownRefresh`）。

---

## 3. 开发方法论

### 3.1 代码规范
*   **工具链**：ESLint + Prettier + TypeScript。
*   **命令**：运行 `pnpm lint` 检查代码，`pnpm lint:fix` 自动修复。
*   **风格**：
    *   使用 Composition API (`<script setup>`)。
    *   全量 TypeScript 类型定义（API 响应需定义 Interface）。

### 3.2 状态管理 (Pinia)
*   **位置**：`src/store/`。
*   **持久化**：已集成 `pinia-plugin-persistedstate`，配置 `persist: true` 即可自动缓存到 Storage。
*   **示例** (`src/store/user.ts`)：
    ```typescript
    export const useUserStore = defineStore('user', () => {
      const userInfo = ref({ ... })
      // ...actions
      return { userInfo }
    }, { persist: true })
    ```

### 3.3 性能优化
*   **分包策略**：Vite 插件 `UniOptimization` 已配置，自动处理分包优化。
*   **按需引入**：UI 组件库（uView Pro）和图标均配置了自动按需引入。
### 3.4 异常监控
*   **API 异常**：`http.ts` 拦截器统一处理网络错误和业务错误码。
*   **Token 过期**：自动拦截 401 跳转登录页或刷新 Token。

---

## 4. UI 组件体系

### 4.1 基础组件库
项目集成了 **uView Pro** 和 **z-paging**。

*   **uView Pro**：
    *   前缀：`u-`（如 `<u-button>`）。
    *   文档：参考 uView Pro 官方文档。
*   **z-paging**：
    *   用途：下拉刷新、上拉加载更多、分页逻辑封装。
    *   标签：`<z-paging>`。

### 4.2 UnoCSS 原子化样式
*   **配置**：`uno.config.ts`。
*   **特性**：
    *   **预设**：`presetUni` (兼容小程序)。
    *   **图标**：支持 `i-carbon-xxx` 图标集，及本地 SVG (`src/static/my-icons/*.svg`)。
    *   **本地图标使用**：`<view class="i-my-icons-logo" />` (对应 `my-icons` 集合下的 `logo.svg`)。
    *   **主题色**：`text-primary` (对应配置中的 primary 颜色)。

### 4.3 平台适配
*   **样式兼容**：`presetLegacyCompat` 处理了低版本安卓的颜色函数兼容性。
*   **安全区**：使用 `pt-safe`, `pb-safe` 类名适配刘海屏和底部黑条。

---

## 5. 多端编译部署

### 5.1 微信小程序
*   **编译命令**：
    *   开发：`pnpm dev:mp-weixin`
    *   生产：`pnpm build:mp-weixin`
*   **产物目录**：`dist/dev/mp-weixin` 或 `dist/build/mp-weixin`。
*   **发布流程**：
    1.  运行生产编译命令。
    2.  打开 **微信开发者工具**。
    3.  导入生成的产物目录。
    4.  测试无误后，点击工具栏的“上传”按钮。
    5.  在微信公众平台进行版本管理和提交审核。

### 5.2 抖音小程序
*   **编译命令**：
    *   开发：`pnpm dev:mp-toutiao`
    *   生产：`pnpm build:mp-toutiao`
*   **平台差异处理**：
    *   命名空间：uni-app 统一使用 `uni` 对象（如 `uni.login`），框架会自动转译为 `tt.login`。
    *   样式差异：注意抖音小程序对部分 CSS 选择器的支持情况，尽量使用 UnoCSS 原子类。
    *   条件编译：
        ```html
        <!-- #ifdef MP-TOUTIAO -->
        <view>抖音小程序特有内容</view>
        <!-- #endif -->
        ```
*   **性能优化**：
    *   避免频繁的 `setData`（Vue 层面即响应式更新）。
    *   控制包体积，利用分包加载。
*   **发布流程**：
    1.  运行生产编译命令 `pnpm build:mp-toutiao`。
    2.  下载并打开 **抖音开发者工具**。
    3.  导入 `dist/build/mp-toutiao` 目录。
    4.  进行真机调试预览。
    5.  上传代码并在抖音开放平台提交审核。

### 5.3 H5 端
*   **编译命令**：
    *   开发：`pnpm dev:h5`
    *   生产：`pnpm build:h5`
*   **代理配置**：在 `.env` 中设置 `VITE_APP_PROXY_ENABLE = true` 解决开发环境跨域问题。
*   **SEO 优化**：H5 默认为 SPA 应用，SEO 较弱。如需优化，可考虑 SSR 配置（`pnpm build:h5:ssr`，需服务端配合）。

### 5.4 App 端
*   **编译命令**：
    *   基座调试：`pnpm dev:app`
    *   资源打包：`pnpm build:app`
*   **配置**：`manifest.config.ts` 中的 `app-plus` 字段配置权限、图标和启动图。

---

## 6. 补充开发要点

### 6.1 本地开发调试
*   **VS Code 插件**：推荐安装 `Vue - Official`, `UnoCSS`, `Uni-app Snippets`。
*   **调试工具**：
    *   H5：浏览器 DevTools。
    *   小程序：对应平台的开发者工具。
    *   App：连接真机或模拟器。

### 6.2 常见问题
*   **依赖安装失败**：请确保 node 版本 >= 20，并使用 `pnpm`。
*   **UnoCSS 不生效**：检查是否在类名中使用了动态字符串拼接（原子化引擎无法静态分析动态类名）。
*   **新建页面 404**：检查是否在 `.vue` 文件中正确书写了 `definePage`，或尝试重启开发服务。

### 6.3 目录结构速查
```
src/
├── api/             # API 接口定义
├── components/      # 全局组件
├── http/            # 请求封装
├── pages/           # 页面 (文件即路由)
├── static/          # 静态资源 (图片、图标)
├── store/           # Pinia 状态管理
├── utils/           # 工具函数
├── App.vue          # 根组件
├── main.ts          # 入口文件
└── uni.scss         # 全局 SCSS 变量
```
