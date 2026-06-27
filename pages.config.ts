import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages'
import { tabBar } from './src/tabbar/config'

export default defineUniPages({
  globalStyle: {
    navigationStyle: 'custom',
    navigationBarTitleText: '',
    navigationBarBackgroundColor: '#f8f8f8',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FFFFFF',
  },
  easycom: {
    autoscan: true,
    custom: {
      '^common-header$': '@/components/commonHeader/commonHeader.vue',
      '^custom-title$': '@/components/custom-title/custom-title.vue',
      '^preview-panel$': '@/components/preview-panel/preview-panel.vue',
      '^right-interaction-panel$': '@/components/right-interaction-panel/right-interaction-panel.vue',
      '^video-controls$': '@/components/video-controls/video-controls.vue',
      '^bottom-tab-bar$': '@/components/bottom-tab-bar/bottom-tab-bar.vue',
      '^confirm-popup$': '@/components/confirmPopup/confirmPopup.vue',
      '^fg-(.*)': '@/components/fg-$1/fg-$1.vue',
      '^ImagePlaceholder$': '@/components/image-with-placeholder/image-placeholder.vue',
      '^(?!z-paging-refresh|z-paging-load-more)z-paging(.*)':
        'z-paging/components/z-paging$1/z-paging$1.vue',
      '^u-(.*)': 'uview-pro/components/u-$1/u-$1.vue',
      '^swiper-dynamic-bullets$': '@/uni_modules/my-swiper-dynamic-bullets/components/swiper-dynamic-bullets/swiper-dynamic-bullets.vue',
    },
  },
  // tabbar 的配置统一在 “./src/tabbar/config.ts” 文件中
  tabBar: tabBar as any,
})
