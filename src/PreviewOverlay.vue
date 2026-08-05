<template>
  <Teleport to="body">
    <div class="tmk-overlay">
      <div class="tmk-overlay-header">
        <span class="tmk-overlay-title">{{ t`插图预览` }} · {{ character }}</span>
        <span class="tmk-overlay-count">{{ images.length }} 张</span>
        <button class="menu_button tmk-overlay-close" type="button" @click="close">
          {{ t`关闭` }}
        </button>
      </div>

      <div class="tmk-overlay-body">
        <div v-if="images.length" class="tmk-grid">
          <div v-for="image in images" :key="image" class="tmk-grid-item">
            <button class="tmk-thumb-button" type="button" @click="openImage(image)">
              <SandboxThumb :character="character" :path="image" />
            </button>
            <div class="tmk-grid-overlay">
              <button class="tmk-delete" type="button" :title="t`删除`" @click="onDelete(image)">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
        <div v-else class="tmk-empty">{{ t`暂无插图` }}</div>
      </div>

      <!-- 大图预览 -->
      <div
        v-if="selectedIndex >= 0 && currentImage"
        class="tmk-lightbox"
        @click.self="selectedIndex = -1"
      >
        <button class="tmk-nav tmk-nav-prev" type="button" title="‹" @click="prev">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <img class="tmk-lightbox-img" :src="selectedUrl" :alt="currentImage" @error="onLightboxError" />
        <button class="tmk-nav tmk-nav-next" type="button" title="›" @click="next">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        <button class="tmk-lightbox-close" type="button" @click="selectedIndex = -1">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import SandboxThumb from '@/SandboxThumb.vue';
import { readCharacterImage } from '@/util/illustrations';

const props = defineProps<{
  character: string;
  images: string[];
}>();

const emit = defineEmits<{
  close: [];
  delete: [path: string];
}>();

const selectedIndex = ref(-1);
const selectedUrl = ref('');

const currentImage = computed(() => props.images[selectedIndex.value] ?? '');

function close() {
  emit('close');
}

function openImage(path: string) {
  selectedIndex.value = props.images.indexOf(path);
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

function onDelete(path: string) {
  emit('delete', path);
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

// 删除后图片列表变化时, 修正选中索引
watch(
  () => props.images.length,
  length => {
    if (selectedIndex.value >= length) {
      selectedIndex.value = length - 1;
    }
  },
);

useEventListener(window, 'keydown', event => {
  if (event.key === 'Escape') {
    if (selectedIndex.value >= 0) {
      selectedIndex.value = -1;
    } else {
      close();
    }
  } else if (selectedIndex.value >= 0) {
    if (event.key === 'ArrowLeft') prev();
    if (event.key === 'ArrowRight') next();
  }
});

onBeforeUnmount(() => {
  if (selectedUrl.value) {
    URL.revokeObjectURL(selectedUrl.value);
  }
});
</script>

<style scoped>
.tmk-overlay {
  position: fixed;
  inset: 0;
  z-index: 30000;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.88);
}

.tmk-overlay-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(30, 30, 30, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}

.tmk-overlay-title {
  flex: 1;
  font-weight: bold;
  color: #eee;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tmk-overlay-count {
  color: #aaa;
  font-size: 0.9em;
}

.tmk-overlay-close {
  flex-shrink: 0;
}

.tmk-overlay-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.tmk-empty {
  color: #999;
  text-align: center;
  margin-top: 40px;
}

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

.tmk-thumb-button {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
}

.tmk-grid-overlay {
  position: absolute;
  top: 6px;
  right: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tmk-grid-item:hover .tmk-grid-overlay {
  opacity: 1;
}

.tmk-delete {
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

.tmk-delete:hover {
  background: #d32f2f;
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
