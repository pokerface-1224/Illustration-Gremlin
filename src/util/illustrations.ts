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

export type CharacterImageUpdateResult = {
  /** 本次写入的图片总数（含覆盖与新增） */
  total: number;
  /** 覆盖的已有同名图片数 */
  overwritten: number;
  /** 新写入的图片数 */
  added: number;
};

/** 更新图片到沙箱 illustrations/<角色名>/ 目录: 与现有完全同名的文件直接覆盖, 其余旧图保留 */
export async function updateCharacterImages(
  characterName: string,
  images: ArchiveImage[],
): Promise<CharacterImageUpdateResult> {
  const root = await getIllustrationsRoot();
  const characterDir = await root.getDirectoryHandle(sanitizeDirectoryName(characterName), { create: true });

  const existingNames = new Set<string>();
  for await (const entry of characterDir.values()) {
    if (entry.kind === 'file') existingNames.add(entry.name);
  }

  const usedNames = new Set(existingNames);
  const handledNames = new Set<string>();
  let overwritten = 0;
  let added = 0;

  for (const image of images) {
    let name = image.name;
    // 同一压缩包展平后出现同名时, 仍追加序号, 避免覆盖同批次刚写入的图片
    if (handledNames.has(name)) {
      name = makeUniqueName(name, usedNames);
    }

    const overwriting = existingNames.has(name);
    const fileHandle = await characterDir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable({ keepExistingData: false });
    await writable.write(image.blob);
    await writable.close();

    if (overwriting) {
      overwritten += 1;
    } else {
      added += 1;
    }
    handledNames.add(name);
    usedNames.add(name);
  }

  return {
    total: handledNames.size,
    overwritten,
    added,
  };
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

/** 递归删除某个角色目录下的全部文件与空子目录, 最后删除角色目录本身; 返回删除的图片张数 */
export async function deleteAllCharacterImages(characterName: string): Promise<number> {
  const root = await getIllustrationsRoot();
  const dirName = sanitizeDirectoryName(characterName);
  let characterDir: FileSystemDirectoryHandle;
  try {
    characterDir = await root.getDirectoryHandle(dirName);
  } catch {
    return 0;
  }

  async function removeTree(dir: FileSystemDirectoryHandle): Promise<number> {
    let count = 0;
    // 先收集再删除, 避免遍历时移除条目导致迭代器失效
    const children: { name: string; kind: 'file' | 'directory' }[] = [];
    for await (const entry of dir.values()) {
      children.push({ name: entry.name, kind: entry.kind });
    }
    for (const child of children) {
      if (child.kind === 'directory') {
        const subDir = await dir.getDirectoryHandle(child.name);
        count += await removeTree(subDir);
        await dir.removeEntry(child.name);
      } else {
        if (isImageFileName(child.name)) {
          count += 1;
        }
        await dir.removeEntry(child.name);
      }
    }
    return count;
  }

  const count = await removeTree(characterDir);
  await root.removeEntry(dirName);
  return count;
}

/** 重命名某角色目录下的图片 (保持所在子目录不变); 校验空名、非法字符、图片扩展名与目标重名 */
export async function renameCharacterImage(
  characterName: string,
  relativePath: string,
  newFileName: string,
): Promise<string> {
  const name = newFileName.trim();
  if (!name) {
    throw new Error('文件名不能为空');
  }
  if (name.includes('/') || name.includes('\\')) {
    throw new Error('文件名不能包含路径分隔符');
  }
  if (INVALID_PATH_CHARS.test(name)) {
    INVALID_PATH_CHARS.lastIndex = 0;
    throw new Error('文件名包含非法字符');
  }
  if (!isImageFileName(name)) {
    throw new Error('文件名必须是受支持的图片格式');
  }

  const root = await getIllustrationsRoot();
  const characterDir = await root.getDirectoryHandle(sanitizeDirectoryName(characterName));
  const parts = relativePath.split('/').filter(Boolean);
  const oldName = parts.pop();
  if (!oldName) {
    throw new Error('无效的文件路径');
  }
  if (oldName === name) {
    return relativePath;
  }
  const dirPrefix = parts.join('/');

  let dir = characterDir;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part);
  }

  // 目标已存在时拒绝覆盖
  try {
    await dir.getFileHandle(name);
    throw new Error('同名文件已存在');
  } catch (error) {
    if (error instanceof Error && error.message === '同名文件已存在') {
      throw error;
    }
  }

  // 用 复制 + 删除 实现改名, 兼容不支持 FileSystemFileHandle.move 的浏览器
  const sourceHandle = await dir.getFileHandle(oldName);
  const sourceFile = await sourceHandle.getFile();
  const targetHandle = await dir.getFileHandle(name, { create: true });
  const writable = await targetHandle.createWritable();
  await writable.write(sourceFile);
  await writable.close();
  await dir.removeEntry(oldName);

  return dirPrefix ? `${dirPrefix}/${name}` : name;
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
