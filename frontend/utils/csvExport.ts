/**
 * @fileoverview Shared CSV/Excel export and download utilities.
 * Provides functions to generate CSV strings from data arrays,
 * trigger file downloads on web, and share files on native platforms.
 * Also includes a shared PDF export helper via pdfService.
 */

import { Platform, Share } from 'react-native';

/**
 * Column definition for CSV export.
 * @property key - The object key to extract the value from each row.
 * @property label - The header label displayed in the CSV file.
 * @property format - Optional formatter function for the cell value.
 */
export interface ExportColumn<T> {
  key: keyof T | string;
  label: string;
  format?: (value: unknown, row: T) => string;
}

/**
 * Escapes a CSV cell value (handles commas, quotes, newlines).
 */
function escapeCSVCell(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generates a CSV string from an array of objects using column definitions.
 * Uses semicolon separator for French locale compatibility with Excel.
 *
 * @param data - Array of row objects to export.
 * @param columns - Column definitions with key, label, and optional formatter.
 * @returns CSV string with BOM for Excel UTF-8 compatibility.
 */
export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
): string {
  const SEP = ';';
  const BOM = '\uFEFF';

  const headerRow = columns.map((col) => escapeCSVCell(col.label)).join(SEP);

  const dataRows = data.map((row) => {
    return columns.map((col) => {
      const rawValue = getNestedValue(row, col.key as string);
      let formatted = '';
      if (col.format) {
        formatted = col.format(rawValue, row);
      } else if (rawValue != null) {
        if (typeof rawValue === 'object') {
          formatted = JSON.stringify(rawValue);
        } else {
          formatted = String(rawValue as string | number | boolean);
        }
      }
      return escapeCSVCell(formatted);
    }).join(SEP);
  });

  return BOM + [headerRow, ...dataRows].join('\n');
}

/**
 * Gets a potentially nested value from an object using dot notation.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Generates a CSV template string (headers only) for import reference.
 *
 * @param columns - Column definitions to generate template headers.
 * @returns CSV string with only the header row.
 */
export function generateCSVTemplate(columns: { label: string }[]): string {
  const SEP = ';';
  const BOM = '\uFEFF';
  return BOM + columns.map((col) => escapeCSVCell(col.label)).join(SEP);
}

/**
 * Downloads/shares a CSV file.
 * - On web: creates a Blob and triggers a download via anchor click.
 * - On native: uses Share API to share the CSV text content.
 *
 * @param csvContent - The CSV string to export.
 * @param fileName - Desired file name (without extension for native).
 */
export async function downloadCSV(csvContent: string, fileName: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }

    await Share.share({
      message: csvContent,
      title: fileName,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * One-step export: generates CSV from data and triggers download/share.
 *
 * @param data - Array of row objects.
 * @param columns - Column definitions.
 * @param fileName - File name for the export.
 * @returns Whether the export was successful.
 */
export async function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  fileName: string,
): Promise<boolean> {
  const csv = generateCSV(data, columns);
  return downloadCSV(csv, fileName);
}

/**
 * Detects the CSV separator from the first line of text.
 * Supports tab, semicolon, and comma separators.
 */
export function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  if (tabCount > semiCount && tabCount > commaCount) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
}

/**
 * Parses a CSV/TSV text into headers and rows.
 * Auto-detects the separator character.
 *
 * @param text - Raw CSV text to parse.
 * @returns Parsed headers and row arrays.
 */
export function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const sep = detectSeparator(text);
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows = lines.slice(1).map((line) =>
    line.split(sep).map((cell) => cell.trim().replace(/^["']|["']$/g, ''))
  );
  return { headers, rows };
}

/**
 * Strips French accents from a string for fuzzy matching.
 */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Attempts to auto-map CSV headers to app field definitions.
 * Uses normalized string matching (lowercase, no accents, no spaces).
 *
 * @param csvHeaders - Array of CSV column header strings.
 * @param appFields - Array of app field definitions with key, label, and aliases.
 * @returns Array of mappings from CSV column to app field key.
 */
export function autoMapHeaders(
  csvHeaders: string[],
  appFields: { key: string; label: string; aliases?: string[] }[],
): { csvColumn: string; appField: string }[] {
  return csvHeaders.map((h) => {
    const normalized = stripAccents(h.toLowerCase().replace(/[_\-\s]+/g, ''));
    const match = appFields.find((f) => {
      const keyNorm = stripAccents(f.key.toLowerCase().replace(/[_\-\s]+/g, ''));
      const labelNorm = stripAccents(f.label.toLowerCase().replace(/[_\-\s]+/g, ''));
      if (keyNorm === normalized || labelNorm === normalized) return true;
      if (normalized.includes(keyNorm) || keyNorm.includes(normalized)) return true;
      if (f.aliases) {
        return f.aliases.some((alias) => {
          const aliasNorm = stripAccents(alias.toLowerCase().replace(/[_\-\s]+/g, ''));
          return aliasNorm === normalized || normalized.includes(aliasNorm);
        });
      }
      return false;
    });
    return { csvColumn: h, appField: match?.key || '' };
  });
}
