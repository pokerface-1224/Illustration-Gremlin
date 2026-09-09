import { clearPublicApiCache } from '@/publicApi';
import { clearImageLookupCache } from '@/util/illustrations';
import { clearPlaceholderUrlCache, reprocessAllMessages } from '@/util/placeholderImages';

/**
 * 图片被导入/删除/改名/清空后统一调用:
 * 让公开接口、占位符查找、聊天消息中的 ${名称} 立即按最新状态重新解析。
 */
export function syncAfterImageChange(): void {
  clearImageLookupCache();
  clearPlaceholderUrlCache();
  clearPublicApiCache();
  reprocessAllMessages();
}
