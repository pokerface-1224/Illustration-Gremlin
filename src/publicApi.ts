import { getCurrentCharacterName } from '@/util/character';
import {
  clearImageLookupCache,
  findCharacterImageByName,
  isSandboxStorageSupported,
  listCharacterImages,
  readCharacterImage,
  sanitizeDirectoryName,
} from '@/util/illustrations';

/**
 * 插件对外提供的公开接口。
 *
 * - 以 `window.IllustrationGremlin` 挂在酒馆主页面 (同源 iframe 可通过 `window.parent.IllustrationGremlin` 访问);
 * - 安装酒馆助手 (tavern_helper) 时, 还会通过 `window.TavernHelper.initializeGlobal` 注册同名全局,
 *   使酒馆助手前端界面可以 `await waitGlobalInitialized('IllustrationGremlin')` 后直接使用本接口。
 * - 角色隔离: 接口只允许访问「当前打开角色卡」的插图 (见 getCurrentCharacterName), 无法枚举或读取
 *   其他角色卡的插图; 插件扩展面板中的「管理全部插图」是唯一的多角色管理入口, 不经过本接口。
 */

export const PUBLIC_API_GLOBAL_NAME = 'IllustrationGremlin';

const PUBLIC_API_VERSION = '1.4.0';

const TAVERN_HELPER_RETRY_LIMIT = 20;
const TAVERN_HELPER_RETRY_DELAY_MS = 500;

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

export type IllustrationImageInfo = {
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

export type IllustrationImageRef = {
  info: IllustrationImageInfo;
  /** 可直接用于 `<img src>` 的 blob URL */
  url: string;
};

export type IllustrationGremlinApi = {
  readonly version: string;
  /** 当前浏览器是否支持沙箱存储 (OPFS) */
  isAvailable(): boolean;
  /** 获取当前打开的角色卡名称 (群聊场景返回群名), 未打开时返回 null */
  getCurrentCharacterName(): string | null;
  /**
   * 列出图片信息。
   * 只列出当前角色卡的图片: 不传参即当前角色; 传了其他角色名也会返回 [] (签名保留仅为兼容旧调用方)。
   */
  listImages(characterName?: string | null): Promise<IllustrationImageInfo[]>;
  /** 获取当前角色卡下某张图片的元信息; characterName 不是当前角色或图片不存在时返回 null */
  getImageInfo(characterName: string, relativePath: string): Promise<IllustrationImageInfo | null>;
  /** 获取当前角色卡下某张图片的 blob URL, 可直接用于 `<img src>`; characterName 不是当前角色时返回 null */
  getImageUrl(characterName: string, relativePath: string): Promise<string | null>;
  /** 按文件名 (不含扩展名, 不区分大小写, 可带扩展名) 仅在当前角色目录中查找并返回 blob URL; 找不到时返回 null */
  getImageUrlByName(name: string): Promise<string | null>;
  /** 按文件名在当前角色目录中查找, 同时返回元信息与 blob URL; 找不到时返回 null */
  findImage(name: string): Promise<IllustrationImageRef | null>;
  /** 释放某个由本接口创建的 blob URL (引用它的 `<img>` 会失效, 请确保不再使用) */
  revokeUrl(url: string): void;
  /** 清空本接口的查找索引与 URL 缓存 (导入/删除图片后可调用, 让旧 URL 尽快失效) */
  clearCache(): void;
};

/** 逻辑键 -> blob URL 的缓存, 避免反复读取 OPFS */
const urlCache = new Map<string, string>();

function cacheKey(characterName: string, relativePath: string): string {
  return `${sanitizeDirectoryName(characterName)}/${relativePath}`;
}

function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .toLowerCase();
}

function currentCharacter(): string | null {
  return getCurrentCharacterName();
}

/** 调用方请求的角色是否就是当前角色卡 (省略角色名时按当前角色处理) */
function isCurrentCharacter(characterName?: string | null): boolean {
  const current = currentCharacter();
  if (!current) return false;
  if (!characterName) return true;
  return sanitizeDirectoryName(characterName) === sanitizeDirectoryName(current);
}

function fileNameWithoutExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function guessMimeType(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'image/*';
}

async function toImageInfo(characterName: string, relativePath: string): Promise<IllustrationImageInfo | null> {
  const file = await readCharacterImage(characterName, relativePath);
  if (!file) return null;
  const fileName = relativePath.split('/').filter(Boolean).pop() ?? relativePath;
  return {
    character: sanitizeDirectoryName(characterName),
    relativePath,
    fileName,
    baseName: fileNameWithoutExtension(fileName),
    mimeType: file.type || guessMimeType(fileName),
    size: file.size,
  };
}

async function resolveUrl(key: string, getBlob: () => Promise<Blob | null>): Promise<string | null> {
  const cached = urlCache.get(key);
  if (cached !== undefined) return cached;
  const blob = await getBlob();
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

function isAvailable(): boolean {
  return isSandboxStorageSupported();
}

async function listImages(characterName?: string | null): Promise<IllustrationImageInfo[]> {
  try {
    if (!isSandboxStorageSupported() || !isCurrentCharacter(characterName)) return [];
    const current = currentCharacter()!;
    const paths = await listCharacterImages(current);
    const infos = await Promise.all(paths.map(path => toImageInfo(current, path)));
    return infos.filter((info): info is IllustrationImageInfo => info !== null);
  } catch (error) {
    console.warn('[Illustration-Gremlin] 读取插图列表失败:', error);
    return [];
  }
}

async function getImageInfo(characterName: string, relativePath: string): Promise<IllustrationImageInfo | null> {
  try {
    if (!isCurrentCharacter(characterName)) return null;
    return await toImageInfo(currentCharacter()!, relativePath);
  } catch (error) {
    console.warn('[Illustration-Gremlin] 读取插图信息失败:', error);
    return null;
  }
}

async function getImageUrl(characterName: string, relativePath: string): Promise<string | null> {
  try {
    if (!isCurrentCharacter(characterName)) return null;
    const current = currentCharacter()!;
    const key = `img:${cacheKey(current, relativePath)}`;
    return await resolveUrl(key, () => readCharacterImage(current, relativePath));
  } catch (error) {
    console.warn('[Illustration-Gremlin] 读取插图失败:', error);
    return null;
  }
}

async function getImageUrlByName(name: string): Promise<string | null> {
  const normalized = normalizeName(name);
  const current = currentCharacter();
  if (!normalized || !current) return null;
  try {
    const key = `name:${sanitizeDirectoryName(current)}:${normalized}`;
    return await resolveUrl(key, async () => (await findCharacterImageByName(current, name))?.blob ?? null);
  } catch (error) {
    console.warn('[Illustration-Gremlin] 按名称查找插图失败:', name, error);
    return null;
  }
}

async function findImage(name: string): Promise<IllustrationImageRef | null> {
  const normalized = normalizeName(name);
  const current = currentCharacter();
  if (!normalized || !current) return null;
  try {
    const key = `name:${sanitizeDirectoryName(current)}:${normalized}`;
    const cachedUrl = urlCache.get(key);
    if (cachedUrl !== undefined) {
      // URL 已有缓存时, 重新解析一次元信息
      const image = await findCharacterImageByName(current, name);
      if (!image) return null;
      const info = infoFromRelativePath(current, image.relativePath, image.blob);
      return { info, url: cachedUrl };
    }

    const image = await findCharacterImageByName(current, name);
    if (!image) return null;
    const url = URL.createObjectURL(image.blob);
    urlCache.set(key, url);
    return { info: infoFromRelativePath(current, image.relativePath, image.blob), url };
  } catch (error) {
    console.warn('[Illustration-Gremlin] 按名称查找插图失败:', name, error);
    return null;
  }
}

function infoFromRelativePath(characterName: string, relativePath: string, blob: Blob): IllustrationImageInfo {
  const fileName = relativePath.split('/').filter(Boolean).pop() ?? relativePath;
  return {
    character: sanitizeDirectoryName(characterName),
    relativePath,
    fileName,
    baseName: fileNameWithoutExtension(fileName),
    mimeType: blob.type || guessMimeType(fileName),
    size: blob.size,
  };
}

function revokeUrl(url: string): void {
  for (const [key, value] of urlCache) {
    if (value === url) {
      urlCache.delete(key);
    }
  }
  URL.revokeObjectURL(url);
}

function clearCache(): void {
  for (const url of urlCache.values()) {
    URL.revokeObjectURL(url);
  }
  urlCache.clear();
  clearImageLookupCache();
}

const api: IllustrationGremlinApi = {
  version: PUBLIC_API_VERSION,
  isAvailable,
  getCurrentCharacterName,
  listImages,
  getImageInfo,
  getImageUrl,
  getImageUrlByName,
  findImage,
  revokeUrl,
  clearCache,
};

type TavernHelperWindow = {
  TavernHelper?: {
    initializeGlobal?: (name: string, value: unknown) => unknown;
  };
};

/** 将接口注册到酒馆助手的全局共享中, 让前端界面可通过 waitGlobalInitialized('IllustrationGremlin') 使用 */
function registerWithTavernHelper(attempt = 0): void {
  const tavernHelper = (window as TavernHelperWindow).TavernHelper;
  if (tavernHelper && typeof tavernHelper.initializeGlobal === 'function') {
    try {
      tavernHelper.initializeGlobal(PUBLIC_API_GLOBAL_NAME, api);
      return;
    } catch (error) {
      console.warn('[Illustration-Gremlin] 注册 tavern_helper 全局接口失败:', error);
    }
  }
  // 酒馆助手可能尚未加载完成, 稍后重试
  if (attempt < TAVERN_HELPER_RETRY_LIMIT) {
    window.setTimeout(() => registerWithTavernHelper(attempt + 1), TAVERN_HELPER_RETRY_DELAY_MS);
  }
}

/** 初始化公开接口: 挂到 window 上, 并尝试注册到酒馆助手 */
export function initPublicApi(): void {
  window.IllustrationGremlin = api;
  registerWithTavernHelper();
}

/** 导入/删除图片后调用, 让公开接口返回的旧 URL 尽快失效 */
export function clearPublicApiCache(): void {
  clearCache();
}

declare global {
  interface Window {
    IllustrationGremlin?: IllustrationGremlinApi;
  }
}
