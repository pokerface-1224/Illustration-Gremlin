<template>
  <Teleport to="body">
    <div class="tmk-help-overlay" role="dialog" aria-modal="true">
      <div class="tmk-help-header">
        <span class="tmk-help-title">
          <i class="fa-solid fa-book-open"></i>
          {{ t`使用说明` }}
        </span>
        <button class="menu_button tmk-help-close" type="button" @click="close">
          <i class="fa-solid fa-xmark"></i>
          {{ t`关闭` }}
        </button>
      </div>

      <div class="tmk-help-body">
        <!-- 用户：如何导入图包 -->
        <section class="tmk-help-section">
          <h2 class="tmk-help-heading">
            <i class="fa-solid fa-download"></i>
            {{ t`用户：如何导入图包` }}
          </h2>
          <ol class="tmk-help-list">
            <li>{{ t`在酒馆中打开一个角色卡（群聊场景下使用群名称）。` }}</li>
            <li>{{ t`展开「扩展」面板，找到「捣蛋鬼的禁书库」。` }}</li>
            <li>
              {{ t`点击「导入图包」按钮，或直接选择 zip 压缩包（可多选），选好后会自动开始导入。` }}
            </li>
            <li>
              {{ t`导入完成后点击「预览插图」，可浏览当前角色的插图；悬停缩略图可删除图片。` }}
            </li>
          </ol>
          <p class="tmk-help-note">
            {{ t`图片保存在浏览器沙箱（OPFS）中，无需授权；换浏览器、换电脑或清除浏览器数据后图片会丢失。` }}
          </p>
        </section>

        <!-- 创作者：如何打包图包 -->
        <section class="tmk-help-section">
          <h2 class="tmk-help-heading">
            <i class="fa-solid fa-box-archive"></i>
            {{ t`创作者：如何制作并分发图包` }}
          </h2>
          <ol class="tmk-help-list">
            <li>
              {{ t`收集要分发的图片，支持 png / jpg / jpeg / gif / webp / bmp / avif / svg 格式。` }}
            </li>
            <li>
              {{ helpNamingFile }}
            </li>
            <li>
              {{ t`把图片放入 zip 压缩包（可建子文件夹，导入时会自动展平目录结构）。` }}
            </li>
            <li>
              {{ t`不要加密压缩包；支持 store / deflate 压缩方式与 ZIP64 格式。` }}
            </li>
            <li>
              {{ t`把 zip 文件直接分发给用户即可，用户导入后图片会按角色卡分别保存。` }}
            </li>
          </ol>
        </section>

        <!-- 让 AI 在文中插入插图 -->
        <section class="tmk-help-section">
          <h2 class="tmk-help-heading">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            {{ t`让 AI 在文中插入插图` }}
          </h2>
          <ol class="tmk-help-list">
            <li>
              {{ helpPlaceholderExample }}
            </li>
            <li>
              {{ t`AI 输出包含占位符后，消息发送或生成时，插件会自动把占位符替换为对应图片。` }}
            </li>
            <li>
              {{ helpPromptExample }}
            </li>
          </ol>
          <p class="tmk-help-note">
            {{ helpMatchingRules }}
          </p>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { translate } from '@sillytavern/scripts/i18n';

const emit = defineEmits<{
  close: [];
}>();

// 含 ${...} 字面量的文案不能使用 t`...` 模板字符串（会被当作插值），
// 这里用 translate() 普通字符串调用，翻译键与 i18n/en.json 保持一致
const helpNamingFile = translate(
  '用对话中希望引用的名字命名文件，例如「奶龙_微笑.png」，方便后续用 ${奶龙_微笑} 占位符调用。',
);
const helpPlaceholderExample = translate(
  '在角色卡或系统提示中告诉 AI：需要在文中展示插图时，在合适的位置写出 ${图片名} 占位符，例如「她推开门，抬头看了过来。${奶龙_微笑}」。',
);
const helpPromptExample = translate(
  '提示词示例：「当场景中角色出现特定表情时，在正文中合适的位置插入对应表情，如 ${奶龙_微笑}。」',
);
const helpMatchingRules = translate(
  '匹配规则：不区分大小写，可带扩展名（${奶龙_微笑.png} 也能匹配）；会按文件名在所有角色目录中查找；代码块内的占位符不会被替换。',
);

function close() {
  emit('close');
}

useEventListener(window, 'keydown', event => {
  if (event.key === 'Escape') {
    close();
  }
});
</script>

<style scoped>
.tmk-help-overlay {
  position: fixed;
  inset: 0;
  z-index: 30000;
  display: flex;
  flex-direction: column;
  background: rgba(12, 12, 14, 0.96);
  color: #e8e8e8;
}

.tmk-help-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(30, 30, 30, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}

.tmk-help-title {
  flex: 1;
  font-weight: bold;
  color: #eee;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tmk-help-title i {
  color: #f0a35e;
}

.tmk-help-close {
  flex-shrink: 0;
}

.tmk-help-body {
  flex: 1;
  overflow: auto;
  padding: 20px 24px 40px;
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
}

.tmk-help-section {
  margin-bottom: 24px;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.tmk-help-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  font-size: 1.12em;
  color: #fff;
}

.tmk-help-heading i {
  color: #f0a35e;
}

.tmk-help-list {
  margin: 0;
  padding-left: 22px;
  line-height: 1.75;
}

.tmk-help-list li {
  margin: 6px 0;
}

.tmk-help-note {
  margin: 12px 0 0;
  padding: 10px 12px;
  background: rgba(240, 163, 94, 0.08);
  border-left: 3px solid #f0a35e;
  border-radius: 4px;
  font-size: 0.92em;
  color: #d5d5d5;
}
</style>
