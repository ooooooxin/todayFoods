import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * 补丁插件：为 Vue 3.4 添加 isInSSRComponentSetup 导出
 * 解决 uni-app 405+ 版本使用 Vue 3.5 API 但项目使用 Vue 3.4 的兼容问题
 *
 * 原理：直接修改 node_modules 中 @dcloudio/uni-app 的 dist 文件，
 * 将 isInSSRComponentSetup 替换为 false
 */
export function vueSSRPatchPlugin(): Plugin {
  const patchedFiles: string[] = []

  function patchFile(filePath: string): boolean {
    if (!fs.existsSync(filePath))
      return false

    try {
      let content = fs.readFileSync(filePath, 'utf-8')

      // 检查是否需要补丁
      if (!content.includes('isInSSRComponentSetup'))
        return false

      // 替换 import 语句 - 使用字符串操作避免正则回溯问题
      // 原始: import { shallowRef, ref, getCurrentInstance, isInSSRComponentSetup, injectHook } from 'vue';
      // 目标: import { shallowRef, ref, getCurrentInstance, injectHook } from 'vue';
      content = content.replace(
        /import\s*\{[^{}]*isInSSRComponentSetup[^{}]*\}\s*from\s*['"]vue['"]/g,
        (match) => {
          // 提取大括号内的内容
          const innerMatch = match.match(/\{([^{}]*)\}/)
          if (!innerMatch)
            return match

          let inner = innerMatch[1]
          // 移除 isInSSRComponentSetup 及其前后的逗号和空格
          inner = inner.replace(/,\s*isInSSRComponentSetup\s*,/g, ',')
          inner = inner.replace(/isInSSRComponentSetup\s*,/g, '')
          inner = inner.replace(/,\s*isInSSRComponentSetup/g, '')
          inner = inner.replace(/isInSSRComponentSetup/g, '')
          inner = inner.trim()

          return `import { ${inner} } from 'vue'`
        },
      )

      // 替换所有使用 isInSSRComponentSetup 的地方为 false
      content = content.replace(/isInSSRComponentSetup/g, 'false')

      // 写回文件
      fs.writeFileSync(filePath, content, 'utf-8')
      console.log(`[vue-ssr-patch] Patched: ${filePath}`)
      return true
    }
    catch (err) {
      console.error(`[vue-ssr-patch] Failed to patch ${filePath}:`, err)
      return false
    }
  }

  return {
    name: 'vue-ssr-patch',
    enforce: 'pre',
    buildStart() {
      // 查找所有可能的 @dcloudio/uni-app dist 文件路径
      const searchPaths = [
        // 标准路径
        path.resolve(process.cwd(), 'node_modules/@dcloudio/uni-app/dist/uni-app.es.js'),
        // pnpm 缓存路径模式
        path.resolve(process.cwd(), 'node_modules/.pnpm'),
      ]

      // 首先尝试标准路径
      if (patchFile(searchPaths[0])) {
        patchedFiles.push(searchPaths[0])
      }

      // 然后递归查找 pnpm 缓存目录
      const pnpmPath = searchPaths[1]
      if (fs.existsSync(pnpmPath)) {
        const findAndPatch = (dir: string) => {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true })
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name)
              if (entry.isDirectory()) {
                // 检查是否是 uni-app 目录
                if (entry.name.includes('@dcloudio+uni-app@')) {
                  const distPath = path.join(fullPath, 'node_modules/@dcloudio/uni-app/dist/uni-app.es.js')
                  if (patchFile(distPath)) {
                    patchedFiles.push(distPath)
                  }
                }
                // 继续递归，但限制深度
                if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                  findAndPatch(fullPath)
                }
              }
            }
          }
          catch (err) {
            // 忽略读取错误
          }
        }
        findAndPatch(pnpmPath)
      }

      if (patchedFiles.length === 0) {
        console.log('[vue-ssr-patch] No files needed patching')
      }
      else {
        console.log(`[vue-ssr-patch] Total patched: ${patchedFiles.length} files`)
      }
    },
  }
}

export default vueSSRPatchPlugin
