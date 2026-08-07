import type { ArchiveImage } from '@/util/archive';

/** 插图存储工具: 将图片保存到浏览器沙箱 (OPFS) 的 illustrations/<角色名>/ 目录, 无需任何授权 */

const ILLUSTRATIONS_ROOT = 'illustrations';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif', '.svg']);

/** Windows / 通用文件系统不允许出现在目录名中的字符 */
const INVALID_PATH_CHARS = /[<>:"/\\|?*]/g;

/** 将角色卡名称清洗为安全的目录名 (尽量保留原名) */
export function sanitizeDirectoryName(name: string): string {
  let cleaned = name.replace(INVALID_PATH_CHARS, '_');
  cleaned = Array.from(cleaned)
    .map(char => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .replace(/[. ]+$/g, '')
    .trim();
  const result = cleaned || 'unnamed_character';
  return result.slice(0, 120);
}

export function isImageFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return Array.from(IMAGE_EXTENSIONS).some(ext => lower.endsWith(ext));
}

export function isSandboxStorageSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

/** 获取 (并创建) OPFS 中的 illustrations 根目录 */
export async function getIllustrationsRoot(): Promise<FileSystemDirectoryHandle> {
  if (!isSandboxStorageSupported()) {
    throw new Error('当前浏览器不支持沙箱存储 (OPFS), 请使用新版 Chrome/Edge/Firefox');
  }
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(ILLUSTRATIONS_ROOT, { create: true });
}

function makeUniqueName(fileName: string, existing: Set<string>): string {
  if (!existing.has(fileName)) return fileName;
  const dotIndex = fileName.lastIndexOf('.');
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const ext = dotIndex > 0 ? fileName.slice(dotIndex) : '';
  for (let i = 1; i < 10000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}

/** 写入图片到沙箱 illustrations/<角色名>/ 目录, 重名时自动追加序号 */
export async function writeCharacterImages(characterName: string, images: ArchiveImage[]): Promise<string[]> {
  const root = await getIllustrationsRoot();
  const characterDir = await root.getDirectoryHandle(sanitizeDirectoryName(characterName), { create: true });
  const existing = new Set<string>();
  for await (const entry of characterDir.values()) {
    if (entry.kind === 'file') existing.add(entry.name);
  }

  const written: string[] = [];
  for (const image of images) {
    const uniqueName = makeUniqueName(image.name, existing);
    const fileHandle = await characterDir.getFileHandle(uniqueName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(image.blob);
    await writable.close();
    existing.add(uniqueName);
    written.push(uniqueName);
  }
  return written;
}

/** 递归列出沙箱 illustrations/<角色名>/ 下的图片, 返回相对路径 */
export async function listCharacterImages(characterName: string): Promise<string[]> {
  const root = await getIllustrationsRoot();
  let characterDir: FileSystemDirectoryHandle;
  try {
    characterDir = await root.getDirectoryHandle(sanitizeDirectoryName(characterName));
  } catch {
    return [];
  }

  const files: string[] = [];
  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    for await (const entry of dir.values()) {
      if (entry.kind === 'directory') {
        await walk(entry, prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (isImageFileName(entry.name)) {
        files.push(prefix ? `${prefix}/${entry.name}` : entry.name);
      }
    }
  }
  await walk(characterDir, '');
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return files;
}

export type IllustrationEntry = {
  /** 角色目录名 (已清洗) */
  character: string;
  /** 相对角色目录的路径, 如 "nailong.png" 或 "子目录/xxx.png" */
  relativePath: string;
};

/** 递归列出沙箱 illustrations/ 下所有角色的图片, 返回 角色目录名 + 角色内相对路径 */
export async function listAllImages(): Promise<IllustrationEntry[]> {
  const root = await getIllustrationsRoot();
  const entries: IllustrationEntry[] = [];

  async function walk(dir: FileSystemDirectoryHandle, character: string, prefix: string) {
    for await (const entry of dir.values()) {
      if (entry.kind === 'directory') {
        await walk(entry, character, prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (isImageFileName(entry.name)) {
        entries.push({ character, relativePath: prefix ? `${prefix}/${entry.name}` : entry.name });
      }
    }
  }

  for await (const entry of root.values()) {
    if (entry.kind === 'directory') {
      await walk(entry, entry.name, '');
    }
  }

  entries.sort((a, b) =>
    `${a.character}/${a.relativePath}`.localeCompare(`${b.character}/${b.relativePath}`, undefined, {
      numeric: true,
    }),
  );
  return entries;
}

/** 读取沙箱中某角色的某张图片 */
export async function readCharacterImage(characterName: string, relativePath: string): Promise<Blob | null> {
  const root = await getIllustrationsRoot();
  let characterDir: FileSystemDirectoryHandle;
  try {
    characterDir = await root.getDirectoryHandle(sanitizeDirectoryName(characterName));
  } catch {
    return null;
  }

  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return null;

  let dir = characterDir;
  for (const part of parts) {
    try {
      dir = await dir.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }

  try {
    const fileHandle = await dir.getFileHandle(fileName);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

/** 删除沙箱 illustrations/<角色名>/ 下的图片 */
export async function deleteCharacterImage(characterName: string, relativePath: string): Promise<void> {
  const root = await getIllustrationsRoot();
  const characterDir = await root.getDirectoryHandle(sanitizeDirectoryName(characterName));
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error('无效的文件路径');

  let dir = characterDir;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part);
  }
  await dir.removeEntry(fileName);
}

/** 按文件名（不含扩展名）查找沙箱 illustrations/ 下的图片, 返回 Blob 与相对路径 */
export async function findImageByName(query: string): Promise<{ blob: Blob; relativePath: string } | null> {
  const normalized = normalizeImageQuery(query);
  if (!normalized) return null;

  illustrationIndexCache ??= await buildIllustrationIndex();
  const lower = normalized.toLowerCase();
  const entry = illustrationIndexCache.byFullName.get(lower) ?? illustrationIndexCache.byBaseName.get(lower);
  if (!entry) return null;

  const blob = await readIllustrationByRelativePath(entry.relativePath);
  return blob ? { blob, relativePath: entry.relativePath } : null;
}

/** 清除按文件名查找时的索引缓存（导入/删除图片后调用, 让占位符立即生效） */
export function clearImageLookupCache(): void {
  illustrationIndexCache = null;
}

/** 读取沙箱 illustrations/ 下任意相对路径的图片 */
export async function readIllustrationByRelativePath(relativePath: string): Promise<Blob | null> {
  const root = await getIllustrationsRoot();
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return null;

  let dir = root;
  for (const part of parts) {
    try {
      dir = await dir.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }

  try {
    const fileHandle = await dir.getFileHandle(fileName);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

type IllustrationIndexEntry = {
  relativePath: string;
  fileName: string;
};

type IllustrationIndex = {
  byFullName: Map<string, IllustrationIndexEntry>;
  byBaseName: Map<string, IllustrationIndexEntry>;
};

let illustrationIndexCache: IllustrationIndex | null = null;

function normalizeImageQuery(query: string): string {
  return query.trim().replace(/^["'`]+|["'`]+$/g, '');
}

function fileNameWithoutExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** 递归遍历沙箱 illustrations/ 目录, 建立 “文件名 / 去扩展名文件名 -> 相对路径” 索引 */
async function buildIllustrationIndex(): Promise<IllustrationIndex> {
  const root = await getIllustrationsRoot();
  const byFullName = new Map<string, IllustrationIndexEntry>();
  const byBaseName = new Map<string, IllustrationIndexEntry>();

  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    for await (const entry of dir.values()) {
      if (entry.kind === 'directory') {
        await walk(entry, prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (isImageFileName(entry.name)) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const info: IllustrationIndexEntry = { relativePath, fileName: entry.name };
        const fullKey = entry.name.toLowerCase();
        const baseKey = fileNameWithoutExtension(entry.name).toLowerCase();
        if (!byFullName.has(fullKey)) byFullName.set(fullKey, info);
        if (!byBaseName.has(baseKey)) byBaseName.set(baseKey, info);
      }
    }
  }

  await walk(root, '');
  return { byFullName, byBaseName };
}
