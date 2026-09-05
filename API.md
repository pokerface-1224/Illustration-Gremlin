# Illustration-Gremlin 接口文档

> 适用于插件 **v1.1.0+**。本文档描述插件对外提供的全局接口 `IllustrationGremlin`，
> 主要面向酒馆助手（tavern_helper）渲染的前端界面，也可供其他同源页面或扩展使用。

## 1. 接口简介

`IllustrationGremlin` 是插件挂在酒馆主页面上的全局接口，用于引用本插件保存在
浏览器沙箱（OPFS）中的插图。调用方不需要关心图片的存储细节，接口直接返回
**可直接用于 `<img src>` 的 blob URL**，以及图片的元信息。

- 全局名称：`IllustrationGremlin`
- 接口版本：`IllustrationGremlin.version`
- 图片来源：`illustrations/<角色目录>/`（由插件在导入 zip 图包时写入）
- 特性：按角色列出图片、按「角色 + 相对路径」精确取图、按文件名查找（与聊天占位符 `${图片名}` 相同的匹配规则）

## 2. 获取接口

### 2.1 推荐：通过酒馆助手全局共享

插件初始化时，如果检测到酒馆助手，会自动调用
`window.TavernHelper.initializeGlobal('IllustrationGremlin', api)` 注册为全局共享接口。
前端界面中可先等待初始化完成，再直接使用 `IllustrationGremlin` 变量：

```ts
$(async () => {
  await waitGlobalInitialized('IllustrationGremlin');

  const url = await IllustrationGremlin.getImageUrlByName('远坂凛');
  if (url) {
    document.querySelector('img')!.src = url;
  }
});
```

> 注意：`waitGlobalInitialized` 是酒馆助手提供的方法。如果酒馆助手未安装或尚未加载，
> 该调用可能失败，请使用 2.2 的兜底方式。

### 2.2 兜底：直接访问酒馆主页面

酒馆助手的前端界面是无沙盒的同源 iframe，可以直接读取父页面的全局对象：

```ts
const IllustrationGremlin = window.parent.IllustrationGremlin;
```

此方式不依赖酒馆助手，只要插件已加载即可使用。

### 2.3 可用性检查

```ts
if (!IllustrationGremlin.isAvailable()) {
  // 当前浏览器不支持沙箱存储（OPFS），无法引用图片
}
```

## 3. 类型定义

### 3.1 `IllustrationImageInfo`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `character` | `string` | 图片所属角色目录名（已清洗，如 `远坂凛`） |
| `relativePath` | `string` | 相对角色目录的路径，如 `nailong.png` 或 `子目录/xxx.png` |
| `fileName` | `string` | 文件名，如 `nailong.png` |
| `baseName` | `string` | 去扩展名的文件名，如 `nailong` |
| `mimeType` | `string` | MIME 类型，如 `image/png` |
| `size` | `number` | 文件大小（字节） |

### 3.2 `IllustrationImageRef`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `info` | `IllustrationImageInfo` | 图片元信息 |
| `url` | `string` | 可直接用于 `<img src>` 的 blob URL |

## 4. 方法说明

### 4.1 `version: string`

接口版本号。示例：`'1.2.0'`。

### 4.2 `isAvailable(): boolean`

当前浏览器是否支持沙箱存储（OPFS）。不支持时其余方法会返回 `null` 或 `[]`。

### 4.3 `getCurrentCharacterName(): string | null`

获取当前打开的角色卡名称；群聊场景下返回群名称；未打开角色卡时返回 `null`。

```ts
const character = IllustrationGremlin.getCurrentCharacterName();
```

### 4.4 `listImages(characterName?: string | null): Promise<IllustrationImageInfo[]>`

列出图片元信息。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `characterName` | `string \| null`（可选） | 角色名；省略、传 `null` 或空字符串时列出**所有角色**的图片；传入角色名时只列出该角色 |

返回值：`IllustrationImageInfo[]`，读取失败或无图片时返回空数组，不会抛出异常。

```ts
// 列出当前角色的图片
const images = await IllustrationGremlin.listImages(IllustrationGremlin.getCurrentCharacterName() ?? undefined);

// 列出所有角色的图片
const all = await IllustrationGremlin.listImages();
```

### 4.5 `getImageInfo(characterName: string, relativePath: string): Promise<IllustrationImageInfo | null>`

获取某角色下某张图片的元信息。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `characterName` | `string` | 角色名（可用原始角色名，内部会自动清洗） |
| `relativePath` | `string` | 相对角色目录的路径，如 `nailong.png` |

返回值：`IllustrationImageInfo | null`，图片不存在或读取失败时返回 `null`。

```ts
const info = await IllustrationGremlin.getImageInfo('远坂凛', '远坂凛.png');
```

### 4.6 `getImageUrl(characterName: string, relativePath: string): Promise<string | null>`

获取某角色下某张图片的 blob URL，可直接用于 `<img src>`。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `characterName` | `string` | 角色名 |
| `relativePath` | `string` | 相对角色目录的路径 |

返回值：`string | null`，图片不存在或读取失败时返回 `null`。

```ts
const url = await IllustrationGremlin.getImageUrl('远坂凛', '远坂凛.png');
if (url) {
  img.src = url;
}
```

### 4.7 `getImageUrlByName(name: string): Promise<string | null>`

按文件名在所有角色目录中查找图片并返回 blob URL。匹配规则与聊天占位符 `${图片名}` 完全一致：

- 不区分大小写；
- 可带扩展名（`远坂凛` 与 `远坂凛.png` 均能匹配）；
- 支持 `"名称"`、`'名称'`、`` `名称` `` 等带引号写法；
- 多个角色目录存在同名图片时，取最先匹配到的一张。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string` | 图片文件名（可带或不带扩展名） |

返回值：`string | null`，找不到图片时返回 `null`。

```ts
const url = await IllustrationGremlin.getImageUrlByName('远坂凛');
```

### 4.8 `findImage(name: string): Promise<IllustrationImageRef | null>`

按文件名查找图片，同时返回元信息与 blob URL（相当于 4.7 + 元信息）。

返回值：`IllustrationImageRef | null`，找不到图片时返回 `null`。

```ts
const ref = await IllustrationGremlin.findImage('远坂凛');
if (ref) {
  console.log(ref.info.character, ref.info.fileName, ref.info.size);
  img.src = ref.url;
}
```

### 4.9 `revokeUrl(url: string): void`

释放某个由本接口创建的 blob URL（会同时清除对应缓存项）。

> 调用后，引用该 URL 的 `<img>` 将无法继续加载，请确保没有元素还在使用它。
> 普通场景下可以不用手动释放；酒馆页面刷新后所有 blob URL 会自动失效。

```ts
IllustrationGremlin.revokeUrl(url);
```

### 4.10 `clearCache(): void`

清空接口的查找索引与 URL 缓存。插件在导入或删除图片后会自动调用一次，
调用方一般无需手动触发；如果你发现图片列表或 URL 长时间未更新，可手动调用。

```ts
IllustrationGremlin.clearCache();
```

## 5. 完整示例

以下示例在酒馆助手前端界面中，按当前角色列出全部图片并展示为图片网格，
同时演示按文件名引用单张图片：

```ts
import './index.css';

$(() => {
  void (async () => {
    // 等待接口初始化；未安装酒馆助手时改用:
    // const IllustrationGremlin = window.parent.IllustrationGremlin;
    await waitGlobalInitialized('IllustrationGremlin');

    const container = document.getElementById('gallery');
    if (!container) return;

    // 按文件名引用单张图片
    const hero = await IllustrationGremlin.getImageUrlByName('远坂凛');
    if (hero) {
      const img = document.createElement('img');
      img.src = hero;
      img.style.width = '160px';
      container.appendChild(img);
    }

    // 列出当前角色的全部图片
    const images = await IllustrationGremlin.listImages(
      IllustrationGremlin.getCurrentCharacterName() ?? undefined,
    );
    for (const image of images) {
      const url = await IllustrationGremlin.getImageUrl(image.character, image.relativePath);
      if (!url) continue;
      const img = document.createElement('img');
      img.src = url;
      img.alt = image.fileName;
      img.title = `${image.character} / ${image.relativePath}`;
      img.style.width = '120px';
      container.appendChild(img);
    }
  })();
});
```

## 6. 缓存与 URL 生命周期

- 接口会按「角色 + 相对路径」和「规范化文件名」两个维度缓存 blob URL；
  相同图片重复调用返回同一个 URL，不会重复读取 OPFS。
- 插件在导入或删除图片后会自动调用 `clearCache()`，旧 URL 立即失效；
  前端界面应重新调用 `listImages` / `getImageUrl*` 获取最新结果。
- blob URL 由酒馆主页面创建，只要酒馆页面不刷新就一直有效；
  刷新酒馆页面后需要重新获取。
- 不需要时可通过 `revokeUrl(url)` 主动释放，避免长期占用内存。

## 7. 类型提示

插件仓库内的 `tavern-helper/IllustrationGremlin.d.ts` 包含本接口的完整类型声明。
在酒馆助手前端界面项目中使用时，将该文件复制到模板的 `@types/iframe/` 目录，
即可在 TypeScript 中获得方法签名、参数与返回值的提示。

## 8. 常见问题

**Q：接口返回 `null` 或 `[]`？**

说明对应的图片不存在、当前浏览器不支持 OPFS，或读取失败。可先调用
`isAvailable()` 检查环境，再用 `listImages()` 确认图片是否已导入。

**Q：iframe 无法访问 `window.parent.IllustrationGremlin`？**

`window.parent` 只对同源 iframe 开放。酒馆助手前端界面是无沙盒同源 iframe，
正常情况下可以访问；如果是自己创建的跨源 iframe，则应改用 2.1 的
`waitGlobalInitialized` 方式，或通过其他通信渠道转发。

**Q：换浏览器 / 换电脑 / 清除浏览器数据后图片不见了？**

图片保存在浏览器沙箱（OPFS）中，仅当前浏览器可见，这是插件现有的存储设计。
接口只是提供引用方式，不会改变图片的存储位置。

**Q：前端界面需要展示“有哪些图片”给用户选择？**

使用 `listImages()` 获取全部（或当前角色）的图片列表，配合
`getImageUrl(character, relativePath)` 逐个渲染即可，参考第 5 节示例。
