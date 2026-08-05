import { getContext } from '@sillytavern/scripts/st-context';

/** 获取当前打开的角色卡名称; 未打开角色卡或处于群聊时返回 null/群名 */
export function getCurrentCharacterName(): string | null {
  const context = getContext();
  const character = context.characters[Number(context.characterId)];
  if (character?.name) {
    return character.name;
  }
  if (context.groupId) {
    const group = context.groups.find(g => g.id == context.groupId);
    if (group?.name) {
      return group.name;
    }
  }
  return context.name2 || null;
}
