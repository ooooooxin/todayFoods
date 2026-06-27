import { sha256 } from 'js-sha256'

export interface ConsumptionSignParams {
  contentId: number | string
  entityType: number
  event: string
  sessionId: string
  timestamp: number
}

/** 读取签名密钥（env 勿使用引号，格式：VITE_CONSUMPTION_SIGN_SECRET=xxx） */
export function getConsumptionSignSecret(): string {
  const raw = import.meta.env.VITE_CONSUMPTION_SIGN_SECRET ?? ''
  return raw.trim().replace(/^['"]|['"]$/g, '')
}

/**
 * 构建消费上报签名字符串并计算 SHA-256（小写十六进制）
 * 参数按字典序：contentId, entityType, event, nonce, sessionId, timestamp
 */
export function buildConsumptionSignature(params: ConsumptionSignParams): string | null {
  const secret = getConsumptionSignSecret()
  if (!secret) {
    console.error('[consumption] VITE_CONSUMPTION_SIGN_SECRET 未配置，无法生成 x-signature，请检查 env/.env 后重启 dev')
    return null
  }

  const timestamp = String(params.timestamp)
  const signStr = [
    `contentId=${params.contentId}`,
    `entityType=${params.entityType}`,
    `event=${params.event}`,
    `nonce=${timestamp}`,
    `sessionId=${params.sessionId}`,
    `timestamp=${timestamp}`,
    `key=${secret}`,
  ].join('&')
  return sha256(signStr)
}
