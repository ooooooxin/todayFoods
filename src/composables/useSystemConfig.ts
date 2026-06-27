import type { SystemConfig } from '@/api/common'
/**
 * 系统配置 composable
 * 抓取并缓存系统配置 (privacyPolicyUrl / userAgreementUrl 等)
 */
import { ref } from 'vue'
import { getSystemConfig } from '@/api/common'

const cachedConfig = ref<SystemConfig | null>(null)
let fetchPromise: Promise<SystemConfig> | null = null

export function useSystemConfig() {
  async function ensureConfig(): Promise<SystemConfig | null> {
    if (cachedConfig.value)
      return cachedConfig.value
    if (!fetchPromise) {
      fetchPromise = getSystemConfig().then((res) => {
        cachedConfig.value = res
        fetchPromise = null
        return res
      }).catch(() => {
        fetchPromise = null
        return null as any
      })
    }
    return fetchPromise
  }

  /**
   * 跳转到协议 webview
   * @param type 'service' | 'privacy' | 'minor' | 'creator'
   */
  async function navToAgreement(type: 'service' | 'privacy' | 'minor' | 'creator') {
    const config = await ensureConfig()
    let url = ''
    let title = ''
    if (type === 'service') {
      url = config?.userAgreementUrl || ''
      title = '用户服务协议'
    }
    else if (type === 'privacy') {
      url = config?.privacyPolicyUrl || ''
      title = '隐私政策'
    }
    else if (type === 'minor') {
      url = config?.minorsPersonalInfoProtectionUrl || ''
      title = '未成年人个人信息保护规则'
    }
    else if (type === 'creator') {
      // url = config?.creatorServiceAgreementUrl || ''
      url = 'https://apph5.yq0101.com/#/pages/creatorServiceAgreement/index'
      title = '创作者服务协议'
    }

    if (!url) {
      return
    }
    uni.navigateTo({
      url: `/pages/settings/webview?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
    })
  }

  return {
    config: cachedConfig,
    ensureConfig,
    navToAgreement,
  }
}
