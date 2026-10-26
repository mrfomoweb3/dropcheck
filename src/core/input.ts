// Parse pasted text or CSV into raw rows. Caps rows/line length; strips everything but the two cells.
import Papa from 'papaparse';
import type { RawRow } from './types';

export interface ParseLimits {
  maxRows: number;
  maxLineLength: number;
}

export interface ParseOutput {
  rows: RawRow[];
  errors: string[];
}

const HEADER = /^(address|recipient|wallet|account|to)$/i;
// Keep printable ASCII only in cells: addresses and amounts never need more.
const clean = (s: unknown) => String(s ?? '').replace(/[^\x21-\x7e]/g, '').slice(0, 120);

export function parseInput(text: string, limits: ParseLimits): ParseOutput {
  const errors: string[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const kept: string[] = [];
  const lineNos: number[] = [];
  lines.forEach((l, i) => {
    if (!l.trim() || l.trim().startsWith('#')) return;
    if (l.length > limits.maxLineLength) {
      errors.push(`Line ${i + 1} is longer than ${limits.maxLineLength} characters and was skipped.`);
      return;
    }
    kept.push(l);
    lineNos.push(i + 1);
  });

  const rows: RawRow[] = [];
  kept.forEach((l, idx) => {
    const line = lineNos[idx];
    let cells: string[];
    if (/[,;\t]/.test(l)) {
      const parsed = Papa.parse<string[]>(l.trim(), { delimitersToGuess: [',', ';', '\t'] });
      cells = (parsed.data[0] ?? []).map((c) => String(c).trim()).filter((c) => c !== '');
      // "5Grw...,1,000" style: rejoin a thousands-separated amount.
      if (cells.length > 2 && cells.slice(2).every((c) => /^\d{3}(\.\d*)?$/.test(c)) && /^\d{1,3}$/.test(cells[1])) {
        cells = [cells[0], cells.slice(1).join(',')];
      }
    } else {
      cells = l.trim().split(/\s+/);
    }
    if (idx === 0 && cells[0] && HEADER.test(cells[0].trim())) return;
    rows.push({ line, addressInput: clean(cells[0]), amountInput: clean(cells[1]) });
  });

  if (rows.length > limits.maxRows) {
    errors.push(`Only the first ${limits.maxRows} rows are checked (${rows.length} given).`);
    rows.length = limits.maxRows;
  }
  return { rows, errors };
}
