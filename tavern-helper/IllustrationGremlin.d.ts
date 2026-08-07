/**
 * 捣蛋鬼的禁书库 (Illustration-Gremlin) 提供给酒馆助手前端界面的图片引用接口。
 *
 * 需要先安装「捣蛋鬼的禁书库」扩展, 然后在酒馆助手前端界面中使用:
 *
 * @example
 * $(async () => {
 *   await waitGlobalInitialized('IllustrationGremlin');
 *   const url = await IllustrationGremlin.getImageUrlByName('远坂凛');
 *   document.querySelector('img')!.src = url;
 * });
 *
 * 如果没有安装酒馆助手, 也可以在酒馆助手前端界面 (同源 iframe) 中直接访问酒馆主页面:
 *
 * @example
 * const IllustrationGremlin = window.parent.IllustrationGremlin;
 */
declare const IllustrationGremlin: IllustrationGremlin.Static;

declare namespace IllustrationGremlin {
  type ImageInfo = {
    /** 图片所属角色目录名 (已清洗) */
    character: string;
    /** 相对角色目录的路径, 如 "nailong.png" 或 "子目录/xxx.png" */
    relativePath: string;
    /** 文件名 */
    fileName: string;
    /** 文件名 (不含扩展名) */
    baseName: string;
    /** MIME 类型 */
    mimeType: string;
    /** 文件大小 (字节) */
    size: number;
  };

  type ImageRef = {
    info: ImageInfo;
    /** 可直接用于 `<img src>` 的 blob URL */
    url: string;
  };

  type Static = {
    readonly version: string;
    /** 当前浏览器是否支持沙箱存储 (OPFS) */
    isAvailable(): boolean;
    /** 获取当前打开的角色卡名称 (群聊场景返回群名), 未打开时返回 null */
    getCurrentCharacterName(): string | null;
    /**
     * 列出图片信息。
     * 不传参时列出所有角色的图片; 传角色名时只列出该角色 (支持原始角色名, 内部会清洗)。
     */
    listImages(characterName?: string | null): Promise<ImageInfo[]>;
    /** 获取某角色下某张图片的元信息; 不存在时返回 null */
    getImageInfo(characterName: string, relativePath: string): Promise<ImageInfo | null>;
    /** 获取某角色下某张图片的 blob URL, 可直接用于 `<img src>`; 不存在时返回 null */
    getImageUrl(characterName: string, relativePath: string): Promise<string | null>;
    /** 按文件名 (不含扩展名, 不区分大小写, 可带扩展名) 在所有角色目录中查找并返回 blob URL; 找不到时返回 null */
    getImageUrlByName(name: string): Promise<string | null>;
    /** 按文件名查找, 同时返回元信息与 blob URL; 找不到时返回 null */
    findImage(name: string): Promise<ImageRef | null>;
    /** 释放某个由本接口创建的 blob URL (引用它的 `<img>` 会失效, 请确保不再使用) */
    revokeUrl(url: string): void;
    /** 清空本接口的查找索引与 URL 缓存 (导入/删除图片后可调用, 让旧 URL 尽快失效) */
    clearCache(): void;
  };
}
