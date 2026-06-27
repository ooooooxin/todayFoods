/* eslint-disable import/no-mutable-exports */
/**
 * 系统信息工具模块
 * 提供屏幕尺寸、安全区域、状态栏、导航栏等相关信息
 */

// 屏幕信息对象（包含屏幕高度、宽度等）
let systemInfo
// 安全区域边距（单位：px）
let safeAreaInsets

// #ifdef MP-WEIXIN || MP-ALIPAY
// 微信/支付宝小程序使用新的 window API
systemInfo = uni.getWindowInfo()
safeAreaInsets = systemInfo.safeArea
  ? {
      top: systemInfo.safeArea.top,
      right: systemInfo.windowWidth - systemInfo.safeArea.right,
      bottom: systemInfo.windowHeight - systemInfo.safeArea.bottom,
      left: systemInfo.safeArea.left,
    }
  : null
// #endif

// #ifndef MP-WEIXIN || MP-ALIPAY
// 其他平台继续使用uni API
systemInfo = uni.getSystemInfoSync()
safeAreaInsets = systemInfo.safeAreaInsets
// #endif

// 获取胶囊按钮位置信息（用于计算自定义导航栏高度）
// H5 等非小程序平台没有胶囊按钮，提供兜底数据避免调用报错
let menuButtonInfo: UniApp.GetMenuButtonBoundingClientRectRes
// #ifndef  H5
menuButtonInfo = uni.getMenuButtonBoundingClientRect()
// #endif
// #ifdef H5
/**
 * H5 兜底：模拟胶囊按钮高度 32px、顶部内边距 6px，使下游基于胶囊的居中 / 高度计算能正常工作。
 * 这样 navBarHeight = (top - statusBarHeight) + height + 7 = 6 + 32 + 7 = 45，与常见 H5 导航栏一致。
 */
const H5_FAKE_MENU_TOP_OFFSET = 6
const H5_FAKE_MENU_HEIGHT = 32
menuButtonInfo = {
  bottom: (systemInfo.statusBarHeight || 0) + H5_FAKE_MENU_TOP_OFFSET + H5_FAKE_MENU_HEIGHT,
  height: H5_FAKE_MENU_HEIGHT,
  left: 0,
  right: 0,
  top: (systemInfo.statusBarHeight || 0) + H5_FAKE_MENU_TOP_OFFSET,
  width: 0,
}
// #endif

/**
 * 导航栏高度（单位：px）
 * 计算公式: 胶囊顶部 - 状态栏高度 + 胶囊高度 + 7(间隔)
 * 包含内容区域和胶囊按钮的垂直间距
 */
const navBarHeight = (menuButtonInfo.top - (systemInfo.statusBarHeight || 0)) + menuButtonInfo.height + 7

/**
 * 状态栏 + 导航栏总高度（单位：px）
 * 包含状态栏高度和自定义导航栏高度
 * 用于页面顶部占位或计算内容区域高度
 */
const statusNavTotalHeight = (systemInfo.statusBarHeight || 0) + navBarHeight

// 打印日志用于调试
// systemInfo 属性说明（以微信小程序为例）：
// - pixelRatio: 屏幕像素比
// - safeArea: 安全区域（包含 top、left、right、bottom、width、height）
// - safeAreaInsets: 安全区域边距（包含 top、right、bottom、left）
// - screenHeight: 屏幕高度（包含状态栏和导航栏）
// - screenTop: 屏幕顶部到内容区域顶部的距离
// - screenWidth: 屏幕宽度
// - statusBarHeight: 状态栏高度
// - windowBottom: 窗口底部到安全区域底部的距离
// - windowHeight: 窗口高度（不包含导航栏，可用于页面内容区域）
// - windowTop: 窗口顶部到安全区域顶部的距离
// - windowWidth: 窗口宽度
console.log('systemInfo', systemInfo, statusNavTotalHeight)

/**
 * 计算内容区域高度（单位：px）
 * @param extraHeight - 额外的顶部高度（可选），如搜索栏高度等，用于从内容区域中减去
 * @returns 内容区域高度
 *
 * 计算公式: windowHeight - statusNavTotalHeight - extraHeight
 * - windowHeight: 窗口高度（不包含导航栏高度）
 * - statusNavTotalHeight: 状态栏+导航栏总高度
 * - extraHeight: 额外的顶部高度（可选参数）
 *
 * @example
 * // 不需要额外减去的高度
 * const height = useContentAreaHeight()
 *
 * // 需要减去搜索栏高度（50px）
 * const height = useContentAreaHeight(50)
 */
function useContentAreaHeight(extraHeight: number = 0): number {
  const height = systemInfo.safeArea?.height
  return height - statusNavTotalHeight - extraHeight
}

/**
 * 导出系统信息
 * @property systemInfo - 屏幕信息对象
 *   - windowHeight: 窗口高度（不包含导航栏高度，用于计算内容区域）
 *   - windowWidth: 窗口宽度
 *   - screenHeight: 屏幕高度（包含状态栏和导航栏）
 *   - screenWidth: 屏幕宽度
 *   - statusBarHeight: 状态栏高度
 * @property safeAreaInsets - 安全区域边距（单位：px）
 *   - top: 顶部安全区域边距（状态栏高度）
 *   - right: 右侧安全区域边距
 *   - bottom: 底部安全区域边距
 *   - left: 左侧安全区域边距
 * @property statusNavTotalHeight - 状态栏+导航栏总高度（单位：px）
 *   用于页面顶部占位或计算内容区域高度
 * @property useContentAreaHeight - 计算内容区域高度的函数
 *   @param extraHeight - 额外的顶部高度（可选）
 *   @returns 内容区域高度
 */
export { menuButtonInfo, safeAreaInsets, statusNavTotalHeight, systemInfo, useContentAreaHeight }
