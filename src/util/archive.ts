/** 支持在浏览器中解压 ZIP 图包 (store/deflate), 返回其中的图片文件列表 */

export type ArchiveImage = {
  /** 图片文件名 (已去除路径, 保证安全) */
  name: string;
  blob: Blob;
  size: number;
};

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.avif',
  '.svg',
]);

const SIGNATURE_CENTRAL_DIRECTORY = 0x02014b50;
const SIGNATURE_LOCAL_HEADER = 0x04034b50;
const SIGNATURE_ZIP64_EOCD = 0x06064b50;
const SIGNATURE_ZIP64_LOCATOR = 0x07064b50;

const FLAG_ENCRYPTED = 0x1;
const FLAG_UTF8 = 0x800;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

/** 从缓冲区尾部查找 EOCD 记录 */
function findEndOfCentralDirectory(data: Uint8Array<ArrayBuffer>): DataView {
  const maxBackwardSearch = Math.min(data.byteLength, 65557);
  for (let i = data.byteLength - 22; i >= data.byteLength - maxBackwardSearch; i--) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) {
      return new DataView(data.buffer, data.byteOffset + i, 22);
    }
  }
  throw new Error('不是有效的 ZIP 文件: 找不到中央目录结尾记录');
}

function readUInt16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUInt32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/** 查找 ZIP64 EOCD 记录 (若存在), 用于读取 64 位尺寸 */
function findZip64EndOfCentralDirectory(data: Uint8Array<ArrayBuffer>, eocdOffset: number): DataView | null {
  if (eocdOffset < 20) return null;
  const locatorOffset = eocdOffset - 20;
  const locator = new DataView(data.buffer, data.byteOffset + locatorOffset, 20);
  if (readUInt32(locator, 0) !== SIGNATURE_ZIP64_LOCATOR) return null;
  const zip64EocdOffset = Number(locator.getBigUint64(8, true));
  if (zip64EocdOffset < 0 || zip64EocdOffset + 56 > data.byteLength) return null;
  const zip64Eocd = new DataView(data.buffer, data.byteOffset + zip64EocdOffset, 56);
  if (readUInt32(zip64Eocd, 0) !== SIGNATURE_ZIP64_EOCD) return null;
  return zip64Eocd;
}

/** CP437 解码 (ZIP 中非 UTF-8 文件名的默认编码) */
function decodeCP437(bytes: Uint8Array): string {
  // CP437 高半区映射为对应的 Unicode 字符
  const highTable: Record<number, number> = {
    0x80: 0x00c7, 0x81: 0x00fc, 0x82: 0x00e9, 0x83: 0x00e2, 0x84: 0x00e4, 0x85: 0x00e0,
    0x86: 0x00e5, 0x87: 0x00e7, 0x88: 0x00ea, 0x89: 0x00eb, 0x8a: 0x00e8, 0x8b: 0x00ef,
    0x8c: 0x00ee, 0x8d: 0x00ec, 0x8e: 0x00c4, 0x8f: 0x00c5, 0x90: 0x00c9, 0x91: 0x00e6,
    0x92: 0x00c6, 0x93: 0x00f4, 0x94: 0x00f6, 0x95: 0x00f2, 0x96: 0x00fb, 0x97: 0x00f9,
    0x98: 0x00ff, 0x99: 0x00d6, 0x9a: 0x00dc, 0x9b: 0x00a2, 0x9c: 0x00a3, 0x9d: 0x00a5,
    0x9e: 0x20a7, 0x9f: 0x0192, 0xa0: 0x00e1, 0xa1: 0x00ed, 0xa2: 0x00f3, 0xa3: 0x00fa,
    0xa4: 0x00f1, 0xa5: 0x00d1, 0xa6: 0x00aa, 0xa7: 0x00ba, 0xa8: 0x00bf, 0xa9: 0x2310,
    0xaa: 0x00ac, 0xab: 0x00bd, 0xac: 0x00bc, 0xad: 0x00a1, 0xae: 0x00ab, 0xaf: 0x00bb,
    0xb0: 0x2591, 0xb1: 0x2592, 0xb2: 0x2593, 0xb3: 0x2502, 0xb4: 0x2524, 0xb5: 0x2561,
    0xb6: 0x2562, 0xb7: 0x2556, 0xb8: 0x2555, 0xb9: 0x2563, 0xba: 0x2551, 0xbb: 0x2557,
    0xbc: 0x255d, 0xbd: 0x255c, 0xbe: 0x255b, 0xbf: 0x2510, 0xc0: 0x2514, 0xc1: 0x2534,
    0xc2: 0x252c, 0xc3: 0x251c, 0xc4: 0x2500, 0xc5: 0x253c, 0xc6: 0x255e, 0xc7: 0x255f,
    0xc8: 0x255a, 0xc9: 0x2554, 0xca: 0x2569, 0xcb: 0x2566, 0xcc: 0x2560, 0xcd: 0x2550,
    0xce: 0x256c, 0xcf: 0x2567, 0xd0: 0x2568, 0xd1: 0x2564, 0xd2: 0x2565, 0xd3: 0x2559,
    0xd4: 0x2558, 0xd5: 0x2552, 0xd6: 0x2553, 0xd7: 0x256b, 0xd8: 0x256a, 0xd9: 0x2518,
    0xda: 0x250c, 0xdb: 0x2588, 0xdc: 0x2584, 0xdd: 0x258c, 0xde: 0x2590, 0xdf: 0x2580,
    0xe0: 0x03b1, 0xe1: 0x00df, 0xe2: 0x0393, 0xe3: 0x03c0, 0xe4: 0x03a3, 0xe5: 0x03c3,
    0xe6: 0x00b5, 0xe7: 0x03c4, 0xe8: 0x03a6, 0xe9: 0x0398, 0xea: 0x03a9, 0xeb: 0x03b4,
    0xec: 0x221e, 0xed: 0x03c6, 0xee: 0x03b5, 0xef: 0x2229, 0xf0: 0x2261, 0xf1: 0x00b1,
    0xf2: 0x2265, 0xf3: 0x2264, 0xf4: 0x2320, 0xf5: 0x2321, 0xf6: 0x00f7, 0xf7: 0x2248,
    0xf8: 0x00b0, 0xf9: 0x2219, 0xfa: 0x00b7, 0xfb: 0x221a, 0xfc: 0x207f, 0xfd: 0x00b2,
    0xfe: 0x25a0, 0xff: 0x00a0,
  };
  let result = '';
  for (const byte of bytes) {
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
    } else {
      result += String.fromCharCode(highTable[byte] ?? byte);
    }
  }
  return result;
}

function decodeFileName(bytes: Uint8Array, isUtf8: boolean): string {
  if (isUtf8) {
    return new TextDecoder('utf-8').decode(bytes);
  }
  return decodeCP437(bytes);
}

function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) !== 0;
}

/** 将文件名规整为安全的 basename, 并判断是否为支持的图片 */
function toSafeImageName(entryName: string): string | null {
  const normalized = entryName.replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized.split('/').some(part => part === '..')) {
    return null;
  }
  const baseName = normalized.split('/').pop() ?? '';
  const lower = baseName.toLowerCase();
  if (!Array.from(IMAGE_EXTENSIONS).some(ext => lower.endsWith(ext))) {
    return null;
  }
  if (!baseName || baseName.startsWith('.')) {
    return null;
  }
  return baseName;
}

/** 解压单个 deflate 数据流 */
async function inflateRaw(data: Uint8Array<ArrayBuffer>, size: number): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持原生解压, 无法导入 zip 压缩包, 请使用 Chrome/Edge 浏览器');
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const result = await new Response(stream).arrayBuffer();
  return new Uint8Array(result, 0, size);
}

/** 解压一个 ZIP 条目 */
async function extractEntry(
  data: Uint8Array<ArrayBuffer>,
  localHeaderOffset: number,
  flags: number,
  method: number,
  compressedSize: number,
  uncompressedSize: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (hasFlag(flags, FLAG_ENCRYPTED)) {
    throw new Error('ZIP 条目已加密, 不支持加密压缩包');
  }

  const view = new DataView(data.buffer, data.byteOffset + localHeaderOffset, Math.min(data.byteLength - localHeaderOffset, 30));
  if (readUInt32(view, 0) !== SIGNATURE_LOCAL_HEADER) {
    throw new Error('ZIP 本地文件头损坏');
  }

  const nameLength = readUInt16(view, 26);
  const extraLength = readUInt16(view, 28);
  const dataOffset = localHeaderOffset + 30 + nameLength + extraLength;
  if (dataOffset + compressedSize > data.byteLength) {
    throw new Error('ZIP 条目数据不完整');
  }
  const compressed = data.subarray(dataOffset, dataOffset + compressedSize);

  if (method === METHOD_STORED) {
    return compressed;
  }
  if (method === METHOD_DEFLATE) {
    return inflateRaw(compressed, uncompressedSize);
  }
  throw new Error(`不支持的 ZIP 压缩方式 (${method}), 无法解压该压缩包`);
}

/** 解析 ZIP 中央目录, 返回所有图片条目 */
export async function extractZipImages(file: Blob): Promise<ArchiveImage[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  if (data.byteLength < 22) {
    throw new Error('文件太小, 不是有效的 ZIP');
  }

  const eocdOffset = data.byteLength - 22;
  const eocd = findEndOfCentralDirectory(data);
  const totalEntries = readUInt16(eocd, 10);
  let centralDirectoryOffset = readUInt32(eocd, 16);

  // 处理 ZIP64
  const zip64Eocd = findZip64EndOfCentralDirectory(data, eocdOffset);
  let totalEntries64: number | null = null;
  if (zip64Eocd) {
    totalEntries64 = Number(zip64Eocd.getBigUint64(32, true));
    centralDirectoryOffset = Number(zip64Eocd.getBigUint64(48, true));
  }

  const entriesCount = totalEntries64 ?? totalEntries;
  const results: ArchiveImage[] = [];

  let offset = centralDirectoryOffset;
  for (let index = 0; index < entriesCount; index++) {
    if (offset + 46 > data.byteLength) {
      throw new Error('ZIP 中央目录不完整');
    }
    const header = new DataView(data.buffer, data.byteOffset + offset, 46);
    if (readUInt32(header, 0) !== SIGNATURE_CENTRAL_DIRECTORY) {
      throw new Error('ZIP 中央目录记录损坏');
    }

    const flags = readUInt16(header, 8);
    const method = readUInt16(header, 10);
    let compressedSize = readUInt32(header, 20);
    let uncompressedSize = readUInt32(header, 24);
    const nameLength = readUInt16(header, 28);
    const extraLength = readUInt16(header, 30);
    const commentLength = readUInt16(header, 32);
    let localHeaderOffset = readUInt32(header, 42);

    // ZIP64 扩展字段: 依次读取 localHeaderOffset、compressedSize、uncompressedSize
    if (localHeaderOffset === 0xffffffff || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      const extraStart = offset + 46 + nameLength;
      const extra = new DataView(data.buffer, data.byteOffset + extraStart, extraLength);
      let pos = 0;
      while (pos + 4 <= extraLength) {
        const headerId = readUInt16(extra, pos);
        const dataSize = readUInt16(extra, pos + 2);
        if (headerId === 0x0001) {
          let fieldPos = pos + 4;
          if (localHeaderOffset === 0xffffffff && fieldPos + 8 <= pos + 4 + dataSize) {
            localHeaderOffset = Number(extra.getBigUint64(fieldPos, true));
            fieldPos += 8;
          }
          if (compressedSize === 0xffffffff && fieldPos + 8 <= pos + 4 + dataSize) {
            compressedSize = Number(extra.getBigUint64(fieldPos, true));
            fieldPos += 8;
          }
          if (uncompressedSize === 0xffffffff && fieldPos + 8 <= pos + 4 + dataSize) {
            uncompressedSize = Number(extra.getBigUint64(fieldPos, true));
          }
          break;
        }
        pos += 4 + dataSize;
      }
    }

    const nameBytes = data.subarray(offset + 46, offset + 46 + nameLength);
    const entryName = decodeFileName(nameBytes, hasFlag(flags, FLAG_UTF8));
    const safeName = toSafeImageName(entryName);

    // 跳过目录项
    const isDirectory = entryName.endsWith('/') || entryName.endsWith('\\') || uncompressedSize === 0 && entryName === '';
    if (safeName && !isDirectory) {
      const content = await extractEntry(
        data,
        localHeaderOffset,
        flags,
        method,
        compressedSize,
        uncompressedSize,
      );
      results.push({
        name: safeName,
        blob: new Blob([content]),
        size: uncompressedSize,
      });
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return results;
}
