import { findImageByName } from '@/util/illustrations';

/**
 * 捕获聊天消息中的模板字面量 ${名称}, 并替换为 OPFS 中对应文件名的图片。
 * 例: 文中出现 ${远坂凛}, 则替换为 illustrations/ 下文件名为「远坂凛」的图片。
 */

const PLACEHOLDER_PATTERN = /\$\{([^{}]+)\}/g;
const IMAGE_CLASS = 'opfs-placeholder-image';
const PROCESS_DELAY_MS = 120;
const SKIP_TAGS = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'KBD', 'SAMP', 'TEXTAREA']);

type PlaceholderMatch = {
  raw: string;
  name: string;
};

type TextNodeJob = {
  node: Text;
  text: string;
  matches: PlaceholderMatch[];
};

/** 已解析的占位符名 -> object URL, 避免反复读取 OPFS */
const urlCache = new Map<string, string>();
const pendingElements = new Set<HTMLElement>();
let processTimer: number | null = null;
let observerInitialized = false;

/** 清除 object URL 缓存（图片被导入/删除后调用, 让占位符立即重新查找） */
export function clearPlaceholderUrlCache(): void {
  urlCache.clear();
}

/** 重新扫描聊天中所有已渲染消息, 让新增/删除图片后占位符立即生效 */
export function reprocessAllMessages(): void {
  document.querySelectorAll<HTMLElement>('#chat .mes_text').forEach(scheduleProcess);
}

async function resolvePlaceholderUrl(name: string): Promise<string | null> {
  const cached = urlCache.get(name);
  if (cached !== undefined) return cached;

  try {
    const image = await findImageByName(name);
    if (!image) return null;
    const url = URL.createObjectURL(image.blob);
    urlCache.set(name, url);
    return url;
  } catch (error) {
    console.warn('[图片占位符] 查找图片失败:', name, error);
    return null;
  }
}

function isInsideSkippedTag(node: Node): boolean {
  let element = node.parentElement;
  while (element) {
    if (SKIP_TAGS.has(element.tagName)) return true;
    element = element.parentElement;
  }
  return false;
}

function collectMatches(text: string): PlaceholderMatch[] | null {
  if (!text.includes('${')) return null;
  PLACEHOLDER_PATTERN.lastIndex = 0;
  const matches: PlaceholderMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_PATTERN.exec(text)) !== null) {
    const name = match[1].trim();
    if (name) {
      matches.push({ raw: match[0], name });
    }
  }
  return matches.length > 0 ? matches : null;
}

function createImageElement(url: string, name: string, raw: string): HTMLImageElement {
  const img = document.createElement('img');
  img.className = IMAGE_CLASS;
  img.src = url;
  img.alt = name;
  img.title = name;
  img.draggable = false;
  img.addEventListener('error', () => {
    // 图片加载失败时还原为原始占位符文本
    img.replaceWith(document.createTextNode(raw));
  });
  return img;
}

/** 处理单个消息文本元素: 将 ${名称} 替换为 OPFS 图片 */
export async function processMessageElement(root: HTMLElement): Promise<void> {
  const jobs: TextNodeJob[] = [];
  const names = new Set<string>();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    if (!isInsideSkippedTag(text)) {
      const textValue = text.nodeValue ?? '';
      const matches = collectMatches(textValue);
      if (matches) {
        jobs.push({ node: text, text: textValue, matches });
        for (const match of matches) {
          names.add(match.name);
        }
      }
    }
    node = walker.nextNode();
  }

  if (jobs.length === 0) return;

  const resolved = new Map<string, string | null>();
  await Promise.all(
    Array.from(names, async name => {
      resolved.set(name, await resolvePlaceholderUrl(name));
    }),
  );

  for (const { node, text, matches } of jobs) {
    const parent = node.parentElement;
    if (!parent || node.parentNode !== parent || !node.isConnected) continue;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const { raw, name } of matches) {
      const url = resolved.get(name);
      if (!url) continue;
      const index = text.indexOf(raw, cursor);
      if (index < 0) continue;
      if (index > cursor) {
        fragment.append(text.slice(cursor, index));
      }
      fragment.append(createImageElement(url, name, raw));
      cursor = index + raw.length;
    }

    if (cursor === 0) continue;
    if (cursor < text.length) {
      fragment.append(text.slice(cursor));
    }
    parent.replaceChild(fragment, node);
  }
}

function findMessageTextNode(node: Node): HTMLElement | null {
  if (node instanceof HTMLElement) {
    if (node.classList.contains('mes_text')) return node;
    return node.querySelector('.mes_text') ?? node.closest('.mes_text');
  }
  return node.parentElement?.closest('.mes_text') ?? null;
}

function scheduleProcess(element: HTMLElement | null): void {
  if (!element || !element.isConnected) return;
  pendingElements.add(element);
  if (processTimer !== null) return;

  processTimer = window.setTimeout(() => {
    processTimer = null;
    const elements = Array.from(pendingElements);
    pendingElements.clear();
    void processMany(elements);
  }, PROCESS_DELAY_MS);
}

async function processMany(elements: HTMLElement[]): Promise<void> {
  await Promise.all(
    elements.map(element =>
      processMessageElement(element).catch(error => {
        console.warn('[图片占位符] 处理消息失败:', error);
      }),
    ),
  );
}

/** 初始化: 监听 #chat 中的消息渲染, 自动替换 ${名称} 占位符 */
export function initPlaceholderImages(): void {
  if (observerInitialized || typeof MutationObserver === 'undefined') return;
  observerInitialized = true;

  const chat = document.getElementById('chat');
  if (!chat) return;

  chat.querySelectorAll<HTMLElement>('.mes_text').forEach(scheduleProcess);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        scheduleProcess(findMessageTextNode(mutation.target));
        continue;
      }
      for (const node of mutation.addedNodes) {
        scheduleProcess(findMessageTextNode(node));
      }
    }
  });
  observer.observe(chat, { childList: true, subtree: true, characterData: true });
}
