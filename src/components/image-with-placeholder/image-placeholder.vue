<script lang="ts" setup>
import { ref, watch } from 'vue'

interface Props {
  src?: string
  mode?: 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix' | 'top' | 'bottom' | 'center' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right'
  lazyLoad?: boolean
  webp?: boolean
  className?: string
  style?: string | Record<string, string>
  /** 为 true 时不渲染真实图片，仅展示与加载失败时相同的灰底+水印占位（用于视区外占位等） */
  placeholderOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  mode: 'widthFix',
  lazyLoad: true,
  webp: false,
  className: '',
  style: '',
  placeholderOnly: false,
})

const emit = defineEmits<{
  load: [payload: { width: number, height: number }]
}>()

/** 全局已成功加载的 src 集合，组件实例重建时可直接跳过占位图 */
const _loadedSrcCache = new Set<string>()

const imgSrcVal = ref(props.src)
const isErrorVal = ref(!props.src)
const isLoaded = ref(!!props.src && _loadedSrcCache.has(props.src))

watch(() => props.src, (newSrc) => {
  imgSrcVal.value = newSrc
  isErrorVal.value = !newSrc
  isLoaded.value = !!newSrc && _loadedSrcCache.has(newSrc)
})

function handleError() {
  isErrorVal.value = true
}

function handleLoad(e: { detail?: { width?: number, height?: number } }) {
  isErrorVal.value = false
  isLoaded.value = true
  if (imgSrcVal.value) {
    _loadedSrcCache.add(imgSrcVal.value)
  }
  const width = e.detail?.width ?? 0
  const height = e.detail?.height ?? 0
  if (width > 0 && height > 0) {
    emit('load', { width, height })
  }
}
</script>

<template>
  <view :style="style" :class="className" class="relative overflow-hidden">
    <view
      v-if="placeholderOnly || isErrorVal || !imgSrcVal || !isLoaded"
      class="absolute inset-0 z-[1] bg-[#f5f5f5]"
    >
      <image
        class="absolute left-1/2 top-1/2 h-auto w-[75%] opacity-10 -translate-x-1/2 -translate-y-1/2"
        src="@/static/images/logo.png"
        mode="widthFix"
      />
    </view>
    <image
      v-if="!placeholderOnly && imgSrcVal"
      :src="imgSrcVal"
      class="block h-full w-full"
      :mode="mode"
      :lazy-load="lazyLoad"
      :webp="webp"
      @error="handleError"
      @load="handleLoad"
    />
  </view>
</template>

<style scoped lang="scss">
</style>
