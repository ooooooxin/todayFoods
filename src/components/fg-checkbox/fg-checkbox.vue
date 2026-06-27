<script lang="ts" setup>
interface Props {
  modelValue: boolean
  size?: string
  onIcon?: string
  offIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: '40rpx',
  onIcon: '/static/images/ic_checkbox_on.png',
  offIcon: '/static/images/ic_checkbox_off.png',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <image
    class="fg-checkbox"
    :style="{ width: size, height: size }"
    :src="modelValue ? onIcon : offIcon"
    mode="aspectFit"
    @click.stop="toggle"
  />
</template>
