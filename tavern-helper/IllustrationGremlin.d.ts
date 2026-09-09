/**
 * 插图精灵 (Illustration-Gremlin) 提供给酒馆助手前端界面的图片引用接口。
 *
 * 需要先安装「插图精灵」扩展, 然后在酒馆助手前端界面中使用:
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
 *
 * 角色隔离说明: 接口只允许访问「当前打开角色卡」(getCurrentCharacterName()) 的插图,
 * 无法枚举或读取其他角色卡的插图。
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
     * 只列出当前角色卡的图片: 不传参即当前角色; 传了其他角色名也会返回 [] (签名保留仅为兼容旧调用方)。
     */
    listImages(characterName?: string | null): Promise<ImageInfo[]>;
    /** 获取当前角色卡下某张图片的元信息; characterName 不是当前角色或图片不存在时返回 null */
    getImageInfo(characterName: string, relativePath: string): Promise<ImageInfo | null>;
    /** 获取当前角色卡下某张图片的 blob URL, 可直接用于 `<img src>`; characterName 不是当前角色时返回 null */
    getImageUrl(characterName: string, relativePath: string): Promise<string | null>;
    /** 按文件名 (不含扩展名, 不区分大小写, 可带扩展名) 仅在当前角色目录中查找并返回 blob URL; 找不到时返回 null */
    getImageUrlByName(name: string): Promise<string | null>;
    /** 按文件名在当前角色目录中查找, 同时返回元信息与 blob URL; 找不到时返回 null */
    findImage(name: string): Promise<ImageRef | null>;
    /** 释放某个由本接口创建的 blob URL (引用它的 `<img>` 会失效, 请确保不再使用) */
    revokeUrl(url: string): void;
    /** 清空本接口的查找索引与 URL 缓存 (导入/删除图片后可调用, 让旧 URL 尽快失效) */
    clearCache(): void;
  };
}
