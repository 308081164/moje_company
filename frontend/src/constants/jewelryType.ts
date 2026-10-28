export enum JewelryType {
  RING = 'RING',
  NECKLACE = 'NECKLACE',
  EARRING = 'EARRING',
  BROOCH = 'BROOCH',
  BRACELET = 'BRACELET',
  COLLARBONE = 'COLLARBONE',
  HAIR = 'HAIR',
  CHARM = 'CHARM',
  OTHER = 'OTHER',
}

export const JEWELRY_TYPE_OPTIONS: { value: JewelryType; label: string }[] = [
  { value: JewelryType.RING, label: '戒指' },
  { value: JewelryType.NECKLACE, label: '项链' },
  { value: JewelryType.BROOCH, label: '胸针' },
  { value: JewelryType.EARRING, label: '耳钉/耳饰' },
  { value: JewelryType.BRACELET, label: '手镯' },
  { value: JewelryType.COLLARBONE, label: '锁骨链' },
  { value: JewelryType.HAIR, label: '发饰' },
  { value: JewelryType.CHARM, label: '小挂件' },
  { value: JewelryType.OTHER, label: '其他' },
];

export function jewelryTypeLabel(type?: string | null): string {
  const found = JEWELRY_TYPE_OPTIONS.find((o) => o.value === type);
  return found?.label ?? type ?? '-';
}

export type HandSizeFieldMeta = {
  visible: boolean;
  label: string;
  required: boolean;
  placeholder?: string;
};

export function handSizeFieldMeta(type?: string | null): HandSizeFieldMeta {
  switch (type) {
    case JewelryType.RING:
      return { visible: true, label: '手寸', required: true, placeholder: '如港码 12，或内径 mm' };
    case JewelryType.NECKLACE:
      return { visible: true, label: '链长', required: false, placeholder: '选填，如 40cm；是否配链以客户问卷为准' };
    case JewelryType.COLLARBONE:
      return { visible: true, label: '链子样式', required: false, placeholder: '选填，客户问卷中的锁骨链样式' };
    case JewelryType.BRACELET:
      return { visible: true, label: '圈口', required: false, placeholder: '如闭口内径 58mm，或腕围 cm' };
    case JewelryType.EARRING:
    case JewelryType.BROOCH:
    case JewelryType.HAIR:
    case JewelryType.CHARM:
      return { visible: false, label: '', required: false };
    default:
      return { visible: true, label: '手寸/链长', required: false, placeholder: '选填' };
  }
}
