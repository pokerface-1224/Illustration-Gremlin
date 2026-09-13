<template>
<<<<<<< HEAD
  <div class="troublemaker-extension-settings">
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>{{ t`插图精灵` }}</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content">
        <!-- 当前角色 -->
        <div class="tmk-block flex-container">
          <span class="tmk-label">{{ t`当前角色` }}</span>
          <strong class="tmk-character-name" :class="{ 'tmk-muted': !currentCharacter }">
            {{ currentCharacter || t`未打开角色卡` }}
          </strong>
        </div>

        <!-- 图包导入 -->
        <div class="tmk-block">
          <div class="tmk-import-row flex-container">
            <input
              ref="fileInput"
              class="tmk-file-input"
              type="file"
              accept=".zip"
              multiple
              @change="onFilesSelected"
            />
            <input
              ref="updateFileInput"
              class="tmk-file-input tmk-update-file-input"
              type="file"
              accept=".zip"
              multiple
              @change="onUpdateFilesSelected"
            />
            <div class="tmk-buttons">
              <input
                class="menu_button"
                type="button"
                :value="importing ? t`导入中…` : t`导入图包`"
                :disabled="busy"
                @click="onImportClick"
              />
              <input
                class="menu_button"
                type="button"
                :value="updating ? t`更新中…` : t`插图更新`"
                :disabled="busy"
                @click="onUpdateClick"
              />
              <input
                class="menu_button tmk-preview-button"
                type="button"
                :value="t`预览插图`"
                :disabled="images.length === 0"
                @click="previewOpen = true"
              />
            </div>
          </div>
          <div class="tmk-hint">
            <span v-if="selectedFileNames.length">
              {{ selectedFileNames.join('、') }}
            </span>
            <span v-else>{{ t`支持 zip 压缩包` }}</span>
          </div>
          <div class="tmk-manage-row flex-container">
            <input
              class="menu_button"
              type="button"
              :value="t`管理全部插图`"
              :disabled="busy"
              @click="manageOpen = true"
            />
            <input
              class="menu_button tmk-danger-button"
              type="button"
              :value="t`清空插图`"
              :disabled="busy || images.length === 0"
              @click="onDeleteAllImages"
            />
          </div>
        </div>

        <div class="tmk-block">
          <div class="tmk-hint">
            {{ t`图片保存在浏览器沙箱中，无需授权；清除浏览器数据会删除已导入的图片` }}
          </div>
        </div>

        <!-- 插图列表 -->
        <div class="tmk-block">
          <div class="flex-container">
            <span class="tmk-label">{{ t`插图` }}</span>
            <span class="tmk-hint">{{ images.length }} 张</span>
          </div>
        </div>

        <PreviewOverlay
          v-if="previewOpen && currentCharacter"
          :character="currentCharacter"
          :images="images"
          @close="previewOpen = false"
          @delete="onDeleteImage"
        />

        <LibraryOverlay v-if="manageOpen" @close="onLibraryClose" />

        <hr class="sysHR" />

        <!-- 使用说明 -->
        <div class="tmk-help-button-row">
          <button class="menu_button tmk-help-button" type="button" @click="helpOpen = true">
            <i class="fa-solid fa-circle-question"></i>
            {{ t`使用说明` }}
          </button>
        </div>

        <HelpOverlay v-if="helpOpen" @close="helpOpen = false" />
=======
  <div class="example-extension-settings">
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>{{ t`插件示例` }}</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content">
        <div class="example-extension_block flex-container">
          <input class="menu_button" type="submit" :value="t`示例按钮`" @click="handle_button_click" />
        </div>

        <div class="example-extension_block flex-container">
          <input v-model="settings.button_selected" type="checkbox" />
          <label for="example_setting">{{ t`示例开关` }}</label>
        </div>

        <hr class="sysHR" />
>>>>>>> 2f17b1f65a37f44c2531083652e0351d9a350785
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
<<<<<<< HEAD
import { event_types, eventSource } from '@sillytavern/scripts/events';
import HelpOverlay from '@/HelpOverlay.vue';
import LibraryOverlay from '@/LibraryOverlay.vue';
import PreviewOverlay from '@/PreviewOverlay.vue';
import { getCurrentCharacterName } from '@/util/character';
import { extractZipImages, type ArchiveImage } from '@/util/archive';
import { syncAfterImageChange } from '@/util/imageSync';
import {
  deleteAllCharacterImages,
  deleteCharacterImage,
  listCharacterImages,
  updateCharacterImages,
  type CharacterImageUpdateResult,
  writeCharacterImages,
} from '@/util/illustrations';

const fileInput = ref<HTMLInputElement | null>(null);
const updateFileInput = ref<HTMLInputElement | null>(null);
const selectedFiles = ref<File[]>([]);
const importing = ref(false);
const updating = ref(false);
const currentCharacter = ref<string | null>(null);
const images = ref<string[]>([]);
const previewOpen = ref(false);
const manageOpen = ref(false);
const helpOpen = ref(false);

const busy = computed(() => importing.value || updating.value);
const selectedFileNames = computed(() => selectedFiles.value.map(file => file.name));

function updateCurrentCharacter() {
  currentCharacter.value = getCurrentCharacterName();
  void refreshImages();
}

async function refreshImages() {
  const character = currentCharacter.value;
  if (!character) {
    images.value = [];
    return;
  }
  try {
    images.value = await listCharacterImages(character);
  } catch (error) {
    console.warn('读取插图失败', error);
    images.value = [];
  }
  // 图片列表变化后, 让聊天中的 ${名称} 占位符重新查找图片
  syncAfterImageChange();
}

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFiles.value = Array.from(input.files ?? []);
  // 选好文件后自动开始导入
  if (!busy.value && selectedFiles.value.length > 0) {
    void onImportClick();
  }
}

function onUpdateFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length === 0) {
    return;
  }
  selectedFiles.value = files;
  if (updateFileInput.value) {
    // 文件已转入状态管理, 避免下次点击更新时重复读取旧选择
    updateFileInput.value.value = '';
  }
  if (!busy.value) {
    void onUpdateClick();
  }
}

async function onImportClick() {
  if (busy.value) {
    return;
  }
  const character = currentCharacter.value;
  if (!character) {
    toastr.warning(t`请先打开一个角色卡再导入图包`);
    return;
  }
  if (selectedFiles.value.length === 0) {
    // 兜底: 从 DOM 输入框直接读取, 避免状态丢失
    const domFiles = fileInput.value?.files;
    if (domFiles && domFiles.length > 0) {
      selectedFiles.value = Array.from(domFiles);
    } else {
      // 未选择任何文件时, 直接打开文件选择框
      fileInput.value?.click();
      return;
    }
  }

  importing.value = true;
  const files = selectedFiles.value;
  try {
    let importedCount = 0;
    for (const file of files) {
      importedCount += await importOneFile(file, character);
    }
    toastr.success(t`导入成功：共 ${importedCount} 张图片`);
    void refreshImages();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(message);
  } finally {
    importing.value = false;
    // 仅在导入期间没有新选择时清理, 避免丢失用户刚选的新文件
    if (selectedFiles.value === files) {
      selectedFiles.value = [];
      if (fileInput.value) {
        fileInput.value.value = '';
      }
    }
  }
}

async function onUpdateClick() {
  if (busy.value) {
    return;
  }
  const character = currentCharacter.value;
  if (!character) {
    toastr.warning(t`请先打开一个角色卡再更新图包`);
    return;
  }
  if (selectedFiles.value.length === 0) {
    // 兜底: 从更新输入框直接读取, 避免状态丢失
    const domFiles = updateFileInput.value?.files;
    if (domFiles && domFiles.length > 0) {
      selectedFiles.value = Array.from(domFiles);
    } else {
      // 未选择任何文件时, 直接打开更新用的文件选择框
      updateFileInput.value?.click();
      return;
    }
  }

  updating.value = true;
  const files = selectedFiles.value;
  try {
    let total = 0;
    let overwritten = 0;
    for (const file of files) {
      const result = await updateOneFile(file, character);
      total += result.total;
      overwritten += result.overwritten;
    }
    toastr.success(t`更新成功：共 ${total} 张图片（覆盖 ${overwritten} 张同名旧图）`);
    void refreshImages();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(message);
  } finally {
    updating.value = false;
    // 仅在更新期间没有新选择时清理, 避免丢失用户刚选的新文件
    if (selectedFiles.value === files) {
      selectedFiles.value = [];
      if (fileInput.value) {
        fileInput.value.value = '';
      }
      if (updateFileInput.value) {
        updateFileInput.value.value = '';
      }
    }
  }
}

async function readZipImages(file: File): Promise<ArchiveImage[]> {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (extension !== '.zip') {
    throw new Error(t`仅支持 zip 压缩包，请先将图片打包为 zip 再导入`);
  }

  const imagesInArchive = await extractZipImages(file);
  if (imagesInArchive.length === 0) {
    throw new Error(t`压缩包中没有找到图片文件`);
  }
  return imagesInArchive;
}

async function importOneFile(file: File, character: string): Promise<number> {
  const imagesInArchive = await readZipImages(file);
  await writeCharacterImages(character, imagesInArchive);
  return imagesInArchive.length;
}

async function updateOneFile(file: File, character: string): Promise<CharacterImageUpdateResult> {
  const imagesInArchive = await readZipImages(file);
  return updateCharacterImages(character, imagesInArchive);
}

async function onDeleteImage(relativePath: string) {
  const character = currentCharacter.value;
  if (!character) return;
  if (!confirm(t`确定删除图片 ${relativePath} 吗？`)) return;

  try {
    await deleteCharacterImage(character, relativePath);
    toastr.success(t`已删除 ${relativePath}`);
    void refreshImages();
  } catch (error) {
    toastr.error(error instanceof Error ? error.message : String(error));
  }
}

async function onDeleteAllImages() {
  const character = currentCharacter.value;
  if (!character || images.value.length === 0 || busy.value) return;
  if (!confirm(t`清空「${character}」的全部 ${images.value.length} 张插图？此操作不可恢复。`)) return;

  try {
    const deleted = await deleteAllCharacterImages(character);
    toastr.success(t`已清空 ${deleted} 张插图`);
    void refreshImages();
  } catch (error) {
    toastr.error(error instanceof Error ? error.message : String(error));
  }
}

function onLibraryClose() {
  manageOpen.value = false;
  // 管理器可能删除了当前角色的插图, 关闭后同步面板状态
  updateCurrentCharacter();
}

onMounted(() => {
  updateCurrentCharacter();
  eventSource.on(event_types.CHAT_CHANGED, updateCurrentCharacter);
});

onBeforeUnmount(() => {
  eventSource.removeListener(event_types.CHAT_CHANGED, updateCurrentCharacter);
});
</script>

<style scoped>
.tmk-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0;
}

.tmk-import-row {
  gap: 8px;
  flex-wrap: wrap;
}

.tmk-file-input {
  flex: 1;
  min-width: 180px;
  max-width: 280px;
}

.tmk-update-file-input {
  display: none;
}

.tmk-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 116px;
  flex-shrink: 0;
}

.tmk-buttons input {
  width: 100%;
  margin: 0;
}

.tmk-manage-row {
  gap: 8px;
  margin-top: 4px;
}

.tmk-manage-row input {
  flex: 1;
  min-width: 0;
  margin: 0;
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

/* 预览按钮与主按钮大小一致, 用描边样式作区分 */
.tmk-preview-button {
  background: transparent;
  color: var(--SmartThemeBodyColor, inherit);
  box-shadow: inset 0 0 0 1px var(--SmartThemeBodyColor, currentColor);
}

.tmk-help-button-row {
  display: flex;
  justify-content: center;
  margin: 12px 0 4px;
}

.tmk-help-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tmk-label {
  color: var(--SmartThemeBodyColor, inherit);
  opacity: 0.75;
  min-width: 88px;
}

.tmk-character-name {
  word-break: break-all;
}

.tmk-muted {
  opacity: 0.5;
}

.tmk-hint {
  color: var(--SmartThemeBodyColor, inherit);
  opacity: 0.6;
  font-size: 0.85em;
  word-break: break-all;
}
</style>
=======
import { useSettingsStore } from '@/store/settings';
import { storeToRefs } from 'pinia';

const { settings } = storeToRefs(useSettingsStore());

const handle_button_click = () => {
  toastr.success('你好呀!');
};
</script>

<style scoped></style>
>>>>>>> 2f17b1f65a37f44c2531083652e0351d9a350785
