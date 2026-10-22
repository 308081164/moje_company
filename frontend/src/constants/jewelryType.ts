export enum JewelryType {
  RING = 'RING',
  NECKLACE = 'NECKLACE',
  EARRING = 'EARRING',
  BROOCH = 'BROOCH',
  BRACELET = 'BRACELET',
  OTHER = 'OTHER',
}

export const JEWELRY_TYPE_OPTIONS: { value: JewelryType; label: string }[] = [
  { value: JewelryType.RING, label: '戒指' },
  { value: JewelryType.NECKLACE, label: '项链' },
  { value: JewelryType.EARRING, label: '耳钉/耳环' },
  { value: JewelryType.BROOCH, label: '胸针' },
  { value: JewelryType.BRACELET, label: '手链/手镯' },
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
      return { visible: true, label: '手寸', required: true, placeholder: '如 12、14、16（港码）或内径 mm' };
    case JewelryType.NECKLACE:
      return { visible: true, label: '链长', required: false, placeholder: '选填，如 40cm、45cm' };
    case JewelryType.BRACELET:
      return { visible: true, label: '周长/链长', required: false, placeholder: '选填，如 16cm、18cm' };
    case JewelryType.EARRING:
    case JewelryType.BROOCH:
      return { visible: false, label: '', required: false };
    default:
      return { visible: true, label: '手寸/链长', required: false, placeholder: '选填' };
  }
}
