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
        <ImageGallery :character="character" :images="images" @delete="onDelete" @lightbox="onLightboxChange" />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import ImageGallery from '@/ImageGallery.vue';

defineProps<{
  character: string;
  images: string[];
}>();

const emit = defineEmits<{
  close: [];
  delete: [path: string];
}>();

const lightboxOpen = ref(false);

function close() {
  emit('close');
}

function onDelete(path: string) {
  emit('delete', path);
}

function onLightboxChange(open: boolean) {
  lightboxOpen.value = open;
}

useEventListener(window, 'keydown', event => {
  // 灯箱打开时由 ImageGallery 先处理 Esc; 未打开时关闭整个预览页
  if (event.key === 'Escape' && !lightboxOpen.value) {
    close();
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
</style>
