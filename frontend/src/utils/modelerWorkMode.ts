/** 与后端 ModelerWorkStatus.WorkMode 枚举名一致 */
export const MODELER_WORK_MODE_VALUES = ['AUTO', 'C2C_ONLY', 'B2B_ONLY'] as const;
export type ModelerWorkModeValue = (typeof MODELER_WORK_MODE_VALUES)[number];

export const MODELER_WORK_MODE_OPTIONS: { value: ModelerWorkModeValue; label: string; description: string }[] = [
  {
    value: 'AUTO',
    label: '自动接单',
    description: 'C 端与 B 端订单均可参与自动派单',
  },
  {
    value: 'C2C_ONLY',
    label: '仅 C 端任务',
    description: '只接收内部 / C 端渠道的建模派单',
  },
  {
    value: 'B2B_ONLY',
    label: '仅 B 端任务',
    description: '只接收 B 端门户渠道的建模派单',
  },
];

export function modelerWorkModeLabel(mode: string | undefined | null): string {
  if (!mode) return '自动接单';
  const row = MODELER_WORK_MODE_OPTIONS.find((o) => o.value === mode);
  return row?.label ?? mode;
}
