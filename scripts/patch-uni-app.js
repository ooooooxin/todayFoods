const fs = require('node:fs')
const path = require('node:path')

/**
 * 补丁脚本：为所有 @dcloudio/uni-app 的 dist 文件添加兼容性补丁
 * 解决 uni-app 405+ 版本使用 Vue 3.5 API 但项目使用 Vue 3.4 的兼容问题
 */

function patchFile(filePath) {
  if (!fs.existsSync(filePath))
    return false

  try {
    let content = fs.readFileSync(filePath, 'utf-8')

    // 检查是否需要补丁
    if (!content.includes('isInSSRComponentSetup'))
      return false

    // 替换 import 语句
    // 原始: import { shallowRef, ref, getCurrentInstance, isInSSRComponentSetup, injectHook } from 'vue';
    // 目标: import { shallowRef, ref, getCurrentInstance, injectHook } from 'vue';
    content = content.replace(
      /import\s*\{\s*([^,]*,\s*)*isInSSRComponentSetup\s*(?:,\s*)?([^}]*)\}\s*from\s*['"]vue['"]/g,
      (match, before, after) => {
        // 清理前后的逗号和空格
        const cleanBefore = before ? before.replace(/,\s*$/, '').trim() : ''
        const cleanAfter = after ? after.replace(/^\s*,/, '').trim() : ''

        if (cleanBefore && cleanAfter) {
          return `import { ${cleanBefore}, ${cleanAfter} } from 'vue'`
        }
        else if (cleanBefore) {
          return `import { ${cleanBefore} } from 'vue'`
        }
        else if (cleanAfter) {
          return `import { ${cleanAfter} } from 'vue'`
        }
        return `import { } from 'vue'`
      },
    )

    // 替换所有使用 isInSSRComponentSetup 的地方为 false
    content = content.replace(/isInSSRComponentSetup/g, 'false')

    // 写回文件
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log(`[patch-uni-app] Patched: ${filePath}`)
    return true
  }
  catch (err) {
    console.error(`[patch-uni-app] Failed to patch ${filePath}:`, err)
    return false
  }
}

function findAndPatch(dir) {
  let patchedCount = 0

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // 检查是否是 uni-app 目录
        if (entry.name.includes('@dcloudio+uni-app@')) {
          const distPath = path.join(fullPath, 'node_modules/@dcloudio/uni-app/dist/uni-app.es.js')
          if (patchFile(distPath)) {
            patchedCount++
          }
        }
        // 继续递归，但限制深度
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          patchedCount += findAndPatch(fullPath)
        }
      }
    }
  }
  catch (err) {
    // 忽略读取错误
  }

  return patchedCount
}

// 主逻辑
const cwd = process.cwd()
const pnpmPath = path.join(cwd, 'node_modules/.pnpm')

let totalPatched = 0

// 首先尝试标准路径
const standardPath = path.join(cwd, 'node_modules/@dcloudio/uni-app/dist/uni-app.es.js')
if (patchFile(standardPath)) {
  totalPatched++
}

// 然后递归查找 pnpm 缓存目录
if (fs.existsSync(pnpmPath)) {
  totalPatched += findAndPatch(pnpmPath)
}

if (totalPatched === 0) {
  console.log('[patch-uni-app] No files needed patching')
}
else {
  console.log(`[patch-uni-app] Total patched: ${totalPatched} files`)
}
