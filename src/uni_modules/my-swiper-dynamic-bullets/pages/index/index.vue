<template>
	<view class="" >
		<view style="position: relative;">
			<!-- 轮播图部分 -->
			<swiper :interval="3000" :duration="200" @change="onChange">
				<block v-for="i in data">
					<swiper-item>
						<view class="swiper-item">
							{{i}}
						</view>
					</swiper-item>
				</block>
			</swiper>

			<!-- 指示点 --> 
			<sdp :resdata="data" :currentIndex="swiperIndex" class="my-sdp"></sdp>
		</view>
	</view>
</template>

<script>
	import sdp from '@/components/swiper-dynamic-bullets/swiper-dynamic-bullets.vue';
	export default {
		components: {
			sdp
		},
		data() {
			return {
				data:[1,2,3,4,5,6,7,8,9],
				swiperIndex:0
			}
		},
		onLoad() {

		},
		
		methods: {
			onChange(e){
				this.swiperIndex = e.detail.current
			}
		}
	}
</script>

<style lang="scss">
	*{
		box-sizing: border-box;
	}
	.my-sdp{
		left: 50%;
		bottom: 20px;
	}
	// 轮播图部分
	.swiper-item{
		background-color: #4CD964;
		height: 100%;
	}

	
</style>
