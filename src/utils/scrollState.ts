export interface CalcScrollInput {
  searchTopPx: number
  scrollTopPx: number
  rpxToPx: number
}

export interface CalcScrollOutput {
  alpha: number
  isSticky: boolean
}

export function calcScrollState({
  searchTopPx,
  scrollTopPx,
  rpxToPx,
}: CalcScrollInput): CalcScrollOutput {
  const dPx = searchTopPx - scrollTopPx
  const dRpx = dPx / (rpxToPx || 1)
  if (dRpx <= 0) {
    return { alpha: 1, isSticky: true }
  }
  if (dRpx <= 100) {
    return { alpha: 1 - dRpx / 100, isSticky: false }
  }
  return { alpha: 0, isSticky: false }
}
