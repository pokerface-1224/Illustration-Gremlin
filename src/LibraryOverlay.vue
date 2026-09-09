<template>
  <Teleport to="body">
    <div class="tmk-overlay">
      <div class="tmk-overlay-header">
        <span class="tmk-overlay-title">
          <template v-if="selectedCharacter">
            <button class="menu_button tmk-back-button" type="button" @click="goBack">
              <i class="fa-solid fa-arrow-left"></i>
              {{ t`返回` }}
            </button>
            <span class="tmk-character-title">{{ selectedCharacter }}</span>
            <span class="tmk-overlay-subtitle">{{ galleryImages.length }} 张</span>
          </template>
          <template v-else>
            {{ t`全部角色插图` }}
            <span v-if="characters.length" class="tmk-overlay-subtitle">
              {{ characters.length }} 个角色 · {{ totalImageCount }} 张
            </span>
          </template>
        </span>
        <button v-if="!selectedCharacter" class="menu_button" type="button" :disabled="busy" @click="onRefresh">
          <i class="fa-solid fa-rotate"></i>
          {{ t`刷新` }}
        </button>
        <button class="menu_button tmk-overlay-close" type="button" @click="close">
          {{ t`关闭` }}
        </button>
      </div>

      <div class="tmk-overlay-body">
        <!-- 角色列表 -->
        <div v-if="!selectedCharacter" class="tmk-library-body">
          <div v-if="characters.length" class="tmk-character-list">
            <div v-for="item in characters" :key="item.name" class="tmk-character-row">
              <button class="tmk-character-open" type="button" @click="openCharacter(item.name)">
                <span class="tmk-character-name">{{ item.name }}</span>
                <span class="tmk-character-meta">
                  <span class="tmk-character-count">{{ item.images.length }} 张</span>
                  <span class="tmk-character-view">
                    {{ t`查看` }}
                    <i class="fa-solid fa-chevron-right"></i>
                  </span>
                </span>
              </button>
              <button
                class="menu_button tmk-danger-button tmk-clear-character"
                type="button"
                :disabled="busy"
                @click="onClearCharacter(item.name)"
              >
                {{ t`清空` }}
              </button>
            </div>
          </div>
          <div v-else class="tmk-empty">{{ t`暂无插图` }}</div>
        </div>

        <!-- 单个角色的插图管理 -->
        <div v-else class="tmk-library-gallery">
          <div class="tmk-gallery-toolbar">
            <template v-if="!selectionMode">
              <button
                class="menu_button"
                type="button"
                :disabled="galleryImages.length === 0"
                @click="enterSelectionMode"
              >
                {{ t`选择` }}
              </button>
              <button
                class="menu_button tmk-danger-button"
                type="button"
                :disabled="busy || galleryImages.length === 0"
                @click="onClearSelectedCharacter"
              >
                {{ t`清空全部` }}
              </button>
            </template>
            <template v-else>
              <button class="menu_button" type="button" @click="toggleSelectAll">
                {{ allSelected ? t`取消全选` : t`全选` }}
              </button>
              <span class="tmk-selection-count">{{ t`已选 ${selectedPaths.length} 张` }}</span>
              <button
                class="menu_button tmk-danger-button"
                type="button"
                :disabled="selectedPaths.length === 0"
                @click="onDeleteSelected"
              >
                {{ t`删除选中` }}
              </button>
              <button class="menu_button" type="button" @click="exitSelectionMode">
                {{ t`取消选择` }}
              </button>
            </template>
          </div>

          <ImageGallery
            :character="selectedCharacter"
            :images="galleryImages"
            :select-mode="selectionMode"
            :selected-paths="selectedPaths"
            allow-rename
            @delete="onDeleteImage"
            @rename="onRenameImage"
            @toggle="toggleImage"
            @lightbox="onLightboxChange"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import ImageGallery from '@/ImageGallery.vue';
import { syncAfterImageChange } from '@/util/imageSync';
import {
  deleteAllCharacterImages,
  deleteCharacterImage,
  isImageFileName,
  listAllImages,
  renameCharacterImage,
} from '@/util/illustrations';

type CharacterImages = {
  name: string;
  images: string[];
};

const emit = defineEmits<{
  close: [];
}>();

const characters = ref<CharacterImages[]>([]);
const selectedCharacter = ref<string | null>(null);
const galleryImages = ref<string[]>([]);
const selectionMode = ref(false);
const selectedPaths = ref<string[]>([]);
const lightboxOpen = ref(false);
const busy = ref(false);

const totalImageCount = computed(() => characters.value.reduce((sum, item) => sum + item.images.length, 0));
const allSelected = computed(
  () => galleryImages.value.length > 0 && selectedPaths.value.length === galleryImages.value.length,
);

function close() {
  emit('close');
}

function goBack() {
  selectedCharacter.value = null;
  exitSelectionMode();
}

async function reloadLibrary() {
  try {
    const entries = await listAllImages();
    const grouped = new Map<string, string[]>();
    for (const entry of entries) {
      const images = grouped.get(entry.character);
      if (images) {
        images.push(entry.relativePath);
      } else {
        grouped.set(entry.character, [entry.relativePath]);
      }
    }
    characters.value = Array.from(grouped, ([name, images]) => ({ name, images })).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
  } catch (error) {
    console.warn('[Illustration-Gremlin] 读取全部插图列表失败:', error);
    characters.value = [];
  }
}

function applySelectionState() {
  if (!selectedCharacter.value) return;
  const item = characters.value.find(item => item.name === selectedCharacter.value);
  if (!item) {
    selectedCharacter.value = null;
    exitSelectionMode();
    return;
  }
  galleryImages.value = item.images;
  const available = new Set(item.images);
  selectedPaths.value = selectedPaths.value.filter(path => available.has(path));
}

async function reloadAndSync() {
  await reloadLibrary();
  applySelectionState();
  syncAfterImageChange();
}

async function onRefresh() {
  if (busy.value) return;
  busy.value = true;
  try {
    await reloadLibrary();
    applySelectionState();
  } finally {
    busy.value = false;
  }
}

function openCharacter(name: string) {
  const item = characters.value.find(item => item.name === name);
  if (!item) return;
  selectedCharacter.value = name;
  galleryImages.value = item.images;
  exitSelectionMode();
}

function enterSelectionMode() {
  selectionMode.value = true;
  selectedPaths.value = [];
}

function exitSelectionMode() {
  selectionMode.value = false;
  selectedPaths.value = [];
}

function toggleImage(path: string) {
  const index = selectedPaths.value.indexOf(path);
  if (index >= 0) {
    selectedPaths.value = selectedPaths.value.filter(item => item !== path);
  } else {
    selectedPaths.value = [...selectedPaths.value, path];
  }
}

function toggleSelectAll() {
  selectedPaths.value = allSelected.value ? [] : [...galleryImages.value];
}

function onLightboxChange(open: boolean) {
  lightboxOpen.value = open;
}

function confirmClearMessage(name: string, count: number): boolean {
  return confirm(t`清空「${name}」的全部 ${count} 张插图？此操作不可恢复。`);
}

async function onDeleteImage(path: string) {
  const character = selectedCharacter.value;
  if (!character || busy.value) return;
  if (!confirm(t`确定删除图片 ${path} 吗？`)) return;

  busy.value = true;
  try {
    await deleteCharacterImage(character, path);
    toastr.success(t`已删除 ${path}`);
    await reloadAndSync();
  } catch (error) {
    toastr.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

async function onDeleteSelected() {
  const character = selectedCharacter.value;
  if (!character || busy.value || selectedPaths.value.length === 0) return;
  const count = selectedPaths.value.length;
  if (!confirm(t`确定删除选中的 ${count} 张图片吗？`)) return;

  const paths = [...selectedPaths.value];
  busy.value = true;
  try {
    let deleted = 0;
    for (const path of paths) {
      try {
        await deleteCharacterImage(character, path);
        deleted += 1;
      } catch (error) {
        console.warn('[Illustration-Gremlin] 删除图片失败:', path, error);
      }
    }
    toastr.success(t`已删除 ${deleted} 张图片`);
    await reloadAndSync();
  } finally {
    busy.value = false;
  }
}

async function onClearCharacter(name: string) {
  if (busy.value) return;
  const item = characters.value.find(item => item.name === name);
  if (!item) return;
  if (!confirmClearMessage(name, item.images.length)) return;

  busy.value = true;
  try {
    const deleted = await deleteAllCharacterImages(name);
    toastr.success(t`已清空 ${deleted} 张插图`);
    if (selectedCharacter.value === name) {
      selectedCharacter.value = null;
      exitSelectionMode();
    }
    await reloadAndSync();
  } catch (error) {
    toastr.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

function onClearSelectedCharacter() {
  if (!selectedCharacter.value) return;
  void onClearCharacter(selectedCharacter.value);
}

function validateNewFileName(name: string): string | null {
  if (!name) return t`文件名不能为空`;
  if (name.includes('/') || name.includes('\\')) return t`文件名不能包含路径分隔符`;
  if (/[<>:"/\\|?*]/.test(name)) return t`文件名包含非法字符`;
  if (!isImageFileName(name)) return t`文件名必须是受支持的图片格式`;
  return null;
}

function hasSameNameInCurrentDirectory(newName: string, path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  const oldName = parts.pop();
  if (!oldName) return false;
  const dirPrefix = parts.join('/');
  return galleryImages.value.some(other => {
    if (other === path) return false;
    const otherParts = other.split('/').filter(Boolean);
    const otherName = otherParts.pop();
    return otherName?.toLowerCase() === newName.toLowerCase() && otherParts.join('/') === dirPrefix;
  });
}

async function onRenameImage(path: string) {
  const character = selectedCharacter.value;
  if (!character || busy.value) return;
  const oldFileName = path.split('/').filter(Boolean).pop() ?? path;
  const input = prompt(t`为图片输入新文件名`, oldFileName);
  if (input === null) return;
  const newName = input.trim();
  if (!newName || newName === oldFileName) return;

  const validationError = validateNewFileName(newName);
  if (validationError) {
    toastr.error(validationError);
    return;
  }
  if (hasSameNameInCurrentDirectory(newName, path)) {
    toastr.error(t`同名文件已存在`);
    return;
  }

  busy.value = true;
  try {
    const newPath = await renameCharacterImage(character, path, newName);
    toastr.success(t`已重命名为 ${newPath}`);
    await reloadAndSync();
  } catch (error) {
    toastr.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

useEventListener(window, 'keydown', event => {
  if (event.key !== 'Escape') return;
  // 灯箱打开时由 ImageGallery 先关闭灯箱
  if (lightboxOpen.value) return;
  if (selectedCharacter.value) {
    goBack();
  } else {
    close();
  }
});

onMounted(() => {
  void reloadLibrary();
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
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: bold;
  color: #eee;
  min-width: 0;
}

.tmk-back-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.tmk-character-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tmk-overlay-subtitle {
  color: #aaa;
  font-size: 0.85em;
  font-weight: normal;
  flex-shrink: 0;
}

.tmk-overlay-close {
  flex-shrink: 0;
}

.tmk-overlay-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.tmk-library-body {
  max-width: 860px;
  margin: 0 auto;
}

.tmk-character-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tmk-character-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 8px;
  padding: 8px 10px;
}

.tmk-character-open {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.tmk-character-open:hover {
  background: rgba(255, 255, 255, 0.08);
}

.tmk-character-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: bold;
}

.tmk-character-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.tmk-character-count {
  color: #aaa;
  font-size: 0.9em;
}

.tmk-character-view {
  color: #f0a35e;
  font-size: 0.9em;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.tmk-clear-character {
  flex-shrink: 0;
}

.tmk-empty {
  color: #999;
  text-align: center;
  margin-top: 60px;
}

.tmk-gallery-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.tmk-selection-count {
  color: #ccc;
  font-size: 0.92em;
}

.tmk-danger-button {
  background: transparent;
  color: #ff6b6b;
  box-shadow: inset 0 0 0 1px #ff6b6b;
}

.tmk-danger-button:disabled {
  color: #8a8a8a;
  box-shadow: inset 0 0 0 1px #6b6b6b;
  opacity: 0.7;
}
</style>
