# 捣蛋鬼的禁书库（Illustration-Gremlin）

一个 SillyTavern 扩展：打开角色卡后，在扩展面板中选择 zip 图包即可自动导入，
图片保存在浏览器沙箱（OPFS）的 `illustrations/<角色卡名称>/` 目录中，面板内可预览、删除；
还支持在对话中用 `${图片名}` 占位符把 OPFS 中的插图直接显示到聊天消息里。

- 仓库地址：<https://github.com/pokerface-1224/Illustration-Gremlin>
- 作者：pokerface1224
- 许可证：[Aladdin Free Public License v9](LICENSE)

## 功能

### 图包导入

- 面板自动识别当前打开的角色卡，切换角色时同步更新；未打开角色卡时会提示，群聊场景下使用群名称
- 支持导入 `.zip` 压缩图包，可一次选择多个文件，选择后自动开始导入
- 只提取压缩包内的图片（png / jpg / jpeg / gif / webp / bmp / avif / svg），自动展平目录结构
- 重名文件自动追加序号（如 `奶龙 (1).png`），不会互相覆盖
- 纯浏览器端解压，支持 store / deflate 压缩方式与 ZIP64 格式，兼容 UTF-8 与 CP437 文件名编码
- 遇到加密压缩包或不受支持的压缩方式会给出明确报错

### 浏览器沙箱存储（OPFS）

- 图片保存在浏览器为酒馆站点分配的沙箱存储（Origin Private File System）中
- 面板显示当前角色的插图数量，切换角色时列表同步切换

### 插图预览

- 点击「预览插图」弹出全屏子页面，以网格形式展示当前角色的所有插图
- 网格按需懒加载（滚动到附近才读取图片），点击缩略图进入大图灯箱，支持左右切换
- 键盘快捷键：`←` / `→` 切换图片，`Esc` 关闭灯箱或预览页
- 悬停缩略图可删除图片（删除前有二次确认）

### 占位符插图（图片替换）

在对话中输入 `${图片名}` 模板字面量（例如 `${nailong}`），消息发送或生成后，聊天中会自动把该占位符替换为 OPFS 中对应文件名的图片（如 `nailong.png`）。

- 匹配格式：`${名称}`，不区分大小写，名称可以带扩展名（`${nailong.png}` 也能匹配）
- 查找范围：`illustrations/` 目录下所有角色子目录，按文件名（不含扩展名）匹配
- 替换位置：聊天气泡中用户与角色的消息，流式生成、切换回复、编辑后都会自动更新
- 代码块、`<pre>` 等区域内的 `${...}` 不会被替换
- 导入或删除图片后，已显示消息中的占位符会自动重新查找并更新，无需刷新页面
- 替换后的图片以内联形式展示（宽约 2/3、最大高度 420px、圆角样式）

### 供酒馆助手前端界面引用图片（接口）

插件会提供一个全局接口 `IllustrationGremlin`，让酒馆助手（tavern_helper）渲染的前端界面可以通过
接口引用本插件保存在 OPFS 中的图片（返回可直接用于 `<img src>` 的 blob URL），无需关心图片的存储细节。

完整的接口文档见 [API.md](API.md)。

- 接口挂载在酒馆主页面：`window.IllustrationGremlin`
- 安装酒馆助手时，会自动注册为全局共享接口，前端界面中可 `await waitGlobalInitialized('IllustrationGremlin')`
  后直接使用 `IllustrationGremlin`
- 支持按角色名列出图片、按「角色名 + 相对路径」精确取图，或按文件名（与 `${图片名}` 相同的匹配规则）查找
- 导入或删除图片后接口会清空缓存，重新查询即可拿到最新结果

前端界面中使用示例：

```ts
$(() => {
  void (async () => {
    // 等待接口初始化（未安装酒馆助手时，可改用: const IllustrationGremlin = window.parent.IllustrationGremlin;）
    await waitGlobalInitialized('IllustrationGremlin');

    // 按文件名引用图片（不区分大小写，可带扩展名）
    const url = await IllustrationGremlin.getImageUrlByName('远坂凛');
    if (url) {
      document.querySelector('img')!.src = url;
    }

    // 或先列出当前角色的图片，再逐个引用
    const character = IllustrationGremlin.getCurrentCharacterName();
    const images = await IllustrationGremlin.listImages(character ?? undefined);
    const first = await IllustrationGremlin.getImageUrl(images[0].character, images[0].relativePath);
  })();
});
```

接口的方法与类型定义见 [tavern-helper/IllustrationGremlin.d.ts](tavern-helper/IllustrationGremlin.d.ts)，
在酒馆助手前端界面项目中使用时，可把该文件复制到模板的 `@types/iframe/` 目录以获得类型提示。

### 多语言

- 内置中文与英文界面，跟随 SillyTavern 的语言设置（英文翻译见 `i18n/en.json`）

## 安装

仓库地址：`https://github.com/pokerface-1224/Illustration-Gremlin`

### 方式一：通过 SillyTavern 扩展面板安装（推荐）

1. 打开 SillyTavern，进入「扩展」面板，找到「安装扩展」。
2. 粘贴上面的仓库地址，点击安装。
3. 刷新页面（或重启酒馆），即可在扩展面板中看到「捣蛋鬼的禁书库」。

### 方式二：手动克隆

```bash
git clone https://github.com/pokerface-1224/Illustration-Gremlin.git
```

将克隆结果放到 SillyTavern 的第三方扩展目录：

```
public/scripts/extensions/third-party/Illustration-Gremlin
```

刷新酒馆页面后即可使用。`dist/` 构建产物已随仓库提交，无需本地构建。

### 环境要求

- SillyTavern（支持第三方扩展与 i18n）
- 现代浏览器：需要 Origin Private File System（OPFS）与原生 `DecompressionStream` 支持（推荐 Chrome / Edge）

## 使用

1. 打开一个角色卡，展开扩展面板「捣蛋鬼的禁书库」。
2. 选择 zip 压缩包（可多选），选择后自动开始导入
   （也可以先选多个文件，再点「导入图包」；未选文件时点「导入图包」会直接弹出文件选择框）。
3. 导入完成后，点击「预览插图」按钮，在全屏页面浏览当前角色的插图；悬停缩略图可删除。
4. 在对话中输入 `${图片名}`（例如 `${远坂凛}`），消息发送或生成后，占位符会自动替换为对应插图。

## 存储说明

图片保存在浏览器为酒馆站点分配的沙箱存储（Origin Private File System）中：

- **无需授权**：导入过程没有任何弹窗或手动步骤
- **仅当前浏览器可见**：换浏览器、换电脑或清除浏览器数据后，图片会丢失
- **无法被其他程序访问**：图片不在服务器磁盘上，酒馆服务器、其他工具看不到这些文件

如果需要图片真正保存在服务器磁盘上（例如给其他程序使用），需要服务端写入能力，
当前插件只支持浏览器沙箱方案。

其他程序（如同源的酒馆助手前端界面）可以通过 `IllustrationGremlin` 接口引用这些图片，
具体用法见上文「供酒馆助手前端界面引用图片（接口）」。

## 开发

```bash
pnpm install
pnpm build    # 构建到 dist/
pnpm watch    # 监听源码变化自动构建
pnpm lint
pnpm format   # 格式化源码
```

构建产物 `dist/index.js` 与 `dist/index.css` 会被 SillyTavern 直接加载；修改代码后需刷新酒馆页面生效。

## 许可证

[Aladdin Free Public License (AFPL) v9](LICENSE)
