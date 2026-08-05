/** lib.dom 缺失的 File System API 声明补充 (OPFS) */
declare global {
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
  }
}

export {};
