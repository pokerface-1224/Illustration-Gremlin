<template>
  <div class="tmk-gallery">
    <div v-if="images.length" class="tmk-grid">
      <div
        v-for="image in images"
        :key="image"
        class="tmk-grid-item"
        :class="{ 'tmk-item-selected': selectedSet.has(image) }"
      >
        <button
          class="tmk-thumb-button"
          type="button"
          :class="{ 'tmk-thumb-select': selectMode }"
          @click="onThumbClick(image)"
        >
          <SandboxThumb :character="character" :path="image" />
          <span v-if="selectMode" class="tmk-checkbox" :class="{ 'tmk-checkbox-checked': selectedSet.has(image) }">
            <i v-if="selectedSet.has(image)" class="fa-solid fa-check"></i>
          </span>
        </button>
        <div v-if="!selectMode" class="tmk-grid-overlay">
          <button
            v-if="allowRename"
            class="tmk-action tmk-rename"
            type="button"
            :title="t`重命名`"
            @click.stop="emit('rename', image)"
          >
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="tmk-action tmk-delete" type="button" :title="t`删除`" @click.stop="emit('delete', image)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
    <div v-else class="tmk-empty">{{ t`暂无插图` }}</div>

    <!-- 大图预览 -->
    <div v-if="selectedIndex >= 0 && currentImage" class="tmk-lightbox" @click.self="closeLightbox">
      <button class="tmk-nav tmk-nav-prev" type="button" :title="t`上一张`" @click="prev">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <img class="tmk-lightbox-img" :src="selectedUrl" :alt="currentImage" @error="onLightboxError" />
      <button class="tmk-nav tmk-nav-next" type="button" :title="t`下一张`" @click="next">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
      <button class="tmk-lightbox-close" type="button" :title="t`关闭`" @click="closeLightbox">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import SandboxThumb from '@/SandboxThumb.vue';
import { readCharacterImage } from '@/util/illustrations';

const props = defineProps<{
  character: string;
  /** 相对角色目录的图片路径列表 */
  images: string[];
  /** 是否进入选择模式 (缩略图点击切换勾选, 隐藏悬停操作) */
  selectMode?: boolean;
  /** 选择模式下已勾选的路径 */
  selectedPaths?: string[];
  /** 浏览模式下是否显示“重命名”操作 */
  allowRename?: boolean;
}>();

const emit = defineEmits<{
  delete: [path: string];
  rename: [path: string];
  toggle: [path: string];
  lightbox: [open: boolean];
}>();

const selectedIndex = ref(-1);
const selectedUrl = ref('');

const selectedSet = computed(() => new Set(props.selectedPaths ?? []));
const currentImage = computed(() => props.images[selectedIndex.value] ?? '');

function openImage(path: string) {
  selectedIndex.value = props.images.indexOf(path);
}

function closeLightbox() {
  selectedIndex.value = -1;
}

function prev() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--;
  }
}

function next() {
  if (selectedIndex.value < props.images.length - 1) {
    selectedIndex.value++;
  }
}

function onThumbClick(path: string) {
  if (props.selectMode) {
    emit('toggle', path);
    return;
  }
  openImage(path);
}

function onLightboxError() {
  if (selectedUrl.value) {
    URL.revokeObjectURL(selectedUrl.value);
    selectedUrl.value = '';
  }
}

watch(
  currentImage,
  async path => {
    if (selectedUrl.value) {
      URL.revokeObjectURL(selectedUrl.value);
      selectedUrl.value = '';
    }
    if (!path) return;
    try {
      const blob = await readCharacterImage(props.character, path);
      if (blob && path === currentImage.value) {
        selectedUrl.value = URL.createObjectURL(blob);
      }
    } catch {
      // 读取失败时保持空白
    }
  },
  { immediate: true },
);

// 删除后图片列表变化时, 修正选中索引并同步灯箱状态
watch(
  () => props.images.length,
  length => {
    if (selectedIndex.value >= length) {
      selectedIndex.value = length - 1;
    }
  },
);

watch(selectedIndex, index => {
  emit('lightbox', index >= 0 && !!props.images[index]);
});

useEventListener(window, 'keydown', event => {
  if (selectedIndex.value < 0) return;
  if (event.key === 'Escape') {
    event.stopImmediatePropagation();
    closeLightbox();
  } else if (event.key === 'ArrowLeft') {
    prev();
  } else if (event.key === 'ArrowRight') {
    next();
  }
});

onBeforeUnmount(() => {
  if (selectedUrl.value) {
    URL.revokeObjectURL(selectedUrl.value);
  }
});
</script>

<style scoped>
.tmk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.tmk-grid-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.18);
}

.tmk-item-selected {
  box-shadow: inset 0 0 0 2px #4caf50;
}

.tmk-thumb-button {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
}

.tmk-thumb-select {
  cursor: pointer;
}

.tmk-checkbox {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}

.tmk-checkbox-checked {
  background: #4caf50;
}

.tmk-grid-overlay {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tmk-grid-item:hover .tmk-grid-overlay {
  opacity: 1;
}

.tmk-action {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tmk-action:hover {
  background: #d32f2f;
}

.tmk-rename:hover {
  background: #f0a35e;
}

.tmk-empty {
  color: #999;
  text-align: center;
  margin-top: 40px;
}

.tmk-lightbox {
  position: fixed;
  inset: 0;
  z-index: 30001;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.92);
}

.tmk-lightbox-img {
  max-width: 88vw;
  max-height: 88vh;
  object-fit: contain;
  border-radius: 4px;
}

.tmk-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 72px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
}

.tmk-nav:hover {
  background: rgba(255, 255, 255, 0.2);
}

.tmk-nav-prev {
  left: 16px;
}

.tmk-nav-next {
  right: 16px;
}

.tmk-lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}

.tmk-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.25);
}
</style>
