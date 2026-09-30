// Vietnamese labels. Relations are stored once; `perspective` names them from the page owner's side.

export type RelationType = 'master' | 'friend' | 'enemy' | 'kin' | 'dao_companion' | 'colleague' | 'acquaintance'
export type Perspective = RelationType | 'disciple'

export const RELATION_LABEL: Record<Perspective, string> = {
  master: 'Sư phụ', disciple: 'Đệ tử', friend: 'Bằng hữu', enemy: 'Kẻ thù', kin: 'Người thân',
  dao_companion: 'Đạo lữ', colleague: 'Đồng môn', acquaintance: 'Quen biết',
}
export const RELATION_SEAL: Record<Perspective, string> = {
  master: '师', disciple: '徒', friend: '友', enemy: '敌', kin: '亲', dao_companion: '侣', colleague: '同', acquaintance: '识',
}
/** Display order of relation groups on a profile. */
export const RELATION_ORDER: Perspective[] = ['master', 'disciple', 'dao_companion', 'kin', 'friend', 'enemy', 'colleague', 'acquaintance']

/** (a, b, 'master') = b is a's master, so from b's page a is a disciple. */
export const perspective = (type: RelationType, ownerIsA: boolean): Perspective =>
  type === 'master' && !ownerIsA ? 'disciple' : type

export const ATTR_LABEL = { realm: 'Cảnh giới', faction: 'Thế lực', location: 'Khu vực', status: 'Trạng thái' } as const
export type Attr = keyof typeof ATTR_LABEL
