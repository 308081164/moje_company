import type { ProcessInfo } from '@/types/order';
import { ProcessType } from '@/types/order';

const LEGACY_PROCESS_LABEL: Partial<Record<ProcessType, string>> = {
  [ProcessType.ENAMEL]: '珐琅',
  [ProcessType.WIRE_DRAWING]: '拉丝',
  [ProcessType.SAND_BLASTING]: '喷砂',
  [ProcessType.NAIL_SAND]: '钉砂',
  [ProcessType.OTHER]: '其他',
};

export const OTHER_VALUE_PREFIX = 'other:';

export function savedProcessToSelectValue(p: ProcessInfo, config: ProcessInfo[]): string {
  const name = (p.customProcess || '').trim();
  if (name) {
    const hit = config.find(
      (c) =>
        (c.customProcess || '').trim() === name && String(c.processType) === ProcessType.OTHER
    );
    if (hit?.id != null) return String(hit.id);
    return `${OTHER_VALUE_PREFIX}${name}`;
  }
  return String(p.processType);
}

export function formatSavedProcessLine(p: ProcessInfo): string {
  const name = (p.customProcess || '').trim();
  if (name) return name;
  const pt = p.processType as ProcessType;
  return LEGACY_PROCESS_LABEL[pt] || String(p.processType);
}

export function buildProcessInfoFromSelectKeys(
  selectedProcesses: string[],
  processConfig: ProcessInfo[]
): ProcessInfo[] {
  return selectedProcesses.map((key) => {
    const cfg = processConfig.find((p) => p.id != null && String(p.id) === key);
    if (cfg) {
      return {
        id: cfg.id,
        processType: cfg.processType,
        customProcess: cfg.customProcess,
        additionalCost: cfg.additionalCost ?? 0,
        notes: cfg.notes,
      };
    }
    if (key.startsWith(OTHER_VALUE_PREFIX)) {
      return {
        processType: ProcessType.OTHER,
        customProcess: key.slice(OTHER_VALUE_PREFIX.length),
        additionalCost: 0,
      };
    }
    return {
      processType: key as ProcessType,
      additionalCost: 0,
    };
  });
}

export function craftSelectOptionsFrom(
  processConfig: ProcessInfo[],
  savedProcessInfo?: ProcessInfo[] | null
): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const p of processConfig) {
    if (p.id == null) continue;
    const value = String(p.id);
    const name = (p.customProcess || '').trim();
    const label = name ? `${name} (${value})` : `${String(p.processType)} (${value})`;
    opts.push({ value, label });
    seen.add(value);
  }
  for (const row of savedProcessInfo || []) {
    const v = savedProcessToSelectValue(row, processConfig);
    if (!seen.has(v)) {
      seen.add(v);
      opts.push({ value: v, label: formatSavedProcessLine(row) });
    }
  }
  return opts;
}

export function processSelectValuesFromDesign(
  processInfo: ProcessInfo[] | undefined | null,
  processConfig: ProcessInfo[]
): string[] {
  if (!processInfo?.length) return [];
  return processInfo.map((p) => savedProcessToSelectValue(p, processConfig));
}
