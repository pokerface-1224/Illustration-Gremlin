<template>
  <img
    v-if="url"
    ref="element"
    class="tmk-thumb"
    :src="url"
    :alt="path"
    @error="onError"
  />
  <div v-else ref="element" class="tmk-thumb tmk-thumb-placeholder"></div>
</template>

<script setup lang="ts">
import { readCharacterImage } from '@/util/illustrations';

const props = defineProps<{ character: string; path: string }>();

const url = ref('');
const element = ref<HTMLElement | null>(null);

async function load() {
  if (url.value) return;
  try {
    const blob = await readCharacterImage(props.character, props.path);
    if (!blob) return;
    url.value = URL.createObjectURL(blob);
  } catch {
    // 读取失败时保留占位
  }
}

function onError() {
  if (url.value) {
    URL.revokeObjectURL(url.value);
    url.value = '';
  }
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    void load();
    return;
  }
  const observer = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        void load();
      }
    },
    { rootMargin: '300px' },
  );
  if (element.value) {
    observer.observe(element.value);
  }
});

onBeforeUnmount(() => {
  if (url.value) {
    URL.revokeObjectURL(url.value);
  }
});
</script>

<style scoped>
.tmk-thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.tmk-thumb-placeholder {
  background: transparent;
}
</style>
