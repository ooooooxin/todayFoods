<script lang="ts" setup>
import { onHide, onLoad, onReady, onShareAppMessage } from '@dcloudio/uni-app'
import { nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '史莱姆解压捏捏乐',
  },
})

// === 状态定义 ===
const activeTab = ref<'material' | 'color' | 'addins' | 'save' | 'shelf'>('material')
const prevTab = ref<'material' | 'color' | 'addins' | 'save' | 'shelf'>('material')
const currentMode = ref<'play' | 'shelf'>('play') // play: 捏史莱姆, shelf: 陈列柜
const volume = ref(0.5)
const isMuted = ref(false)
const isPanelCollapsed = ref(false)

watch(isPanelCollapsed, () => {
  nextTick(() => {
    handleResize()
  })
})

// 材质属性定义
interface SlimeMaterial {
  id: string
  name: string
  desc: string
  friction: number // 阻尼，越大越厚实粘滞
  springForce: number // 粒子间吸引强度，越大回弹越快
  bubbleProb: number // 揉捏时产生气泡的概率
  baseColor: string // 默认颜色 A
  mixColor: string // 默认颜色 B
  maxDist: number // 拉扯最大断裂距离
  soundPitch: number // 声音音调偏置
  specularPower: number // 高光硬度/聚集度
  specularIntensity: number // 高光强度
  rimIntensity: number // 边缘发光强度
  rimColor: number[] // 边缘发光颜色 [r, g, b]
  transparency: number // 透明度下限
}

const materials: SlimeMaterial[] = [
  {
    id: 'water',
    name: '水弹史莱姆',
    desc: '水灵清脆・高回弹流动性强',
    friction: 0.18,
    springForce: 0.15,
    bubbleProb: 0.02,
    baseColor: '#00d2ff',
    mixColor: '#00f2fe',
    maxDist: 160,
    soundPitch: 1.2,
    specularPower: 55.0,
    specularIntensity: 0.85,
    rimIntensity: 0.55,
    rimColor: [0.25, 0.85, 1.0],
    transparency: 0.38,
  },
  {
    id: 'bubble',
    name: '绵密起泡胶',
    desc: '奶油质感・越捏越蓬松多气泡',
    friction: 0.32,
    springForce: 0.10,
    bubbleProb: 0.15,
    baseColor: '#ff9a9e',
    mixColor: '#fecfef',
    maxDist: 190,
    soundPitch: 1.0,
    specularPower: 12.0,
    specularIntensity: 0.32,
    rimIntensity: 0.28,
    rimColor: [1.0, 0.8, 0.92],
    transparency: 0.83,
  },
  {
    id: 'clay',
    name: '厚实牛头胶',
    desc: '厚重韧性・拉伸阻力感极强',
    friction: 0.48,
    springForce: 0.06,
    bubbleProb: 0.05,
    baseColor: '#11998e',
    mixColor: '#38ef7d',
    maxDist: 220,
    soundPitch: 0.7,
    specularPower: 22.0,
    specularIntensity: 0.58,
    rimIntensity: 0.42,
    rimColor: [0.2, 0.95, 0.45],
    transparency: 0.65,
  },
]

const currentMaterial = ref<SlimeMaterial>(materials[0])

// 调色盘定义
const colorA = ref('#00d2ff')
const colorB = ref('#00f2fe')

// 可选的主色和辅色预设列表
const presetColors = [
  '#00d2ff',
  '#00f2fe',
  '#ff9a9e',
  '#fecfef',
  '#11998e',
  '#38ef7d',
  '#ff0844',
  '#ffb199',
  '#f12711',
  '#f5af19',
  '#b224ef',
  '#7579ff',
  '#ff007f',
  '#aa00ff',
  '#00e5ff',
  '#00ff88',
  '#ffff00',
  '#ff5500',
  '#ffffff',
  '#333333',
]

// 配件定义
interface AddIn {
  id: string
  name: string
  icon: string
  scale: number
  color: string
  locked: boolean
}

const addins = ref<AddIn[]>([
  { id: 'star', name: '五角星', icon: '★', scale: 1.0, color: '#ffd700', locked: false },
  { id: 'heart', name: '爱心亮片', icon: '♥', scale: 0.9, color: '#ff2a6d', locked: false },
  { id: 'glitter', name: '金葱粉', icon: '✨', scale: 0.6, color: '#ffffff', locked: false },
  { id: 'strawberry', name: '草莓切片', icon: '🍓', scale: 1.2, color: '#ff4b4b', locked: false },
  { id: 'lemon', name: '柠檬切片', icon: '🍋', scale: 1.2, color: '#ffeb3b', locked: false },
  { id: 'lime', name: '青柠切片', icon: '🍋', scale: 1.2, color: '#38ef7d', locked: true },
])

const activeAddins = ref<string[]>(['star', 'glitter', 'strawberry', 'lemon']) // 当前撒入的配件列表

// 情绪值进度 (0 - 100)
const stressRelief = ref(0)
const isRelieved = ref(false)

// 粒子类型定义
interface SlimeParticle {
  x: number
  y: number
  vx: number
  vy: number
  ox: number // 初始偏移中心 x
  oy: number // 初始偏移中心 y
  origOx: number // 原始固定的偏移中心 x (用于塑性后缓慢回弹)
  origOy: number // 原始固定的偏移中心 y (用于塑性后缓慢回弹)
  r: number // 红色通道值
  g: number // 绿色通道值
  b: number // 蓝色通道值
  color: string
  radius: number
  type: 'fluid' | 'bubble'
  popped: boolean
}

// 亮片/配件在 Canvas 里的实例
interface DecorationInstance {
  type: string
  icon: string
  color: string
  scale: number
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  targetParticleIdx: number // 绑定的粒子索引
  offsetD: number // 与粒子的相对距离
  offsetA: number // 相对角度
}

// 气泡破裂时顶层 Canvas 喷射的粒子
interface PopSplashParticle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  radius: number
  alpha: number
  life: number // 寿命
}

// 保存的史莱姆存档结构
interface SlimeArchive {
  id: string
  name: string
  materialId: string
  colorA: string
  colorB: string
  addins: string[]
  createdAt: string
}

const slimeArchives = ref<SlimeArchive[]>([])
const newSlimeName = ref('')
const showSavePopup = ref(false)
const showAdsPopup = ref(false)
const adCountdown = ref(3)
const adTargetAddin = ref<AddIn | null>(null)

// === Canvas 及物理引擎变量 ===
const useWebGL = ref(true)
let canvasWidth = 375
let canvasHeight = 450
let slimeCanvas: any = null
let slime2dCanvas: any = null
let slime2dCtx: CanvasRenderingContext2D | null = null
let decCanvas: any = null
let decCtx: CanvasRenderingContext2D | null = null
let dpr = 1
let canvasRect: any = null

let gl: WebGLRenderingContext | null = null
let glProgram: WebGLProgram | null = null
let uResolutionLoc: WebGLUniformLocation | null = null
const uParticlesLoc: WebGLUniformLocation[] = []
const uColorsLoc: WebGLUniformLocation[] = []
let positionBuffer: WebGLBuffer | null = null

let uSpecularPowerLoc: WebGLUniformLocation | null = null
let uSpecularIntensityLoc: WebGLUniformLocation | null = null
let uRimIntensityLoc: WebGLUniformLocation | null = null
let uRimColorLoc: WebGLUniformLocation | null = null
let uTransparencyLoc: WebGLUniformLocation | null = null

let particles: SlimeParticle[] = []
let decInstances: DecorationInstance[] = []
let splashParticles: PopSplashParticle[] = []

const touches = reactive<Array<{ id: number, x: number, y: number, lastX: number, lastY: number, grabParticleIdx: number }>>([])
let centerX = 187.5
let centerY = 225
let isRunning = false
let loopTimer: any = null

// === Web Audio 音频引擎 ===
class ASMRSynth {
  ctx: any = null

  init() {
    if (this.ctx)
      return
    try {
      // #ifdef MP-WEIXIN
      if (uni.createWebAudioContext) {
        this.ctx = uni.createWebAudioContext()
      }
      // #endif
      if (!this.ctx) {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          this.ctx = new AudioCtx()
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume()
      }
    }
    catch (e) {
      console.warn('ASMRSynth audio context initialization failed', e)
    }
  }

  playPop() {
    this.init()
    if (!this.ctx)
      return
    try {
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      const startF = (600 + Math.random() * 200) * currentMaterial.value.soundPitch
      const endF = (60 + Math.random() * 20) * currentMaterial.value.soundPitch

      osc.frequency.setValueAtTime(startF, now)
      osc.frequency.exponentialRampToValueAtTime(endF, now + 0.04)

      const currentVol = isMuted.value ? 0 : volume.value
      gain.gain.setValueAtTime(0.18 * currentVol, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.06)
    }
    catch (e) {}
  }

  playSquish(speed: number) {
    this.init()
    if (!this.ctx)
      return
    try {
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc.type = 'sine'
      const startF = (130 + Math.random() * 30) * currentMaterial.value.soundPitch
      const endF = (50 + Math.random() * 15) * currentMaterial.value.soundPitch

      osc.frequency.setValueAtTime(startF, now)
      osc.frequency.exponentialRampToValueAtTime(endF, now + 0.08)

      const currentVol = isMuted.value ? 0 : volume.value
      const vol = Math.min(0.12, speed * 0.04) * currentVol
      gain.gain.setValueAtTime(vol, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(280, now)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.1)
    }
    catch (e) {}
  }

  playStretch(distRatio: number) {
    this.init()
    if (!this.ctx)
      return
    try {
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      const freq = 180 + distRatio * 150
      osc.frequency.setValueAtTime(freq, now)
      osc.frequency.linearRampToValueAtTime(freq + 60, now + 0.12)

      const currentVol = isMuted.value ? 0 : volume.value
      gain.gain.setValueAtTime(0.015 * currentVol, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.15)
    }
    catch (e) {}
  }
}

const synth = new ASMRSynth()

// === 辅助色彩转换函数 ===
function hexToRgb(hex: string): { r: number, g: number, b: number } {
  hex = hex.replace('#', '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  const num = Number.parseInt(hex, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

// 撒入配件到粒子的辅助函数
function applyAddinToParticles(addinId: string) {
  const addin = addins.value.find(a => a.id === addinId)
  if (!addin)
    return

  const len = particles.length
  if (len === 0)
    return

  // 配件撒入实例数量：金葱粉多生成一些，水果切片/亮片生成 2 个
  const instanceCount = addinId === 'glitter' ? 6 : 2
  for (let k = 0; k < instanceCount; k++) {
    // 随机分配到一个粒子上
    const targetIdx = Math.floor(Math.random() * len)
    const p = particles[targetIdx]

    // 在粒子半径内随机偏移距离和角度
    const offsetD = Math.random() * (p.radius * 0.7)
    const offsetA = Math.random() * Math.PI * 2

    decInstances.push({
      type: addinId,
      icon: addin.icon,
      color: addin.color,
      scale: addin.scale,
      x: p.x + Math.cos(offsetA) * offsetD,
      y: p.y + Math.sin(offsetA) * offsetD,
      vx: 0,
      vy: 0,
      angle: offsetA,
      targetParticleIdx: targetIdx,
      offsetD,
      offsetA,
    })
  }
}

// 按画布实际尺寸缩放史莱姆，避免小屏上粒子过大或坐标错位
function getSlimeScale() {
  const base = Math.min(canvasWidth, canvasHeight)
  return Math.max(0.55, Math.min(1, base / 380))
}

// === 物理引擎核心逻辑 ===
function initPhysics() {
  particles = []
  decInstances = []
  splashParticles = []

  const slimeScale = getSlimeScale()

  // 1. 初始化史莱姆粒子：在屏幕中心生成 24 个粒子形成一团 (优化 Uniform 数量适配移动端 WebGL 寄存器上限)
  const particleCount = 24
  const color1 = hexToRgb(colorA.value)
  const color2 = hexToRgb(colorB.value)

  for (let i = 0; i < particleCount; i++) {
    // 采用紧凑的极坐标分布，使胶体初始处于聚拢稳固态，防止在 2D 降级下因过散而晕染发糊
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * 65 * slimeScale
    const px = centerX + Math.cos(angle) * dist
    const py = centerY + Math.sin(angle) * dist

    // 渐变色彩插值 (配合大形体拓宽采样区域为 220 像素)
    const colorSpan = 220 * slimeScale
    const ratio = (px - (centerX - colorSpan / 2)) / colorSpan
    const clampedRatio = Math.max(0, Math.min(1, ratio))
    const r = Math.round(color1.r + (color2.r - color1.r) * clampedRatio)
    const g = Math.round(color1.g + (color2.g - color1.g) * clampedRatio)
    const b = Math.round(color1.b + (color2.b - color1.b) * clampedRatio)

    // 随机气泡判断：适当调大粒子体积以匹配厚实大史莱姆拟真果冻效果
    const isBubble = Math.random() < currentMaterial.value.bubbleProb
    const radius = isBubble
      ? (22 + Math.random() * 8) * slimeScale
      : (44 + Math.random() * 12) * slimeScale

    particles.push({
      x: px,
      y: py,
      vx: 0,
      vy: 0,
      ox: px - centerX,
      oy: py - centerY,
      origOx: px - centerX,
      origOy: py - centerY,
      r,
      g,
      b,
      color: `rgb(${r},${g},${b})`,
      radius,
      type: isBubble ? 'bubble' : 'fluid',
      popped: false,
    })
  }

  // 2. 重新撒入配件
  activeAddins.value.forEach((addInId) => {
    applyAddinToParticles(addInId)
  })

  // 3. 物理引擎静置预演 (Warm-up)，让粒子平稳软着陆到受力平衡态，消除开局晃动
  for (let i = 0; i < 80; i++) {
    updatePhysicsInternal(true)
  }
}

function updatePhysicsInternal(isWarmup = false) {
  const len = particles.length
  const friction = currentMaterial.value.friction
  const springK = currentMaterial.value.springForce

  // 1. 粒子间相互吸引和排斥力计算
  for (let i = 0; i < len; i++) {
    const p1 = particles[i]
    if (p1.popped)
      continue

    for (let j = i + 1; j < len; j++) {
      const p2 = particles[j]
      if (p2.popped)
        continue

      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001

      if (dist < 180) {
        let force = 0
        const minDistance = p1.type === 'bubble' || p2.type === 'bubble' ? 28 : 46

        // 连续平滑弹簧受力计算 (消除分段不连续引起的晃动抖动)
        const diff = dist - minDistance
        if (diff < 0) {
          // 太近了产生强排斥力，防止穿透
          force = diff * 0.35
        }
        else if (dist < currentMaterial.value.maxDist) {
          // 距离内产生弹性吸引力以保持胶体不散架
          const rawForce = diff * springK * 0.08
          force = Math.min(1.2, Math.max(-1.2, rawForce))
        }

        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        p1.vx += fx
        p1.vy += fy
        p2.vx -= fx
        p2.vy -= fy

        // 色彩碰撞渐变混合
        if (dist < 46) {
          const mixRate = 0.015
          const rMix = (p1.r + p2.r) / 2
          const gMix = (p1.g + p2.g) / 2
          const bMix = (p1.b + p2.b) / 2

          p1.r += (rMix - p1.r) * mixRate
          p1.g += (gMix - p1.g) * mixRate
          p1.b += (bMix - p1.b) * mixRate
          p2.r += (rMix - p2.r) * mixRate
          p2.g += (gMix - p2.g) * mixRate
          p2.b += (bMix - p2.b) * mixRate

          p1.color = `rgb(${Math.round(p1.r)},${Math.round(p1.g)},${Math.round(p1.b)})`
          p2.color = `rgb(${Math.round(p2.r)},${Math.round(p2.g)},${Math.round(p2.b)})`
        }
      }
    }
  }

  // 2. 触摸吸引力与锚定 (预演阶段 warmup 不受手势影响)
  if (!isWarmup) {
    touches.forEach((touch) => {
      // 如果还没锚定粒子，寻找最近的粒子
      if (touch.grabParticleIdx === -1) {
        let nearestIdx = -1
        let minDist = 75
        for (let i = 0; i < len; i++) {
          if (particles[i].popped)
            continue
          const dx = particles[i].x - touch.x
          const dy = particles[i].y - touch.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < minDist) {
            minDist = dist
            nearestIdx = i
          }
        }
        touch.grabParticleIdx = nearestIdx
      }

      // 对抓取的粒子施加位移插值并累积其物理速度
      const idx = touch.grabParticleIdx
      if (idx !== -1 && idx < len) {
        const grabP = particles[idx]
        const oldX = grabP.x
        const oldY = grabP.y

        // 平滑插值跟手（降低跟随比例至 0.35，产生稠密软泥拉扯的手感，不至于生硬）
        grabP.x = grabP.x * 0.65 + touch.x * 0.35
        grabP.y = grabP.y * 0.65 + touch.y * 0.35

        // 根据位移计算出逼真的物理速度，并限制其最大输入能量，避免剧烈高频振荡
        let nvx = grabP.x - oldX
        let nvy = grabP.y - oldY
        const maxGrabSpeed = 6
        const grabSpeed = Math.sqrt(nvx * nvx + nvy * nvy)
        if (grabSpeed > maxGrabSpeed) {
          nvx = (nvx / grabSpeed) * maxGrabSpeed
          nvy = (nvy / grabSpeed) * maxGrabSpeed
        }
        grabP.vx = nvx
        grabP.vy = nvy

        // 滑动时的拉扯声音
        const speed = Math.sqrt((touch.x - touch.lastX) ** 2 + (touch.y - touch.lastY) ** 2)
        if (speed > 1.5) {
          synth.playSquish(speed)
          // 增加情绪值
          stressRelief.value = Math.min(100, stressRelief.value + 0.12)
          if (stressRelief.value >= 100 && !isRelieved.value) {
            triggerRelieved()
          }
        }

        touch.lastX = touch.x
        touch.lastY = touch.y
      }

      // 排斥未抓取的粒子 (Touch Repulsion) - 使用二次平滑衰减，提供温和的凹陷解压感，防止粒子瞬间炸开
      const pushRadius = 80 // 手指压泥排斥半径
      for (let i = 0; i < len; i++) {
        if (i === touch.grabParticleIdx || particles[i].popped)
          continue
        const p = particles[i]
        const dx = p.x - touch.x
        const dy = p.y - touch.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001

        if (dist < pushRadius) {
          const factor = (pushRadius - dist) / pushRadius
          const pushForce = factor * factor * 2.2 // 适中推力
          p.vx += (dx / dist) * pushForce
          p.vy += (dy / dist) * pushForce
        }
      }
    })
  }

  // 3. 形状保持力与坐标更新
  const kCenter = 0.035 * springK // 回复力强度与材质自身的弹性系数挂钩，适当降低避免钢丝拉扯感
  // 粘滞阻尼：非 warmup 状态下大幅度提升阻力，使得粒子在拉扯或挤压后迅速吸收能量停稳，摆脱“晃动头晕”
  const activeFriction = isWarmup ? 0.35 : Math.max(0.72, friction * 2.0)

  for (let i = 0; i < len; i++) {
    const p = particles[i]
    if (p.popped)
      continue

    // 当前偏移锚点
    let targetX = centerX + p.ox
    let targetY = centerY + p.oy

    // 【非牛顿粘弹性流体特性：塑性形变与缓慢蠕变回弹】
    if (!isWarmup) {
      const distToTarget = Math.sqrt((p.x - targetX) ** 2 + (p.y - targetY) ** 2)
      // 如果偏离原本锚点较远，说明受到了手指的强力揉捏，此时锚点 ox/oy 发生塑性漂移（保持捏后的扁平状态，避免强弹）
      if (distToTarget > 12) {
        const plasticity = 0.15 // 塑性变形系数
        p.ox += (p.x - targetX) * plasticity
        p.oy += (p.y - targetY) * plasticity
      }
      // ox 和 oy 极缓慢地向最原始极坐标 origOx/origOy 蠕变收拢，实现真实的“慢回弹”
      p.ox = p.ox * 0.993 + p.origOx * 0.007
      p.oy = p.oy * 0.993 + p.origOy * 0.007

      // 重新计算更新后的 target
      targetX = centerX + p.ox
      targetY = centerY + p.oy
    }

    p.vx += (targetX - p.x) * kCenter
    p.vy += (targetY - p.y) * kCenter

    // 限制单帧最大速度，防止能量突增爆发高频震颤
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
    const maxSpeed = 12
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed
      p.vy = (p.vy / speed) * maxSpeed
    }

    // 更新坐标及阻力
    p.vx *= (1 - activeFriction)
    p.vy *= (1 - activeFriction)
    p.x += p.vx
    p.y += p.vy

    // 越界边界处理
    const padding = p.radius
    if (p.x < padding) {
      p.x = padding
      p.vx *= -0.3
    }
    if (p.x > canvasWidth - padding) {
      p.x = canvasWidth - padding
      p.vx *= -0.3
    }
    if (p.y < padding) {
      p.y = padding
      p.vy *= -0.3
    }
    if (p.y > canvasHeight - padding) {
      p.y = canvasHeight - padding
      p.vy *= -0.3
    }
  }

  // 4. 更新配件位置 (使其平滑跟着锚定粒子移动并带转角)
  decInstances.forEach((dec) => {
    if (dec.targetParticleIdx !== -1 && dec.targetParticleIdx < len) {
      const p = particles[dec.targetParticleIdx]
      if (p.popped)
        return

      // 配件平滑插值到附着粒子的位置，并根据当前速度计算转动角度
      const targetX = p.x + Math.cos(dec.offsetA) * dec.offsetD
      const targetY = p.y + Math.sin(dec.offsetA) * dec.offsetD

      dec.vx = (targetX - dec.x) * 0.15
      dec.vy = (targetY - dec.y) * 0.15
      dec.x += dec.vx
      dec.y += dec.vy

      // 跟随速度产生微小晃动偏转，静止时平滑恢复初始固定角度 offsetA
      dec.angle = dec.offsetA + p.vx * 0.08
    }
  })

  // 5. 更新气泡破裂喷射粒子的寿命
  for (let i = splashParticles.length - 1; i >= 0; i--) {
    const sp = splashParticles[i]
    sp.x += sp.vx
    sp.y += sp.vy
    sp.vx *= 0.95
    sp.vy *= 0.95
    sp.life -= 1
    sp.alpha = sp.life / 16
    if (sp.life <= 0) {
      splashParticles.splice(i, 1)
    }
  }
}

function updatePhysics() {
  updatePhysicsInternal(false)
}

// === 矢量图形绘制辅助函数 ===
function drawVectorStar(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)'
  ctx.lineWidth = 1
  const points = 5
  const outerRadius = size
  const innerRadius = size * 0.4
  let rot = Math.PI / 2 * 3
  let x = 0
  let y = 0
  const step = Math.PI / points

  ctx.moveTo(0, -outerRadius)
  for (let i = 0; i < points; i++) {
    x = Math.cos(rot) * outerRadius
    y = Math.sin(rot) * outerRadius
    ctx.lineTo(x, y)
    rot += step

    x = Math.cos(rot) * innerRadius
    y = Math.sin(rot) * innerRadius
    ctx.lineTo(x, y)
    rot += step
  }
  ctx.lineTo(0, -outerRadius)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawVectorHeart(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'
  ctx.lineWidth = 1

  const width = size * 1.8
  const height = size * 1.8

  ctx.moveTo(0, -height / 4)
  ctx.bezierCurveTo(-width / 2, -height / 2, -width * 0.75, 0, 0, height / 2)
  ctx.bezierCurveTo(width * 0.75, 0, width / 2, -height / 2, 0, -height / 4)

  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawGlitter(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.save()

  // 1. 绘制金色细亮砂
  ctx.beginPath()
  ctx.fillStyle = '#ffd700'
  ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2)
  ctx.fill()

  // 2. 绘制极细闪光十字星线
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 0.8
  ctx.moveTo(-size * 0.85, 0)
  ctx.lineTo(size * 0.85, 0)
  ctx.moveTo(0, -size * 0.85)
  ctx.lineTo(0, size * 0.85)
  ctx.stroke()

  ctx.restore()
}

function drawStrawberry(ctx: CanvasRenderingContext2D, size: number) {
  ctx.save()

  // 红色草莓外圈
  ctx.beginPath()
  ctx.fillStyle = '#ff4b4b'
  const w = size * 1.8
  const h = size * 2.0
  ctx.moveTo(0, -h * 0.45)
  ctx.bezierCurveTo(-w * 0.55, -h * 0.55, -w * 0.55, h * 0.1, 0, h * 0.5)
  ctx.bezierCurveTo(w * 0.55, h * 0.1, w * 0.55, -h * 0.55, 0, -h * 0.45)
  ctx.closePath()
  ctx.fill()

  // 粉色果肉
  ctx.beginPath()
  ctx.fillStyle = '#ff7676'
  const iw = w * 0.75
  const ih = h * 0.75
  ctx.moveTo(0, -ih * 0.45)
  ctx.bezierCurveTo(-iw * 0.55, -ih * 0.55, -iw * 0.55, ih * 0.1, 0, ih * 0.5)
  ctx.bezierCurveTo(iw * 0.55, ih * 0.1, iw * 0.55, -ih * 0.55, 0, -ih * 0.45)
  ctx.closePath()
  ctx.fill()

  // 白色心
  ctx.beginPath()
  ctx.fillStyle = '#ffffff'
  ctx.ellipse(0, 0, size * 0.22, size * 0.35, 0, 0, Math.PI * 2)
  ctx.fill()

  // 黄色草莓籽
  ctx.fillStyle = '#ffeb3b'
  const seeds = [
    { x: -size * 0.28, y: -size * 0.1 },
    { x: size * 0.28, y: -size * 0.1 },
    { x: -size * 0.18, y: size * 0.2 },
    { x: size * 0.18, y: size * 0.2 },
    { x: 0, y: -size * 0.28 },
    { x: 0, y: size * 0.28 },
  ]
  seeds.forEach((pt) => {
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, size * 0.05, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.restore()
}

function drawFruitSlice(ctx: CanvasRenderingContext2D, size: number, outerColor: string, innerColor: string) {
  ctx.save()

  // 外层果皮圆
  ctx.beginPath()
  ctx.arc(0, 0, size, 0, Math.PI * 2)
  ctx.fillStyle = outerColor
  ctx.fill()

  // 白色果皮内层
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.88, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  // 8 个扇形瓣
  const segments = 8
  const segmentAngle = (Math.PI * 2) / segments
  ctx.fillStyle = innerColor

  for (let i = 0; i < segments; i++) {
    ctx.save()
    ctx.rotate(i * segmentAngle)

    ctx.beginPath()
    ctx.moveTo(0, 0)
    const angleOffset = 0.12
    ctx.arc(0, 0, size * 0.8, angleOffset, segmentAngle - angleOffset)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  // 小果心
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  ctx.restore()
}

// === 绘制画布渲染 ===
function drawSlime() {
  // 1. 如果 WebGL 可用且初始化成功，使用 WebGL 渲染底层 3D 史莱姆水晶流体
  if (useWebGL.value && gl && glProgram) {
    gl.viewport(0, 0, canvasWidth * dpr, canvasHeight * dpr)
    gl.clearColor(0.0, 0.0, 0.0, 0.0) // 保持背景完全透明，支持底层 UI 融合
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(glProgram)

    // 缩放因子 0.1：强制将坐标系缩小 10 倍。
    // 这是为了绝对防止移动端低端 GPU 的 mediump float (fp16, 最大值 65504) 在计算像素平方距 d2 时发生溢出，导致完全黑屏。
    const SCALE = 0.1
    gl.uniform2f(uResolutionLoc, canvasWidth * SCALE, canvasHeight * SCALE)

    // 传入不同材质特有的 3D 高光、发光、透明度渲染属性
    gl.uniform1f(uSpecularPowerLoc, currentMaterial.value.specularPower)
    gl.uniform1f(uSpecularIntensityLoc, currentMaterial.value.specularIntensity)
    gl.uniform1f(uRimIntensityLoc, currentMaterial.value.rimIntensity)
    gl.uniform3f(uRimColorLoc, currentMaterial.value.rimColor[0], currentMaterial.value.rimColor[1], currentMaterial.value.rimColor[2])
    gl.uniform1f(uTransparencyLoc, currentMaterial.value.transparency)

    // 遍历传入 24 个粒子的物理状态
    const len = particles.length
    for (let i = 0; i < 24; i++) {
      if (i < len && !particles[i].popped) {
        const p = particles[i]
        const glX = p.x * SCALE
        const glY = (canvasHeight - p.y) * SCALE
        const glRadius = p.radius * SCALE

        gl.uniform3f(uParticlesLoc[i], glX, glY, glRadius)
        gl.uniform3f(uColorsLoc[i], p.r / 255.0, p.g / 255.0, p.b / 255.0)
      }
      else {
        // 传入无效占位粒子，防止未分配粒子参与计算
        gl.uniform3f(uParticlesLoc[i], -9999.0, -9999.0, 0.0)
        gl.uniform3f(uColorsLoc[i], 0.0, 0.0, 0.0)
      }
    }

    // 触发全屏 Quad 像素光照渲染
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  // 2. 2D 降级模式：如果 WebGL 不可用，绘制底层史莱姆粒子到 slimeCanvas2d (带 CSS 融合滤镜)
  if (!useWebGL.value && slime2dCtx) {
    // 每次渲染前重置变换矩阵，然后用纯黑色 '#000000' 填充整个画布。
    // 在带有 contrast 滤镜的 Canvas 上，实色背景能作为像素对比度计算的基准色。
    // 在 CSS mix-blend-mode: screen 混合模式作用下，黑色背景会在屏幕叠加时完全自动过滤为 100% 透明，而不遮挡任何底层 UI。
    slime2dCtx.setTransform(1, 0, 0, 1, 0, 0)
    slime2dCtx.fillStyle = '#000000'
    slime2dCtx.fillRect(0, 0, canvasWidth * dpr, canvasHeight * dpr)
    slime2dCtx.scale(dpr, dpr) // 重新缩放坐标系，以便粒子绘制位置和逻辑像素完美对齐

    particles.forEach((p) => {
      if (p.popped)
        return
      slime2dCtx!.beginPath()

      // 在带有高对比度滤镜的 Canvas 上，必须采用 RGB 同色、仅 Alpha 通道递减淡出的径向渐变
      // 如果边缘使用白色或灰色半透明，滤镜会将其拉伸为刺眼的白雾、白边硬边。同色淡出则能融合出极度清澈光滑的液体边缘
      const grad = slime2dCtx!.createRadialGradient(p.x, p.y, p.radius * 0.1, p.x, p.y, p.radius)
      const rgbaBase = `rgba(${Math.round(p.r)},${Math.round(p.g)},${Math.round(p.b)}`
      grad.addColorStop(0, `${rgbaBase},1.0)`)
      grad.addColorStop(0.55, `${rgbaBase},0.9)`)
      grad.addColorStop(1, `${rgbaBase},0.0)`)

      slime2dCtx!.fillStyle = grad
      slime2dCtx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      slime2dCtx!.fill()
    })
  }

  // 3. 顶层 Canvas (无滤镜，保持高清晰度)
  if (!decCtx)
    return
  decCtx.setTransform(1, 0, 0, 1, 0, 0)
  decCtx.clearRect(0, 0, canvasWidth * dpr, canvasHeight * dpr)
  decCtx.scale(dpr, dpr)

  // 3.1 如果是 2D 降级模式，我们把高清的高光弧线绘制在顶层画布上，给史莱姆球赋予立体感
  if (!useWebGL.value) {
    particles.forEach((p) => {
      if (p.popped)
        return
      if (p.type !== 'bubble') {
        decCtx!.beginPath()
        decCtx!.arc(p.x - p.radius * 0.22, p.y - p.radius * 0.22, p.radius * 0.42, Math.PI * 1.15, Math.PI * 1.55)
        decCtx!.strokeStyle = 'rgba(255, 255, 255, 0.22)' // 调低不透明度，使高光与融合后的流体完美贴合，不突兀
        decCtx!.lineWidth = p.radius * 0.05 // 减小高光线条宽度，精致纤细
        decCtx!.lineCap = 'round'
        decCtx!.stroke()
      }
    })
  }

  // 3.2 绘制气泡（bubble）的白边及内侧微小高光反光弧
  particles.forEach((p) => {
    if (p.popped)
      return

    // 如果是 bubble (中空气泡)，则特别绘制清晰的白边及内侧微小高光反光弧
    if (p.type === 'bubble') {
      decCtx!.beginPath()
      decCtx!.arc(p.x, p.y, p.radius - 2, 0, Math.PI * 2)
      decCtx!.strokeStyle = 'rgba(255, 255, 255, 0.55)'
      decCtx!.lineWidth = 1.2
      decCtx!.stroke()

      decCtx!.beginPath()
      decCtx!.arc(p.x - p.radius * 0.25, p.y - p.radius * 0.25, p.radius * 0.18, Math.PI * 1.0, Math.PI * 1.5)
      decCtx!.strokeStyle = 'rgba(255, 255, 255, 0.75)'
      decCtx!.lineWidth = 1.2
      decCtx!.stroke()
    }
  })

  // 3.3 绘制配件 (矢量精细绘制)
  decInstances.forEach((dec) => {
    decCtx!.save()
    decCtx!.translate(dec.x, dec.y)
    decCtx!.rotate(dec.angle)

    const size = 8 * dec.scale
    if (dec.type === 'star') {
      drawVectorStar(decCtx!, size, dec.color)
    }
    else if (dec.type === 'heart') {
      drawVectorHeart(decCtx!, size, dec.color)
    }
    else if (dec.type === 'glitter') {
      drawGlitter(decCtx!, size, dec.color)
    }
    else if (dec.type === 'strawberry') {
      drawStrawberry(decCtx!, size)
    }
    else if (dec.type === 'lemon') {
      drawFruitSlice(decCtx!, size, '#ffeb3b', '#ffd54f')
    }
    else if (dec.type === 'lime') {
      drawFruitSlice(decCtx!, size, '#4caf50', '#81c784')
    }
    else {
      // 降级渲染 emoji
      decCtx!.font = `${Math.round(14 * dec.scale)}px sans-serif`
      decCtx!.fillStyle = dec.color
      decCtx!.textAlign = 'center'
      decCtx!.textBaseline = 'middle'
      decCtx!.fillText(dec.icon, 0, 0)
    }
    decCtx!.restore()
  })

  // 3.4 绘制气泡爆裂时的水花飞溅效果
  splashParticles.forEach((sp) => {
    decCtx!.save()
    decCtx!.globalAlpha = sp.alpha
    decCtx!.beginPath()
    decCtx!.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2)
    decCtx!.fillStyle = sp.color
    decCtx!.fill()
    decCtx!.restore()
  })
}

// === WebGL 3D 渲染器初始化 ===
function initWebGL(canvas: any, ctx: WebGLRenderingContext) {
  gl = ctx
  if (!gl) {
    console.warn('[WebGL] WebGL Context is not available. Falling back to 2D rendering.')
    useWebGL.value = false
    trigger2dFallback()
    return
  }

  // 1. 编译顶点和片元着色器
  const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_position * 0.5 + 0.5;
    }
  `

  // 优化后的 3D Metaball 着色器：
  // 在单次循环中同时计算 Metaball 密度以及梯度（对 x 和 y 的导数），避免多次调用造成渲染管线超长和移动端 GPU 编译失败
  const fsSource = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform vec2 u_resolution;
    uniform vec3 u_particles[24]; // xy: position, z: radius
    uniform vec3 u_colors[24];
    uniform float u_specularPower;
    uniform float u_specularIntensity;
    uniform float u_rimIntensity;
    uniform vec3 u_rimColor;
    uniform float u_transparency;
    const vec3 LIGHT_DIR = vec3(0.26, 0.38, 0.88);
    const vec3 LIGHT_COLOR = vec3(1.0, 1.0, 1.0);
    
    float calcMetaballField(vec2 pixelPos, out vec3 mixedColor, out vec2 grad) {
      float density = 0.0;
      mixedColor = vec3(0.0);
      float colorWeightSum = 0.0;
      grad = vec2(0.0);
      
      for (int i = 0; i < 24; i++) {
        vec3 p = u_particles[i];
        vec2 pPos = p.xy;
        float r = p.z;
        
        vec2 diff = pixelPos - pPos;
        float d2 = dot(diff, diff);
        if (d2 > 0.0001) {
          float d = sqrt(d2);
          float ratio = r / d;
          float f = ratio * ratio * ratio; // 密度贡献 (r/d)^3
          
          density += f;
          mixedColor += u_colors[i] * f;
          colorWeightSum += f;
          
          // 累加梯度
          grad += -3.0 * f * diff / d2;
        }
      }
      
      if (colorWeightSum > 0.0) {
        mixedColor /= colorWeightSum;
      }
      
      return density;
    }
    
    void main() {
      vec2 pixelPos = v_texCoord * u_resolution;
      vec3 baseColor;
      vec2 grad;
      float density = calcMetaballField(pixelPos, baseColor, grad);
      
      float threshold = 0.85;
      // 由于传入的坐标 u_resolution 被缩小了 10 倍，为了维持同样的边缘抗锯齿宽度，需要乘回 10.0
      float aa = 2.4 / (min(u_resolution.x, u_resolution.y) * 10.0);
      float alphaFactor = smoothstep(threshold - aa, threshold + aa, density);
      
      if (alphaFactor < 0.01) {
        discard;
      }
      
      // 法线 N = normalize(vec3(-grad.x, -grad.y, 12.0))
      // 由于坐标缩小了 10 倍，导致算出的 grad 会同比放大 10 倍。为了保持光照质感不变，Z 轴系数需要同步放大 10 倍 (12.0 -> 120.0)
      vec3 N = normalize(vec3(-grad.x, -grad.y, 120.0));
      
      vec3 V = vec3(0.0, 0.0, 1.0);
      vec3 L = normalize(LIGHT_DIR);
      vec3 H = normalize(L + V);
      
      float diff = max(dot(N, L), 0.0);
      float spec = pow(max(dot(N, H), 0.0), u_specularPower);
      vec3 specularColor = LIGHT_COLOR * spec * u_specularIntensity;
      
      float rim = 1.0 - max(dot(N, V), 0.0);
      float rimPower = pow(rim, 3.0);
      vec3 rimColor = u_rimColor * rimPower * u_rimIntensity;
      
      float edgeAlpha = smoothstep(threshold, threshold + 0.18, density);
      float baseAlpha = mix(u_transparency, 0.95, edgeAlpha);
      float alpha = baseAlpha * alphaFactor;
      
      vec3 finalColor = baseColor * (diff * 0.75 + 0.25) + specularColor + rimColor;
      gl_FragColor = vec4(finalColor, alpha);
    }
  `

  const compileShader = (source: string, type: number) => {
    const shader = gl!.createShader(type)
    if (!shader)
      return null
    gl!.shaderSource(shader, source)
    gl!.compileShader(shader)
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      console.error('Shader compile failed:', gl!.getShaderInfoLog(shader))
      gl!.deleteShader(shader)
      return null
    }
    return shader
  }

  const vs = compileShader(vsSource, gl.VERTEX_SHADER)
  const fs = compileShader(fsSource, gl.FRAGMENT_SHADER)
  if (!vs || !fs) {
    console.warn('[WebGL] Shader compilation failed. Falling back to 2D rendering.')
    useWebGL.value = false
    trigger2dFallback()
    return
  }

  glProgram = gl.createProgram()
  if (!glProgram)
    return
  gl.attachShader(glProgram, vs)
  gl.attachShader(glProgram, fs)
  gl.linkProgram(glProgram)

  if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
    console.error('Program link failed:', gl.getProgramInfoLog(glProgram))
    useWebGL.value = false
    trigger2dFallback()
    return
  }

  gl.useProgram(glProgram)

  // 2. 绑定绘制 Quad
  const vertices = new Float32Array([
    -1.0,
    -1.0,
    1.0,
    -1.0,
    -1.0,
    1.0,
    -1.0,
    1.0,
    1.0,
    -1.0,
    1.0,
    1.0,
  ])

  positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

  const aPosition = gl.getAttribLocation(glProgram, 'a_position')
  gl.enableVertexAttribArray(aPosition)
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

  // 3. 缓存 Uniform locations
  uResolutionLoc = gl.getUniformLocation(glProgram, 'u_resolution')
  for (let i = 0; i < 24; i++) {
    uParticlesLoc[i] = gl.getUniformLocation(glProgram, `u_particles[${i}]`)!
    uColorsLoc[i] = gl.getUniformLocation(glProgram, `u_colors[${i}]`)!
  }

  uSpecularPowerLoc = gl.getUniformLocation(glProgram, 'u_specularPower')
  uSpecularIntensityLoc = gl.getUniformLocation(glProgram, 'u_specularIntensity')
  uRimIntensityLoc = gl.getUniformLocation(glProgram, 'u_rimIntensity')
  uRimColorLoc = gl.getUniformLocation(glProgram, 'u_rimColor')
  uTransparencyLoc = gl.getUniformLocation(glProgram, 'u_transparency')

  // 开启 Alpha 混合
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
}

// === Canvas 初始化 ===
// #ifdef H5
let h5TouchBoundCanvas: HTMLCanvasElement | null = null
// #endif

function trigger2dFallback() {
  useWebGL.value = false
  nextTick(() => {
    // #ifdef H5
    h5TouchBoundCanvas = null
    initH5CanvasLayer()
    // #endif
    // #ifndef H5
    setupCanvasNode('#slimeCanvas2d', (canvas, ctx) => {
      slime2dCanvas = canvas
      slime2dCtx = ctx
    })
    // #endif
  })
}

// #ifdef H5
function syncH5CanvasLayout() {
  const wrap = document.querySelector('.canvas-wrap') as HTMLElement | null
  if (!wrap)
    return false

  const w = wrap.clientWidth
  const h = wrap.clientHeight
  if (w <= 0 || h <= 0)
    return false

  setCanvasDimensions(w, h)
  dpr = window.devicePixelRatio || 1

  const applyCanvas = (canvas: HTMLCanvasElement | null, ctx: CanvasRenderingContext2D | null) => {
    if (!canvas)
      return
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
  }

  if (useWebGL.value) {
    if (slimeCanvas) {
      slimeCanvas.style.width = `${w}px`
      slimeCanvas.style.height = `${h}px`
      slimeCanvas.width = Math.round(w * dpr)
      slimeCanvas.height = Math.round(h * dpr)
    }
    if (gl) {
      gl.viewport(0, 0, Math.round(w * dpr), Math.round(h * dpr))
    }
  }
  else {
    applyCanvas(slime2dCanvas, slime2dCtx)
  }
  applyCanvas(decCanvas, decCtx)
  return true
}

function bindH5CanvasTouches() {
  const target = (useWebGL.value ? slimeCanvas : slime2dCanvas) as HTMLCanvasElement | null
  if (!target || target === h5TouchBoundCanvas)
    return

  h5TouchBoundCanvas = target
  const onStart = (e: TouchEvent) => {
    e.preventDefault()
    const rect = target.getBoundingClientRect()
    canvasRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    onTouchStart({
      touches: Array.from(e.touches).map(t => ({
        identifier: t.identifier,
        clientX: t.clientX,
        clientY: t.clientY,
        x: (t.clientX - rect.left) * (canvasWidth / rect.width),
        y: (t.clientY - rect.top) * (canvasHeight / rect.height),
      })),
    })
  }
  const onMove = (e: TouchEvent) => {
    e.preventDefault()
    const rect = canvasRect || target.getBoundingClientRect()
    onTouchMove({
      touches: Array.from(e.touches).map(t => ({
        identifier: t.identifier,
        clientX: t.clientX,
        clientY: t.clientY,
        x: (t.clientX - rect.left) * (canvasWidth / (rect.width || canvasWidth)),
        y: (t.clientY - rect.top) * (canvasHeight / (rect.height || canvasHeight)),
      })),
    })
  }
  const onEnd = (e: TouchEvent) => {
    const rect = canvasRect || target.getBoundingClientRect()
    onTouchEnd({
      changedTouches: Array.from(e.changedTouches).map(t => ({
        identifier: t.identifier,
        clientX: t.clientX,
        clientY: t.clientY,
        x: (t.clientX - rect.left) * (canvasWidth / (rect.width || canvasWidth)),
        y: (t.clientY - rect.top) * (canvasHeight / (rect.height || canvasHeight)),
      })),
    })
  }
  target.addEventListener('touchstart', onStart, { passive: false })
  target.addEventListener('touchmove', onMove, { passive: false })
  target.addEventListener('touchend', onEnd, { passive: false })
}

function initH5CanvasLayer(): boolean {
  const wrap = document.querySelector('.canvas-wrap') as HTMLElement | null
  if (!wrap)
    return false

  const insertAnchor = wrap.querySelector('.z-30') || wrap.firstChild

  const ensureCanvas = (id: string, zIndex: number, extraClass = '') => {
    let el = document.getElementById(id) as HTMLCanvasElement | null
    if (!el) {
      el = document.createElement('canvas')
      el.id = id
      if (insertAnchor) {
        wrap.insertBefore(el, insertAnchor)
      }
      else {
        wrap.appendChild(el)
      }
    }
    el.className = ['h5-slime-canvas', extraClass].filter(Boolean).join(' ')
    el.style.position = 'absolute'
    el.style.left = '0'
    el.style.top = '0'
    el.style.zIndex = String(zIndex)
    return el
  }

  if (useWebGL.value) {
    document.getElementById('slimeCanvas2d')?.remove()
    slimeCanvas = ensureCanvas('slimeCanvas', 10)
    const ctx = slimeCanvas.getContext('webgl') || slimeCanvas.getContext('experimental-webgl')
    if (!ctx) {
      useWebGL.value = false
      return initH5CanvasLayer()
    }
    initWebGL(slimeCanvas, ctx as WebGLRenderingContext)
  }
  else {
    document.getElementById('slimeCanvas')?.remove()
    slime2dCanvas = ensureCanvas('slimeCanvas2d', 10, 'slime-canvas-2d-filter')
    slime2dCtx = slime2dCanvas.getContext('2d')
  }

  decCanvas = ensureCanvas('decCanvas', 20)
  decCanvas.style.pointerEvents = 'none'
  decCtx = decCanvas.getContext('2d')

  syncH5CanvasLayout()
  bindH5CanvasTouches()
  return true
}

let canvasResizeObserver: ResizeObserver | null = null

function observeCanvasWrapResize() {
  if (typeof ResizeObserver === 'undefined')
    return
  const wrapEl = document.querySelector('.canvas-wrap')
  if (!wrapEl)
    return
  canvasResizeObserver?.disconnect()
  canvasResizeObserver = new ResizeObserver(() => {
    onResizeEvent()
  })
  canvasResizeObserver.observe(wrapEl)
}
// #endif

function setupCanvasNode(selector: string, callback: (canvas: any, ctx: any) => void) {
  // #ifndef H5
  uni.createSelectorQuery()
    .select(selector)
    .node((res) => {
      if (res && res.node) {
        const canvas = res.node
        const contextType = (selector === '#slimeCanvas') ? 'webgl' : '2d'
        let ctx = canvas.getContext(contextType)
        if (contextType === 'webgl' && !ctx) {
          ctx = canvas.getContext('experimental-webgl')
        }
        if (!ctx) {
          if (selector === '#slimeCanvas') {
            useWebGL.value = false
            trigger2dFallback()
          }
          return
        }
        dpr = uni.getSystemInfoSync().pixelRatio || 1
        canvas.width = canvasWidth * dpr
        canvas.height = canvasHeight * dpr
        if (contextType === '2d') {
          ctx?.setTransform(1, 0, 0, 1, 0, 0)
          ctx?.scale(dpr, dpr)
        }
        callback(canvas, ctx)
      }
    })
    .exec()
  // #endif
}

function setCanvasDimensions(width: number, height: number) {
  if (width <= 0 || height <= 0)
    return false
  canvasWidth = width
  canvasHeight = height
  centerX = canvasWidth / 2
  centerY = canvasHeight / 2
  return true
}

function estimateCanvasWrapSize() {
  const sys = uni.getSystemInfoSync()
  const winW = sys.windowWidth || 375
  const winH = sys.windowHeight || 667
  let ch = winH * 0.38
  if (ch > 500)
    ch = 500
  if (ch < 180)
    ch = 180
  return { width: winW, height: ch }
}

function measureCanvasWrap(callback: (width: number, height: number) => void) {
  const fallback = () => {
    const { width, height } = estimateCanvasWrapSize()
    callback(width, height)
  }

  // #ifdef H5
  const tryMeasure = () => {
    try {
      const wrapEl = document.querySelector('.canvas-wrap') as HTMLElement
      if (!wrapEl)
        return false
      const rect = wrapEl.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        callback(Math.round(rect.width), Math.round(rect.height))
        return true
      }
    }
    catch (e) {}
    return false
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!tryMeasure())
        fallback()
    })
  })
  return
  // #endif

  // #ifndef H5
  uni.createSelectorQuery()
    .select('.canvas-wrap')
    .boundingClientRect((rect: any) => {
      if (rect && rect.width > 0 && rect.height > 0) {
        callback(rect.width, rect.height)
      }
      else {
        fallback()
      }
    })
    .exec()
  // #endif
}

function resizeCanvasBuffers() {
  dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || uni.getSystemInfoSync().pixelRatio || 1

  // #ifdef H5
  syncH5CanvasLayout()
  return
  // #endif

  // #ifndef H5
  const updateCanvas = (canvasEl: any, ctx: any, contextType: 'webgl' | '2d') => {
    if (!canvasEl)
      return
    canvasEl.width = canvasWidth * dpr
    canvasEl.height = canvasHeight * dpr
    if (contextType === '2d' && ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
  }

  uni.createSelectorQuery()
    .select('#slimeCanvas')
    .node((res) => {
      if (res && res.node) {
        updateCanvas(res.node, gl, 'webgl')
        if (gl) {
          gl.viewport(0, 0, canvasWidth * dpr, canvasHeight * dpr)
        }
      }
    })
    .exec()

  uni.createSelectorQuery()
    .select('#slimeCanvas2d')
    .node((res) => {
      if (res && res.node) {
        updateCanvas(res.node, slime2dCtx, '2d')
      }
    })
    .exec()

  uni.createSelectorQuery()
    .select('#decCanvas')
    .node((res) => {
      if (res && res.node) {
        updateCanvas(res.node, decCtx, '2d')
      }
    })
    .exec()
  // #endif
}

function initCanvasNodes() {
  useWebGL.value = true

  // #ifdef H5
  const startH5 = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (initH5CanvasLayer()) {
          setTimeout(() => startRenderLoop(), 200)
        }
        else {
          setTimeout(startH5, 100)
        }
      })
    })
  }
  nextTick(() => startH5())
  return
  // #endif

  const setupCanvases = () => {
    setupCanvasNode('#slimeCanvas', (canvas, ctx) => {
      slimeCanvas = canvas
      initWebGL(canvas, ctx)
    })

    setupCanvasNode('#decCanvas', (canvas, ctx) => {
      decCanvas = canvas
      decCtx = ctx
    })

    setTimeout(() => {
      startRenderLoop()
    }, 400)
  }

  const beginInit = () => {
    measureCanvasWrap((width, height) => {
      setCanvasDimensions(width, height)
      setupCanvases()
    })
  }

  // #ifndef H5
  beginInit()
  // #endif
}

// === 交互事件处理 ===
function getCanvasTouchPos(touch: any, rect: any) {
  // 微信小程序下，触摸事件的 touch 对象自带相对于 canvas 的本地 x 和 y 坐标，优先使用避免偏置
  if (touch && typeof touch.x !== 'undefined' && touch.x !== null) {
    return { x: touch.x, y: touch.y }
  }
  // H5 平台或降级使用 client 坐标计算偏移
  const x = touch.clientX - (rect.left || 0)
  const y = touch.clientY - (rect.top || 0)
  return { x, y }
}

function updateCanvasRect() {
  uni.createSelectorQuery()
    .select('.canvas-wrap')
    .boundingClientRect((rect: any) => {
      if (rect) {
        canvasRect = rect
      }
    })
    .exec()
}

function onTouchStart(e: any) {
  synth.init()
  updateCanvasRect()
  const touchList = e.touches || []

  for (let i = 0; i < touchList.length; i++) {
    const t = touchList[i]
    const pos = getCanvasTouchPos(t, canvasRect || { left: 0, top: 0 })

    // 判断是否点中了某个气泡粒子 (气泡可以被戳破)
    let bubbleClicked = false
    for (let k = 0; k < particles.length; k++) {
      const p = particles[k]
      if (p.type === 'bubble' && !p.popped) {
        const dist = Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2)
        if (dist < p.radius + 10) {
          // 戳破气泡！
          p.popped = true
          bubbleClicked = true
          triggerBubblePop(p.x, p.y, p.color)
          break
        }
      }
    }

    if (!bubbleClicked) {
      // 记录触控点
      touches.push({
        id: t.identifier ?? 0,
        x: pos.x,
        y: pos.y,
        lastX: pos.x,
        lastY: pos.y,
        grabParticleIdx: -1, // 在引擎循环中搜寻最近粒子
      })
    }
  }
}

function onTouchMove(e: any) {
  const touchList = e.touches || []
  for (let i = 0; i < touchList.length; i++) {
    const t = touchList[i]
    const pos = getCanvasTouchPos(t, canvasRect || { left: 0, top: 0 })
    const touchId = t.identifier ?? 0

    const found = touches.find(item => item.id === touchId)
    if (found) {
      found.x = pos.x
      found.y = pos.y
    }
  }
}

function onTouchEnd(e: any) {
  const changeList = e.changedTouches || []
  for (let i = 0; i < changeList.length; i++) {
    const t = changeList[i]
    const touchId = t.identifier ?? 0
    const idx = touches.findIndex(item => item.id === touchId)
    if (idx !== -1) {
      touches.splice(idx, 1)
    }
  }
}

// 气泡破裂处理：声音、震动、飞溅特效、情绪能量增加
function triggerBubblePop(x: number, y: number, color: string) {
  synth.playPop()
  // #ifdef MP-WEIXIN
  uni.vibrateShort({ type: 'medium' })
  // #endif

  stressRelief.value = Math.min(100, stressRelief.value + 4.5)
  if (stressRelief.value >= 100 && !isRelieved.value) {
    triggerRelieved()
  }

  // 在顶层产生 6-8 个放射状飞溅粒子
  for (let i = 0; i < 7; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1.5 + Math.random() * 2.0
    splashParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      radius: 2 + Math.random() * 3,
      alpha: 1.0,
      life: 12 + Math.floor(Math.random() * 5),
    })
  }

  // 5% 概率在其他地方再生一个新气泡，保持气泡动态产生
  setTimeout(() => {
    // 寻找已经破裂的粒子进行重置
    const deadP = particles.find(p => p.popped && p.type === 'bubble')
    if (deadP) {
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * 45
      deadP.x = centerX + Math.cos(angle) * dist
      deadP.y = centerY + Math.sin(angle) * dist
      deadP.vx = 0
      deadP.vy = 0
      deadP.popped = false
    }
  }, 1800)
}

// === 解压完成满格特效 ===
function triggerRelieved() {
  isRelieved.value = true
  triggerConfetti()
  // 喷射漫天花雨特效
  for (let k = 0; k < 45; k++) {
    const rx = Math.random() * canvasWidth
    const ry = -10 - Math.random() * 30
    const color = `hsl(${Math.random() * 360}, 100%, 65%)`
    splashParticles.push({
      x: rx,
      y: ry,
      vx: -1 + Math.random() * 2,
      vy: 2 + Math.random() * 3,
      color,
      radius: 3 + Math.random() * 4,
      alpha: 1.0,
      life: 80 + Math.floor(Math.random() * 40),
    })
  }
}

// Canvas 初始化函数已重构并前移至 WebGL 模块下方

function startRenderLoop() {
  if (isRunning)
    return

  const boot = () => {
    isRunning = true
    resizeCanvasBuffers()
    initPhysics()

    // H5 布局稳定后再校准一次，防止首帧尺寸偏差导致史莱姆偏移
    // #ifdef H5
    setTimeout(() => {
      const prevW = canvasWidth
      const prevH = canvasHeight
      if (syncH5CanvasLayout()) {
        if (Math.abs(canvasWidth - prevW) > 2 || Math.abs(canvasHeight - prevH) > 2) {
          initPhysics()
        }
      }
    }, 350)
    // #endif

    function tick() {
      if (!isRunning)
        return
      updatePhysics()
      drawSlime()
      if (typeof requestAnimationFrame !== 'undefined') {
        loopTimer = requestAnimationFrame(tick) as any
      }
      else {
        loopTimer = setTimeout(tick, 16)
      }
    }
    tick()
  }

  measureCanvasWrap((width, height) => {
    setCanvasDimensions(width, height)
    boot()
  })
}

function stopRenderLoop() {
  isRunning = false
  if (loopTimer) {
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(loopTimer)
    }
    clearTimeout(loopTimer)
    loopTimer = null
  }
}

// === 交互面板操作 ===
function selectMaterial(mat: SlimeMaterial) {
  currentMaterial.value = mat
  colorA.value = mat.baseColor
  colorB.value = mat.mixColor
  initPhysics()
}

function selectColor(type: 'A' | 'B', color: string) {
  if (type === 'A') {
    colorA.value = color
  }
  else {
    colorB.value = color
  }
  initPhysics()
}

function toggleAddin(addinId: string) {
  const addin = addins.value.find(a => a.id === addinId)
  if (!addin)
    return

  if (addin.locked) {
    // 弹出模拟视频广告解锁
    adTargetAddin.value = addin
    showAdsPopup.value = true
    adCountdown.value = 3
    const timer = setInterval(() => {
      adCountdown.value -= 1
      if (adCountdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
    return
  }

  const idx = activeAddins.value.indexOf(addinId)
  if (idx === -1) {
    activeAddins.value.push(addinId)
    // 撒入配件到 Canvas
    applyAddinToParticles(addinId)
  }
  else {
    activeAddins.value.splice(idx, 1)
    // 从 Canvas 移除
    decInstances = decInstances.filter(dec => dec.type !== addinId)
  }
}

function unlockAddin() {
  if (adTargetAddin.value) {
    adTargetAddin.value.locked = false
    activeAddins.value.push(adTargetAddin.value.id)
    applyAddinToParticles(adTargetAddin.value.id)
    adTargetAddin.value = null
  }
  showAdsPopup.value = false
}

// === 陈列柜及存档逻辑 ===
const shelfJars = ref<any[]>([])

function loadArchives() {
  try {
    const data = uni.getStorageSync('slime_archives')
    if (data) {
      slimeArchives.value = JSON.parse(data)
    }
    else {
      // 预置几个展示数据
      slimeArchives.value = [
        {
          id: '1',
          name: '草莓气泡冰🥤',
          materialId: 'bubble',
          colorA: '#ff9a9e',
          colorB: '#fecfef',
          addins: ['heart', 'glitter'],
          createdAt: '2026-06-16',
        },
        {
          id: '2',
          name: '翡翠星河胶⭐',
          materialId: 'clay',
          colorA: '#11998e',
          colorB: '#38ef7d',
          addins: ['star'],
          createdAt: '2026-06-15',
        },
      ]
      uni.setStorageSync('slime_archives', JSON.stringify(slimeArchives.value))
    }
  }
  catch (e) {}
}

function saveSlime() {
  if (!newSlimeName.value.trim()) {
    uni.showToast({ title: '请输入史莱姆名字', icon: 'none' })
    return
  }

  const newArchive: SlimeArchive = {
    id: Date.now().toString(),
    name: newSlimeName.value.trim(),
    materialId: currentMaterial.value.id,
    colorA: colorA.value,
    colorB: colorB.value,
    addins: [...activeAddins.value],
    createdAt: new Date().toISOString().split('T')[0],
  }

  slimeArchives.value.unshift(newArchive)
  uni.setStorageSync('slime_archives', JSON.stringify(slimeArchives.value))

  uni.showToast({ title: '已存入陈列柜！', icon: 'success' })
  showSavePopup.value = false
  newSlimeName.value = ''
  activeTab.value = prevTab.value
}

function triggerSaveTab() {
  prevTab.value = activeTab.value
  activeTab.value = 'save'
  showSavePopup.value = true
}

function cancelSave() {
  showSavePopup.value = false
  activeTab.value = prevTab.value
}

function selectArchive(archive: SlimeArchive) {
  const mat = materials.find(m => m.id === archive.materialId) || materials[0]
  currentMaterial.value = mat
  colorA.value = archive.colorA
  colorB.value = archive.colorB
  activeAddins.value = [...archive.addins]
  currentMode.value = 'play'
  activeTab.value = 'material'

  nextTick(() => {
    initCanvasNodes()
  })
}

function deleteArchive(id: string, e: Event) {
  e.stopPropagation()
  uni.showModal({
    title: '删除史莱姆',
    content: '确定要从你的陈列柜中移除这罐史莱姆吗？',
    success: (res) => {
      if (res.confirm) {
        slimeArchives.value = slimeArchives.value.filter(a => a.id !== id)
        uni.setStorageSync('slime_archives', JSON.stringify(slimeArchives.value))
        uni.showToast({ title: '已移除', icon: 'none' })
      }
    },
  })
}

function toggleMode(mode: 'play' | 'shelf') {
  currentMode.value = mode
  if (mode === 'play') {
    nextTick(() => {
      initCanvasNodes()
    })
  }
  else {
    stopRenderLoop()
  }
}

// === 音量与静音控制 ===
function toggleMute() {
  isMuted.value = !isMuted.value
}

function onVolumeChange(e: any) {
  volume.value = e.detail.value / 100
  if (volume.value > 0) {
    isMuted.value = false
  }
}

// === 趣味科普提示 ===
function showTips() {
  let tipContent = ''
  if (currentMaterial.value.id === 'water') {
    tipContent = '💡【水弹史莱姆小贴士】\n水弹史莱姆的含水量高达 90% 以上，拥有极强的流动性和类似于水波般的清脆吧唧音效。轻轻戳一下它，能完美舒缓你紧绷的神经哦！'
  }
  else if (currentMaterial.value.id === 'bubble') {
    tipContent = '💡【绵密起泡胶小贴士】\n起泡胶越揉捏越蓬松，会产生超多细密的小气泡。双指朝两边慢慢拉伸，可以让气泡迅速胀大，捏破它时的 ASMR 声音最治愈了！'
  }
  else {
    tipContent = '💡【厚实牛头胶小贴士】\n牛头胶拥有极强的韧性和拉伸阻力，就像太极般以柔克刚。需要稍微用力才能拉扯开，非常适合用来宣泄心中的压力与烦恼！'
  }

  uni.showModal({
    title: '史莱姆趣味知识 🧙‍♂️',
    content: tipContent,
    showCancel: false,
    confirmText: '我知道啦',
  })
}

// === 彩带飘花特效 ===
const confettiList = ref<Array<{ id: number, left: string, color: string, delay: string, size: string }>>([])
function triggerConfetti() {
  confettiList.value = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: ['#ff2a6d', '#05ffa1', '#ffd700', '#00d2ff', '#aa00ff'][Math.floor(Math.random() * 5)],
    delay: `${Math.random() * 1.5}s`,
    size: `${6 + Math.random() * 8}px`,
  }))
  setTimeout(() => {
    confettiList.value = []
  }, 4000)
}

// === 页面钩子 ===
onLoad((options) => {
  // 检查是否是从分享进入的好友配方
  if (options && options.recipe) {
    try {
      const recipe = JSON.parse(decodeURIComponent(options.recipe))
      if (recipe) {
        const mat = materials.find(m => m.id === recipe.matId)
        if (mat)
          currentMaterial.value = mat
        colorA.value = recipe.colA || colorA.value
        colorB.value = recipe.colB || colorB.value
        activeAddins.value = recipe.add || []

        uni.showModal({
          title: '收到礼物 🎁',
          content: `收到了好友赠送给你的一罐【${recipe.name || '特调史莱姆'}】，快来捏捏吧！`,
          showCancel: false,
        })
      }
    }
    catch (e) {}
  }
  loadArchives()
})

function handleResize() {
  // 渲染循环未启动时不处理 resize，避免与初始化竞态
  if (!isRunning)
    return

  const applyResize = (newWidth: number, newHeight: number) => {
    if (newWidth <= 0 || newHeight <= 0)
      return

    const oldCenterX = centerX
    const oldCenterY = centerY

    canvasWidth = newWidth
    canvasHeight = newHeight
    centerX = canvasWidth / 2
    centerY = canvasHeight / 2

    const dx = centerX - oldCenterX
    const dy = centerY - oldCenterY

    // 偏移所有物理粒子和配件实例，保持粒子间相对受力不变，平稳过渡
    if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) {
      particles.forEach((p) => {
        p.x += dx
        p.y += dy
      })
      decInstances.forEach((dec) => {
        dec.x += dx
        dec.y += dy
      })
      splashParticles.forEach((sp) => {
        sp.x += dx
        sp.y += dy
      })
    }

    resizeCanvasBuffers()
  }

  measureCanvasWrap((width, height) => {
    applyResize(width, height)
  })
}

let resizeTimer: any = null
function onResizeEvent() {
  // 渲染循环未启动时不处理 resize，避免 resize handler 与 canvas 初始化竞态冲突
  if (!isRunning)
    return
  if (resizeTimer)
    clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    handleResize()
  }, 150)
}

onReady(() => {
  if (currentMode.value === 'play') {
    initCanvasNodes()
  }

  // #ifdef H5
  window.addEventListener('resize', onResizeEvent)
  nextTick(() => {
    observeCanvasWrapResize()
  })
  // #endif

  // #ifndef H5
  uni.onWindowResize(onResizeEvent)
  // #endif
})

onHide(() => {
  stopRenderLoop()
})

onUnmounted(() => {
  // #ifdef H5
  window.removeEventListener('resize', onResizeEvent)
  canvasResizeObserver?.disconnect()
  canvasResizeObserver = null
  // #endif

  // #ifndef H5
  uni.offWindowResize(onResizeEvent)
  // #endif
})

onShareAppMessage(() => {
  const recipeObj = {
    name: `${currentMaterial.value.name}特调`,
    matId: currentMaterial.value.id,
    colA: colorA.value,
    colB: colorB.value,
    add: activeAddins.value,
  }
  const encodedRecipe = encodeURIComponent(JSON.stringify(recipeObj))
  return {
    title: `🎁 送你一罐我亲手调制的史莱姆，吧唧吧唧超解压！`,
    path: `/pages/slime/index?recipe=${encodedRecipe}`,
  }
})

function goBack() {
  uni.navigateBack({
    fail: () => {
      uni.switchTab({ url: '/pages/index/index' })
    },
  })
}

function resetStress() {
  stressRelief.value = 0
  isRelieved.value = false
  initPhysics()
}
</script>

<template>
  <view class="slime-page flex flex-col overflow-hidden bg-[#12121a] text-white">
    <!-- 纸屑飘花特效 -->
    <view v-if="confettiList.length > 0" class="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      <view
        v-for="item in confettiList"
        :key="item.id"
        class="confetti-item"
        :style="{
          left: item.left,
          backgroundColor: item.color,
          animationDelay: item.delay,
          width: item.size,
          height: item.size,
        }"
      />
    </view>

    <!-- 顶部状态栏 -->
    <view class="custom-header z-50 flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-12">
      <!-- 左侧：返回及极简标题 -->
      <view class="flex shrink-0 items-center gap-1" @click="goBack">
        <view class="h-7 w-7 flex items-center justify-center border border-[rgba(255,255,255,0.12)] rounded-full bg-[rgba(255,255,255,0.08)] transition-transform active:scale-95">
          <text class="i-carbon-chevron-left text-base text-white" />
        </view>
        <text class="ml-1 text-[30rpx] text-white font-bold tracking-wide">解压空间</text>
      </view>

      <!-- 中间：精简的药丸模式切换 -->
      <view class="flex items-center border border-[rgba(255,255,255,0.08)] rounded-full bg-[#1b1b26]/60 p-[2rpx] shadow-lg backdrop-blur">
        <view
          class="cursor-pointer rounded-full px-3 py-[6rpx] text-[20rpx] font-semibold tracking-wide transition-all duration-300 active:scale-95"
          :class="currentMode === 'play' ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-md text-white' : 'text-gray-400'"
          @click="toggleMode('play')"
        >
          捏捏
        </view>
        <view
          class="cursor-pointer rounded-full px-3 py-[6rpx] text-[20rpx] font-semibold tracking-wide transition-all duration-300 active:scale-95"
          :class="currentMode === 'shelf' ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-md text-white' : 'text-gray-400'"
          @click="toggleMode('shelf')"
        >
          陈列柜
        </view>
      </view>

      <!-- 右侧：极简压力百分比 & 进度条 -->
      <view class="flex shrink-0 items-center gap-1.5 overflow-visible">
        <text class="text-[18rpx] text-emerald-400 font-bold leading-none">{{ Math.round(stressRelief) }}%</text>
        <view class="relative h-1.5 w-12 overflow-visible rounded-full bg-gray-800">
          <view
            class="relative h-full rounded-full from-purple-500 to-cyan-400 bg-gradient-to-r transition-all duration-300"
            :style="{ width: `${stressRelief}%` }"
          >
            <!-- 渐变色进度条右端发光点 -->
            <view class="absolute h-2 w-2 animate-pulse rounded-full bg-white shadow-[0_0_6px_#38bdf8] -right-1 -top-[1rpx]" />
          </view>
        </view>
        <!-- 满格释放状态 -->
        <view
          v-if="isRelieved"
          class="h-5 w-5 flex animate-bounce cursor-pointer items-center justify-center border border-emerald-400/50 rounded-full bg-emerald-500/20 active:scale-90"
          @click="resetStress"
        >
          <text class="text-[10px] text-emerald-400">🎁</text>
        </view>
      </view>
    </view>

    <!-- 主交互区域 -->
    <view class="relative min-h-0 w-full flex flex-1 overflow-hidden">
      <!-- 游戏主区：捏史莱姆 -->
      <view v-if="currentMode === 'play'" class="relative h-full min-h-0 w-full flex flex-col overflow-hidden">
        <!-- 史莱姆 Canvas 容器：flex-1 占满顶部栏与底部面板之间的剩余空间 -->
        <view class="canvas-wrap relative min-h-0 w-full flex-1">
          <!-- 磨砂质感背景及暗淡指示线 -->
          <view class="absolute inset-4 flex flex-col items-center justify-center border border-[rgba(255,255,255,0.04)] rounded-3xl from-[#1b1b2a] to-[#0d0d15] bg-gradient-to-br shadow-2xl -z-10">
            <text class="pointer-events-none animate-pulse text-[24rpx] text-gray-500 font-light tracking-widest">
              单指戳破气泡，双指撕扯拉伸
            </text>
          </view>

          <!-- #ifndef H5 -->
          <!-- 底层 WebGL 3D 渲染画布 -->
          <canvas
            v-if="useWebGL"
            id="slimeCanvas"
            canvas-id="slimeCanvas"
            type="webgl"
            class="slime-canvas-host z-10"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          />
          <!-- 2D 降级底层渲染画布 (应用 CSS 滤镜以融合 Metaball) -->
          <view
            v-else
            class="slime-canvas-2d-filter absolute inset-0 z-10"
          >
            <canvas
              id="slimeCanvas2d"
              canvas-id="slimeCanvas2d"
              type="2d"
              class="slime-canvas-host"
              @touchstart="onTouchStart"
              @touchmove="onTouchMove"
              @touchend="onTouchEnd"
            />
          </view>

          <!-- 顶层 (无滤镜，保持配件、高光、溅落水花超清) -->
          <canvas
            id="decCanvas"
            canvas-id="decCanvas"
            type="2d"
            class="slime-canvas-host pointer-events-none z-20"
          />
          <!-- #endif -->

          <!-- 右侧悬浮胶囊工具栏 (Floating Toolbar) -->
          <view class="absolute right-4 top-1/2 z-30 w-[88rpx] flex flex-col items-center gap-5 border border-[rgba(255,255,255,0.08)] rounded-full bg-[#12121a]/85 px-2 py-4 shadow-2xl backdrop-blur-xl -translate-y-1/2">
            <!-- 静音切换 -->
            <view
              class="h-8 w-8 flex cursor-pointer items-center justify-center rounded-full transition-all active:scale-90"
              @click="toggleMute"
            >
              <text :class="isMuted ? 'i-carbon-volume-mute text-red-400' : 'i-carbon-volume-up text-white'" class="text-lg" />
            </view>
            <!-- 调色盘捷径 -->
            <view
              class="h-8 w-8 flex cursor-pointer items-center justify-center rounded-full transition-all active:scale-90"
              @click="activeTab = 'color'; isPanelCollapsed = false"
            >
              <text class="i-carbon-color-palette text-lg text-pink-400" />
            </view>
            <!-- 科普小知识 -->
            <view
              class="h-8 w-8 flex cursor-pointer items-center justify-center rounded-full transition-all active:scale-90"
              @click="showTips"
            >
              <text class="i-carbon-help text-lg text-amber-400" />
            </view>
            <!-- 收藏存入橱柜 -->
            <view
              class="h-8 w-8 flex cursor-pointer items-center justify-center rounded-full transition-all active:scale-90"
              @click="triggerSaveTab"
            >
              <text class="i-carbon-star text-lg text-emerald-400" />
            </view>
            <!-- 分享配方 -->
            <button
              open-type="share"
              class="line-none h-8 w-8 flex cursor-pointer items-center justify-center border-0 rounded-full bg-transparent p-0 shadow-none transition-all active:scale-90 after:border-0"
            >
              <text class="i-carbon-send text-lg text-indigo-400" />
            </button>
          </view>

          <!-- 左下角精致礼物盒悬浮分享按钮 -->
          <button
            open-type="share"
            class="absolute bottom-6 left-6 z-30 m-0 h-12 w-12 flex items-center justify-center border-0 rounded-full from-purple-600 via-pink-500 to-pink-400 bg-gradient-to-tr p-0 shadow-[0_4px_16px_rgba(236,72,153,0.4)] transition-transform active:scale-90 after:border-0"
          >
            <text class="text-xl leading-none">🎁</text>
          </button>
        </view>
      </view>

      <!-- 陈列柜区域 -->
      <scroll-view v-else scroll-y class="box-border h-full w-full bg-[#0d0d12] px-6 py-10">
        <view class="grid grid-cols-2 gap-6 pb-20">
          <view
            v-for="archive in slimeArchives"
            :key="archive.id"
            class="jar-card group relative flex flex-col items-center border border-[rgba(255,255,255,0.05)] rounded-2xl bg-[#161622] p-4 shadow-lg transition-transform active:scale-95"
            @click="selectArchive(archive)"
          >
            <!-- 删除按钮 -->
            <view
              class="absolute right-2 top-2 h-6 w-6 flex items-center justify-center rounded-full bg-red-500/10 active:bg-red-500/30"
              @click="deleteArchive(archive.id, $event)"
            >
              <text class="i-carbon-trash text-xs text-red-400" />
            </view>

            <!-- 呼吸发光玻璃罐 -->
            <view class="relative mb-2 mt-4 h-28 w-24 flex items-end justify-center">
              <!-- 罐体玻璃高光 -->
              <view class="absolute inset-0 border-2 border-[rgba(255,255,255,0.15)] rounded-2xl from-[rgba(255,255,255,0.06)] to-[rgba(255,255,255,0.02)] bg-gradient-to-b shadow-inner" />
              <!-- 罐盖 -->
              <view class="absolute left-6 right-6 h-3 border border-[rgba(255,255,255,0.1)] rounded-md from-amber-800 to-amber-700 bg-gradient-to-r -top-2" />
              <!-- 罐子里的缩微正弦波动效史莱姆 -->
              <view
                class="relative mb-[6rpx] h-[100rpx] w-[86rpx] animate-pulse overflow-hidden rounded-b-xl"
                :style="{ background: `linear-gradient(135deg, ${archive.colorA}, ${archive.colorB})` }"
              >
                <!-- 内部配件小颗粒缩微图 -->
                <view
                  v-if="archive.addins.includes('star')"
                  class="absolute left-2 top-2 animate-bounce text-[14rpx] text-yellow-300 opacity-60"
                >
                  ★
                </view>
                <view
                  v-if="archive.addins.includes('heart')"
                  class="absolute bottom-3 right-3 text-[14rpx] text-pink-500 opacity-60"
                >
                  ♥
                </view>
                <view
                  v-if="archive.addins.includes('strawberry')"
                  class="absolute right-2 top-4 text-[14rpx] opacity-60"
                >
                  🍓
                </view>
                <view
                  v-if="archive.addins.includes('lemon')"
                  class="absolute bottom-4 left-3 text-[14rpx] opacity-60"
                >
                  🍋
                </view>
              </view>
            </view>

            <!-- 史莱姆名字 -->
            <text class="mt-2 w-full truncate text-center text-sm text-gray-200 font-semibold tracking-wide">{{ archive.name }}</text>
            <text class="mt-1 text-[18rpx] text-gray-500">{{ archive.createdAt }}</text>
          </view>

          <!-- 空陈列柜占位 -->
          <view v-if="slimeArchives.length === 0" class="col-span-2 flex flex-col items-center justify-center gap-4 py-20">
            <text class="text-4xl text-gray-600 font-light">Empty</text>
            <text class="text-xs text-gray-500 font-medium">陈列柜还是空的，快去调制一罐吧！</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 底部 DIY 控制面板 -->
    <view
      v-if="currentMode === 'play'"
      class="diy-panel relative z-40 flex shrink-0 flex-col border-t border-[rgba(255,255,255,0.08)] rounded-t-3xl bg-[#151522]/95 px-5 shadow-[0_-8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300"
      :class="isPanelCollapsed ? 'h-[76rpx] pb-0 pt-1 overflow-hidden' : 'pb-4 pt-2 gap-3'"
    >
      <!-- 折叠/展开指示手柄 -->
      <view
        class="w-full flex cursor-pointer justify-center py-1 active:opacity-70"
        @click="isPanelCollapsed = !isPanelCollapsed"
      >
        <view class="h-[6rpx] w-12 rounded-full bg-white/20 transition-colors hover:bg-white/40" />
      </view>

      <!-- 折叠提示 -->
      <view v-if="isPanelCollapsed" class="w-full py-1 text-center text-[18rpx] text-gray-500 font-semibold" @click="isPanelCollapsed = false">
        展开 DIY 设置面板 ⚙️
      </view>

      <!-- 选项卡内容 (上移) -->
      <view v-show="!isPanelCollapsed" class="tab-content min-h-[140rpx] flex items-center">
        <!-- 1. 材质选择 (升级为 3D 水晶拟物渐变图标) -->
        <view v-if="activeTab === 'material'" class="w-full flex flex-col gap-1">
          <!-- 材质精简说明 -->
          <view class="w-full shrink-0 pb-1 text-center text-[20rpx] text-gray-400 tracking-wide">
            当前：<text class="text-purple-300 font-bold">{{ currentMaterial.name }}</text> · {{ currentMaterial.desc.split('・')[1] || currentMaterial.desc }}
          </view>
          <view class="w-full flex items-center justify-around gap-4 px-1 py-1">
            <!-- 水弹 -->
            <view
              class="flex flex-col items-center gap-1 transition-all duration-300 active:scale-95"
              @click="selectMaterial(materials[0])"
            >
              <view
                class="h-14 w-14 flex items-center justify-center border-2 rounded-full transition-all duration-300"
                :class="currentMaterial.id === 'water' ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_#22d3ee] scale-105' : 'border-[rgba(255,255,255,0.15)] bg-[#1e1e2d]'"
              >
                <!-- 3D 拟物渐变水滴 -->
                <svg viewBox="0 0 100 100" width="30" height="30">
                  <defs>
                    <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#38bdf8" />
                      <stop offset="100%" stop-color="#0284c7" />
                    </linearGradient>
                    <radialGradient id="waterHighlight" cx="35%" cy="35%" r="30%">
                      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8" />
                      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
                    </radialGradient>
                  </defs>
                  <!-- 水滴主体 -->
                  <path d="M50,15 C50,15 80,48 80,68 A30,30 0 1,1 20,68 C20,48 50,15 50,15 Z" fill="url(#waterGrad)" />
                  <!-- 顶部反光弧 -->
                  <ellipse cx="38" cy="60" rx="6" ry="12" transform="rotate(-30, 38, 60)" fill="url(#waterHighlight)" />
                  <!-- 底部小暗影 -->
                  <path d="M28,78 C35,84 65,84 72,78 C65,72 35,72 28,78 Z" fill="#0369a1" opacity="0.4" />
                </svg>
              </view>
              <text class="text-[20rpx] font-semibold tracking-wider" :class="currentMaterial.id === 'water' ? 'text-cyan-300 font-bold' : 'text-gray-400'">水弹</text>
            </view>

            <!-- 起泡胶 -->
            <view
              class="flex flex-col items-center gap-1 transition-all duration-300 active:scale-95"
              @click="selectMaterial(materials[1])"
            >
              <view
                class="h-14 w-14 flex items-center justify-center border-2 rounded-full transition-all duration-300"
                :class="currentMaterial.id === 'bubble' ? 'border-pink-400 bg-pink-950/40 shadow-[0_0_15px_#f472b6] scale-105' : 'border-[rgba(255,255,255,0.15)] bg-[#1e1e2d]'"
              >
                <!-- 3D 拟物渐变奶油云朵 -->
                <svg viewBox="0 0 100 100" width="32" height="32">
                  <defs>
                    <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#ffb199" />
                      <stop offset="100%" stop-color="#ff0844" />
                    </linearGradient>
                    <radialGradient id="cloudHighlight" cx="30%" cy="30%" r="35%">
                      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9" />
                      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
                    </radialGradient>
                  </defs>
                  <!-- 拟物云朵的重叠泡泡造型 -->
                  <path d="M25,65 C15,65 10,55 18,48 C12,38 25,25 35,32 C42,20 62,22 65,35 C75,32 85,42 80,52 C88,60 78,70 68,68 C58,75 35,74 25,65 Z" fill="url(#cloudGrad)" />
                  <!-- 顶部亮斑高光 -->
                  <circle cx="38" cy="40" r="8" fill="url(#cloudHighlight)" />
                  <circle cx="58" cy="42" r="10" fill="url(#cloudHighlight)" />
                </svg>
              </view>
              <text class="text-[20rpx] font-semibold tracking-wider" :class="currentMaterial.id === 'bubble' ? 'text-pink-300 font-bold' : 'text-gray-400'">起泡胶</text>
            </view>

            <!-- 牛头胶 -->
            <view
              class="flex flex-col items-center gap-1 transition-all duration-300 active:scale-95"
              @click="selectMaterial(materials[2])"
            >
              <view
                class="h-14 w-14 flex items-center justify-center border-2 rounded-full transition-all duration-300"
                :class="currentMaterial.id === 'clay' ? 'border-emerald-400 bg-emerald-950/40 shadow-[0_0_15px_#34d399] scale-105' : 'border-[rgba(255,255,255,0.15)] bg-[#1e1e2d]'"
              >
                <!-- 3D 拟物渐变胶水瓶 -->
                <svg viewBox="0 0 100 100" width="30" height="30">
                  <defs>
                    <linearGradient id="bottleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#10b981" />
                      <stop offset="50%" stop-color="#6ee7b7" />
                      <stop offset="100%" stop-color="#047857" />
                    </linearGradient>
                    <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#34d399" />
                      <stop offset="100%" stop-color="#065f46" />
                    </linearGradient>
                  </defs>
                  <!-- 胶水瓶身 -->
                  <rect x="34" y="45" width="32" height="40" rx="8" fill="url(#bottleGrad)" />
                  <!-- 瓶颈 -->
                  <rect x="42" y="35" width="16" height="10" fill="url(#capGrad)" />
                  <!-- 瓶嘴 (三角形) -->
                  <polygon points="45,35 55,35 50,22" fill="#ffffff" />
                  <!-- 瓶身上的微弱亮线 -->
                  <line x1="39" y1="48" x2="39" y2="80" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.6" />
                </svg>
              </view>
              <text class="text-[20rpx] font-semibold tracking-wider" :class="currentMaterial.id === 'clay' ? 'text-emerald-300 font-bold' : 'text-gray-400'">牛头胶</text>
            </view>
          </view>
        </view>

        <!-- 2. 无极调色盘 -->
        <view v-if="activeTab === 'color'" class="w-full flex flex-col gap-2">
          <view class="flex items-center gap-3">
            <!-- 渐变色预览 -->
            <view class="h-10 w-14 flex shrink-0 items-center justify-center border border-[rgba(255,255,255,0.15)] rounded-xl shadow-md" :style="{ background: `linear-gradient(135deg, ${colorA}, ${colorB})` }">
              <text class="rounded bg-black/40 px-1 text-[16rpx] text-white font-bold">预览</text>
            </view>
            <!-- 预设调色板 -->
            <scroll-view scroll-x class="flex-1 whitespace-nowrap">
              <view class="flex items-center gap-2 py-1">
                <view
                  v-for="color in presetColors"
                  :key="color"
                  class="inline-block h-6 w-6 shrink-0 border-2 rounded-full transition-transform active:scale-125"
                  :style="{ backgroundColor: color, borderColor: colorA === color || colorB === color ? '#ffffff' : 'transparent' }"
                  @click="colorA === color ? selectColor('B', color) : selectColor('A', color)"
                />
              </view>
            </scroll-view>
          </view>
          <text class="text-center text-[16rpx] text-gray-400 tracking-wide">点击小色球，可以混合主色与辅色，捏揉时色彩会融合！</text>
        </view>

        <!-- 3. 配件盲盒 -->
        <view v-if="activeTab === 'addins'" class="w-full">
          <scroll-view scroll-x class="w-full whitespace-nowrap">
            <view class="flex items-center gap-3 px-1 py-1">
              <view
                v-for="addin in addins"
                :key="addin.id"
                class="relative inline-block h-16 w-14 flex shrink-0 flex-col items-center justify-center gap-1 border rounded-xl pt-1 transition-all active:scale-95"
                :class="[
                  activeAddins.includes(addin.id) ? 'border-purple-500 bg-purple-500/10' : 'border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]',
                  addin.locked ? 'opacity-80' : '',
                ]"
                @click="toggleAddin(addin.id)"
              >
                <!-- 配件符号 -->
                <text class="text-lg leading-none" :style="{ color: addin.color }">{{ addin.icon }}</text>
                <!-- 配件名字 -->
                <text class="mt-0.5 block w-full pb-1 text-center text-[16rpx] text-gray-400 leading-none">{{ addin.name }}</text>
                <!-- 锁标签 -->
                <view v-if="addin.locked" class="absolute h-4 w-4 flex items-center justify-center border border-[#161622] rounded-full bg-amber-500 -right-1 -top-1">
                  <text class="i-carbon-locked text-[12rpx] text-black" />
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>

      <!-- 选项卡导航 (下移) -->
      <view v-show="!isPanelCollapsed" class="flex items-center justify-around border-t border-[rgba(255,255,255,0.06)] pt-2.5">
        <view
          class="flex flex-col cursor-pointer items-center gap-1 transition-transform active:scale-95"
          @click="activeTab = 'material'"
        >
          <text class="text-[22rpx] font-semibold tracking-wider" :class="activeTab === 'material' ? 'text-purple-400' : 'text-gray-400'">基底材质</text>
          <view class="h-[3rpx] w-4 rounded-full" :class="activeTab === 'material' ? 'bg-purple-400' : 'bg-transparent'" />
        </view>
        <view
          class="flex flex-col cursor-pointer items-center gap-1 transition-transform active:scale-95"
          @click="activeTab = 'color'"
        >
          <text class="text-[22rpx] font-semibold tracking-wider" :class="activeTab === 'color' ? 'text-purple-400' : 'text-gray-400'">无极调色</text>
          <view class="h-[3rpx] w-4 rounded-full" :class="activeTab === 'color' ? 'bg-purple-400' : 'bg-transparent'" />
        </view>
        <view
          class="flex flex-col cursor-pointer items-center gap-1 transition-transform active:scale-95"
          @click="activeTab = 'addins'"
        >
          <text class="text-[22rpx] font-semibold tracking-wider" :class="activeTab === 'addins' ? 'text-purple-400' : 'text-gray-400'">添加配件</text>
          <view class="h-[3rpx] w-4 rounded-full" :class="activeTab === 'addins' ? 'bg-purple-400' : 'bg-transparent'" />
        </view>
        <view
          class="flex flex-col cursor-pointer items-center gap-1 transition-transform active:scale-95"
          @click="triggerSaveTab"
        >
          <text class="text-[22rpx] text-emerald-400 font-semibold tracking-wider" :class="activeTab === 'save' ? 'text-purple-400' : 'text-emerald-400'">存入橱柜</text>
          <view class="h-[3rpx] w-4 rounded-full" :class="activeTab === 'save' ? 'bg-purple-400' : 'bg-transparent'" />
        </view>
      </view>
    </view>

    <!-- 弹窗：存入陈列柜 -->
    <view v-if="showSavePopup" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm">
      <view class="animate-scaleUp w-full flex flex-col gap-4 border border-[rgba(255,255,255,0.08)] rounded-3xl bg-[#1b1b28] p-6">
        <text class="text-center text-lg text-purple-300 font-bold tracking-wide">命名你的史莱姆 🏺</text>
        <input
          v-model="newSlimeName"
          placeholder="给这罐可爱的史莱姆起个名字..."
          placeholder-class="text-gray-600 text-sm"
          class="w-full border border-[rgba(255,255,255,0.08)] rounded-xl bg-[#111119] px-4 py-3 text-sm text-white focus:border-purple-500"
          type="text"
          maxlength="15"
        >
        <view class="mt-2 flex items-center gap-3">
          <view
            class="flex-1 cursor-pointer rounded-xl bg-gray-800 py-3 text-center text-sm font-semibold transition-opacity active:opacity-80"
            @click="cancelSave"
          >
            取消
          </view>
          <view
            class="flex-1 cursor-pointer rounded-xl from-purple-500 to-pink-500 bg-gradient-to-r py-3 text-center text-sm text-white font-semibold shadow-lg transition-transform active:scale-95"
            @click="saveSlime"
          >
            保存入柜
          </view>
        </view>
      </view>
    </view>

    <!-- 弹窗：模拟看广告解锁 -->
    <view v-if="showAdsPopup" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-6 backdrop-blur-md">
      <view class="relative max-w-[560rpx] w-full flex flex-col items-center gap-5 overflow-hidden border border-amber-500/20 rounded-3xl bg-[#161622] p-6">
        <!-- 发光装饰背景 -->
        <view class="absolute top-0 h-1 w-full from-amber-500 via-yellow-400 to-amber-500 bg-gradient-to-r" />

        <!-- 电视/广告图标 -->
        <view class="h-14 w-14 flex items-center justify-center border border-amber-500/30 rounded-full bg-amber-500/10">
          <text class="i-carbon-video text-2xl text-amber-500" />
        </view>

        <view class="text-center">
          <text class="block text-base text-gray-200 font-bold">看一次激励视频解锁配件</text>
          <text class="mt-2 block text-xs text-gray-500">解锁配件：{{ adTargetAddin?.name }}</text>
        </view>

        <!-- 3秒广告播放倒计时动画 -->
        <view class="relative h-24 w-24 flex items-center justify-center border-4 border-amber-500/20 rounded-full">
          <view class="absolute inset-0 animate-spin border-4 border-amber-500 border-t-transparent rounded-full" />
          <text class="text-2xl text-amber-500 font-bold">{{ adCountdown }}s</text>
        </view>

        <text class="text-xs text-gray-600">模拟广告播放中，请稍后...</text>

        <!-- 播放完后出现的关闭按钮 -->
        <button
          v-if="adCountdown <= 0"
          class="w-full animate-bounce border-0 rounded-xl bg-amber-500 py-3 text-sm text-black font-bold tracking-wide shadow-lg"
          @click="unlockAddin"
        >
          立即解锁
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.slime-page {
  height: 100vh;
  height: 100dvh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

.slime-canvas-2d-filter {
  filter: blur(8px) contrast(30);
  mix-blend-mode: screen;
  background: transparent;
}

.canvas-wrap {
  position: relative;
  overflow: hidden;
}

.h5-slime-canvas {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
}

.slime-canvas-host {
  position: absolute;
  left: 0;
  top: 0;
}

/* 罐体微卡片特效 */
.jar-card {
  perspective: 1000px;
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 1rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transition: opacity 0.3s;
  }
  &:active::after {
    opacity: 1;
  }
}

@keyframes scaleUp {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-scaleUp {
  animation: scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.confetti-item {
  position: absolute;
  top: -20px;
  border-radius: 3px;
  opacity: 0.85;
  animation: fall 3.5s linear forwards;
}

@keyframes fall {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  50% {
    opacity: 0.9;
  }
  100% {
    transform: translateY(105vh) rotate(720deg) scale(0.6);
    opacity: 0;
  }
}
</style>
