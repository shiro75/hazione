/**
 * @fileoverview Universal CSV import modal matching the ProductImportModal design.
 * Supports 3 input methods: File CSV upload, Copy-paste, and Manual entry.
 * Configurable columns, auto-detection of separators, preview with validation,
 * and step-by-step import workflow (input → preview → importing → result).
 *
 * Used across all modules: Clients, Devis, Fournisseurs, Commandes, etc.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import {
  FileText, ClipboardPaste, Table, CheckCircle, AlertTriangle,
  XCircle, Plus, Trash2, Upload,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '@/contexts/ThemeContext';
import FormModal from '@/components/FormModal';
import { parseCSVText, autoMapHeaders } from '@/utils/csvExport';

/** Input method tabs */
type ImportMethod = 'file' | 'paste' | 'manual';

/** Wizard steps */
type ImportStep = 'input' | 'preview' | 'importing' | 'result';

/**
 * Field definition for import columns.
 * @property key - Unique field identifier used in the mapped row object.
 * @property label - Display label for the column header.
 * @property required - Whether this field must have a value for a valid row.
 * @property aliases - Alternative header names for auto-mapping.
 */
export interface ImportFieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
}

/**
 * Result returned by the onImport callback.
 */
export interface ImportResult {
  imported: number;
  errors: string[];
}

/**
 * A single parsed and validated preview row.
 */
interface PreviewRow {
  data: Record<string, string>;
  status: 'ready' | 'warning' | 'error';
  statusMessage: string;
}

interface UniversalImportModalProps {
  visible: boolean;
  onClose: () => void;
  /** Title displayed at the top of the modal (e.g. "Importer des clients") */
  title: string;
  /** Entity label used in messages (e.g. "client", "fournisseur") */
  entityLabel: string;
  /** Column/field definitions for the import */
  fields: ImportFieldDef[];
  /** Callback to process validated rows. Returns count of imported + errors. */
  onImport: (rows: Record<string, string>[]) => ImportResult;
  /** Optional placeholder text for the paste textarea */
  pastePlaceholder?: string;
}

export default React.memo(function UniversalImportModal({
  visible,
  onClose,
  title,
  entityLabel,
  fields,
  onImport,
  pastePlaceholder,
}: UniversalImportModalProps) {
  const { colors } = useTheme();

  const [method, setMethod] = useState<ImportMethod>('paste');
  const [step, setStep] = useState<ImportStep>('input');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [manualRows, setManualRows] = useState<Record<string, string>[]>([createEmptyRow(fields)]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  /** Creates an empty row object from field definitions */
  function createEmptyRow(fieldDefs: ImportFieldDef[]): Record<string, string> {
    const row: Record<string, string> = {};
    fieldDefs.forEach((f) => { row[f.key] = ''; });
    return row;
  }

  const handleReset = useCallback(() => {
    setMethod('paste');
    setStep('input');
    setCsvText('');
    setFileName('');
    setManualRows([createEmptyRow(fields)]);
    setPreviewRows([]);
    setImportResult(null);
    setImportProgress(0);
  }, [fields]);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  /** Pick a CSV file from the device */
  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setFileName(asset.name);
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const text = await response.text();
        setCsvText(text);
      } else {
        const text = await FileSystem.readAsStringAsync(asset.uri);
        setCsvText(text);
      }
    } catch {}
  }, []);

  /** Parse CSV text and map to fields, then build preview rows */
  const handleAnalyze = useCallback(() => {
    let mappedRows: Record<string, string>[] = [];

    if (method === 'manual') {
      mappedRows = manualRows.filter((row) =>
        Object.values(row).some((v) => v.trim())
      );
    } else {
      const parsed = parseCSVText(csvText);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) return;

      const mappings = autoMapHeaders(parsed.headers, fields);

      mappedRows = parsed.rows.map((row) => {
        const mapped: Record<string, string> = {};
        mappings.forEach((m, idx) => {
          if (m.appField && row[idx] !== undefined) {
            mapped[m.appField] = row[idx];
          }
        });
        return mapped;
      }).filter((row) => Object.values(row).some((v) => v.trim()));
    }

    if (mappedRows.length === 0) return;

    const preview: PreviewRow[] = mappedRows.map((row) => {
      const missingRequired = fields.filter(
        (f) => f.required && !row[f.key]?.trim()
      );
      if (missingRequired.length > 0) {
        return {
          data: row,
          status: 'error' as const,
          statusMessage: `Champ(s) requis manquant(s): ${missingRequired.map((f) => f.label).join(', ')}`,
        };
      }
      return { data: row, status: 'ready' as const, statusMessage: 'Prêt' };
    });

    setPreviewRows(preview);
    setStep('preview');
  }, [method, csvText, manualRows, fields]);

  /** Execute the import */
  const handleImport = useCallback(() => {
    setStep('importing');
    setImportProgress(0);
    const interval = setInterval(() => {
      setImportProgress((prev) => (prev >= 90 ? prev : prev + 10));
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      const validRows = previewRows
        .filter((r) => r.status !== 'error')
        .map((r) => r.data);
      const result = onImport(validRows);
      setImportProgress(100);
      setImportResult(result);
      setStep('result');
    }, 600);
  }, [previewRows, onImport]);

  /** Update a cell in manual entry */
  const updateManualRow = useCallback((idx: number, fieldKey: string, value: string) => {
    setManualRows((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [fieldKey]: value };
      return updated;
    });
  }, []);

  const addManualRow = useCallback(() => {
    setManualRows((prev) => [...prev, createEmptyRow(fields)]);
  }, [fields]);

  const removeManualRow = useCallback((idx: number) => {
    setManualRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const summary = useMemo(() => {
    const total = previewRows.length;
    const errors = previewRows.filter((r) => r.status === 'error').length;
    const ready = previewRows.filter((r) => r.status === 'ready').length;
    const warnings = previewRows.filter((r) => r.status === 'warning').length;
    return { total, errors, ready, warnings };
  }, [previewRows]);

  const canAnalyze = method === 'manual'
    ? manualRows.some((row) => Object.values(row).some((v) => v.trim()))
    : csvText.trim().length > 0;

  const canImport = summary.ready > 0 || summary.warnings > 0;

  /** Default placeholder for paste mode */
  const defaultPlaceholder = useMemo(() => {
    const headerLine = fields.map((f) => f.label).join(';');
    const exampleLine = fields.map((f) => f.required ? 'valeur' : '').join(';');
    return `${headerLine}\n${exampleLine}`;
  }, [fields]);

  // ===== RENDER METHODS =====

  const renderMethodTabs = () => (
    <View style={[s.methodBar, { borderBottomColor: colors.border }]}>
      {([
        { key: 'file' as const, label: 'Fichier CSV', icon: Upload },
        { key: 'paste' as const, label: 'Copier-coller', icon: ClipboardPaste },
        { key: 'manual' as const, label: 'Saisie manuelle', icon: Table },
      ]).map((m) => (
        <TouchableOpacity
          key={m.key}
          style={[
            s.methodTab,
            {
              backgroundColor: method === m.key ? `${colors.primary}12` : 'transparent',
              borderColor: method === m.key ? colors.primary : 'transparent',
            },
          ]}
          onPress={() => setMethod(m.key)}
          activeOpacity={0.7}
        >
          <m.icon size={14} color={method === m.key ? colors.primary : colors.textSecondary} />
          <Text style={[s.methodTabText, { color: method === m.key ? colors.primary : colors.textSecondary }]}>
            {m.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFileInput = () => (
    <View style={s.section}>
      <TouchableOpacity
        style={[s.filePickBtn, { borderColor: colors.primary, backgroundColor: `${colors.primary}08` }]}
        onPress={handlePickFile}
        activeOpacity={0.7}
      >
        <Upload size={20} color={colors.primary} />
        <Text style={[s.filePickText, { color: colors.primary }]}>
          {fileName || 'Parcourir... (.csv, .txt)'}
        </Text>
      </TouchableOpacity>
      {fileName ? (
        <View style={[s.fileInfo, { backgroundColor: colors.successLight }]}>
          <FileText size={14} color={colors.success} />
          <Text style={[s.fileInfoText, { color: colors.success }]}>{fileName}</Text>
        </View>
      ) : null}
      {csvText.length > 0 && (
        <Text style={[s.hint, { color: colors.textTertiary }]}>
          {parseCSVText(csvText).rows.length} ligne(s) détectée(s)
        </Text>
      )}
    </View>
  );

  const renderPasteInput = () => (
    <View style={s.section}>
      <TextInput
        style={[s.csvInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
        value={csvText}
        onChangeText={setCsvText}
        placeholder={pastePlaceholder || defaultPlaceholder}
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={10}
        textAlignVertical="top"
        testID="universal-import-csv-input"
      />
      <Text style={[s.hint, { color: colors.textTertiary }]}>
        Séparateurs auto-détectés : virgule, point-virgule ou tabulation.
      </Text>
    </View>
  );

  const renderManualInput = () => (
    <View style={s.section}>
      <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
        <View>
          <View style={[s.manualHeader, { borderBottomColor: colors.border }]}>
            {fields.map((f) => (
              <Text
                key={f.key}
                style={[s.manualHeaderText, { color: colors.textTertiary, width: 120 }]}
              >
                {f.label}{f.required ? ' *' : ''}
              </Text>
            ))}
            <View style={{ width: 28 }} />
          </View>
          {manualRows.map((row, idx) => (
            <View key={idx} style={[s.manualRow, { borderBottomColor: colors.borderLight }]}>
              {fields.map((f) => (
                <TextInput
                  key={f.key}
                  style={[s.manualCell, { width: 120, color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                  value={row[f.key] || ''}
                  onChangeText={(v) => updateManualRow(idx, f.key, v)}
                  placeholder={f.label.replace(' *', '')}
                  placeholderTextColor={colors.textTertiary}
                />
              ))}
              <TouchableOpacity onPress={() => removeManualRow(idx)} hitSlop={6} style={s.removeRowBtn}>
                <Trash2 size={14} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
      <TouchableOpacity
        style={[s.addRowBtn, { borderColor: colors.primary }]}
        onPress={addManualRow}
        activeOpacity={0.7}
      >
        <Plus size={14} color={colors.primary} />
        <Text style={[s.addRowBtnText, { color: colors.primary }]}>Ligne</Text>
      </TouchableOpacity>
    </View>
  );

  const renderInputStep = () => (
    <View style={{ gap: 12 }}>
      {renderMethodTabs()}
      {method === 'file' && renderFileInput()}
      {method === 'paste' && renderPasteInput()}
      {method === 'manual' && renderManualInput()}
      <View style={[s.formatInfo, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}>
        <FileText size={14} color={colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={[s.formatInfoTitle, { color: colors.text }]}>Format reconnu</Text>
          <Text style={[s.formatInfoText, { color: colors.textTertiary }]}>
            {fields.map((f) => `${f.label}${f.required ? '*' : ''}`).join(' ; ')}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderPreviewStep = () => (
    <View style={{ gap: 12 }}>
      <View style={[s.summaryBar, { backgroundColor: colors.surfaceHover }]}>
        <View style={[s.summaryBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[s.summaryBadgeText, { color: colors.primary }]}>
            {summary.total} {entityLabel}{summary.total > 1 ? 's' : ''}
          </Text>
        </View>
        {summary.ready > 0 && (
          <View style={[s.summaryBadge, { backgroundColor: colors.successLight }]}>
            <Text style={[s.summaryBadgeText, { color: colors.success }]}>
              {summary.ready} prêt{summary.ready > 1 ? 's' : ''}
            </Text>
          </View>
        )}
        {summary.errors > 0 && (
          <View style={[s.summaryBadge, { backgroundColor: colors.dangerLight }]}>
            <Text style={[s.summaryBadgeText, { color: colors.danger }]}>
              {summary.errors} erreur{summary.errors > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {previewRows.map((row, idx) => {
        const StatusIcon = row.status === 'ready' ? CheckCircle
          : row.status === 'warning' ? AlertTriangle
          : XCircle;
        const statusColor = row.status === 'ready' ? colors.success
          : row.status === 'warning' ? colors.warning
          : colors.danger;
        const cardBorderColor = row.status === 'error' ? colors.danger : colors.cardBorder;

        return (
          <View
            key={idx}
            style={[s.previewCard, { borderColor: cardBorderColor, backgroundColor: colors.card }]}
          >
            <View style={s.previewCardHeader}>
              <StatusIcon size={16} color={statusColor} />
              <View style={{ flex: 1 }}>
                <Text style={[s.previewName, { color: colors.text }]} numberOfLines={1}>
                  {getPreviewTitle(row.data, fields)}
                </Text>
                <Text style={[s.previewMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                  {getPreviewSubtitle(row.data, fields)}
                </Text>
              </View>
              <Text style={[s.previewStatus, { color: statusColor }]}>
                {row.statusMessage}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderImportingStep = () => (
    <View style={s.importingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[s.importingText, { color: colors.text }]}>Import en cours...</Text>
      <View style={[s.progressBar, { backgroundColor: colors.borderLight }]}>
        <View style={[s.progressFill, { backgroundColor: colors.primary, width: `${importProgress}%` as never }]} />
      </View>
      <Text style={[s.progressText, { color: colors.textTertiary }]}>{importProgress}%</Text>
    </View>
  );

  const renderResultStep = () => {
    if (!importResult) return null;
    return (
      <View style={{ gap: 16 }}>
        <View style={[s.resultCard, { backgroundColor: colors.successLight }]}>
          <CheckCircle size={24} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={[s.resultTitle, { color: colors.success }]}>Import terminé</Text>
            <Text style={[s.resultText, { color: colors.text }]}>
              {importResult.imported} {entityLabel}{importResult.imported > 1 ? 's' : ''} importé{importResult.imported > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        {importResult.errors.length > 0 && (
          <View style={[s.resultCard, { backgroundColor: colors.dangerLight }]}>
            <AlertTriangle size={20} color={colors.danger} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.resultTitle, { color: colors.danger }]}>
                {importResult.errors.length} erreur(s)
              </Text>
              {importResult.errors.slice(0, 10).map((err, i) => (
                <Text key={i} style={[s.resultError, { color: colors.danger }]}>• {err}</Text>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const getSubmitLabel = () => {
    if (step === 'input') return 'Analyser';
    if (step === 'preview') {
      const count = summary.ready + summary.warnings;
      return count > 0 ? `Importer (${count} ${entityLabel}${count > 1 ? 's' : ''})` : 'Rien à importer';
    }
    if (step === 'result') return 'Fermer';
    return '';
  };

  const handleSubmit = () => {
    if (step === 'input') handleAnalyze();
    else if (step === 'preview') handleImport();
    else handleClose();
  };

  return (
    <FormModal
      visible={visible}
      onClose={handleClose}
      title={title}
      onSubmit={step !== 'importing' ? handleSubmit : undefined}
      submitLabel={getSubmitLabel()}
      submitDisabled={step === 'input' ? !canAnalyze : step === 'preview' ? !canImport : false}
      width={680}
      showCancel={step !== 'importing' && step !== 'result'}
      cancelLabel={step === 'preview' ? 'Retour' : 'Annuler'}
    >
      {step === 'input' && renderInputStep()}
      {step === 'preview' && renderPreviewStep()}
      {step === 'importing' && renderImportingStep()}
      {step === 'result' && renderResultStep()}
    </FormModal>
  );
});

/**
 * Extracts a display title from the first non-empty required or first field.
 */
function getPreviewTitle(data: Record<string, string>, fields: ImportFieldDef[]): string {
  const requiredField = fields.find((f) => f.required && data[f.key]?.trim());
  if (requiredField) return data[requiredField.key];
  const firstFilled = fields.find((f) => data[f.key]?.trim());
  return firstFilled ? data[firstFilled.key] : '(vide)';
}

/**
 * Extracts a subtitle from remaining filled fields.
 */
function getPreviewSubtitle(data: Record<string, string>, fields: ImportFieldDef[]): string {
  const parts: string[] = [];
  fields.slice(1, 5).forEach((f) => {
    if (data[f.key]?.trim()) {
      parts.push(`${f.label}: ${data[f.key]}`);
    }
  });
  return parts.join(' · ') || '—';
}

const s = StyleSheet.create({
  methodBar: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1,
    paddingBottom: 12,
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  methodTab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  methodTabText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  section: { gap: 10 },
  filePickBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderRadius: 10,
    padding: 20,
    justifyContent: 'center' as const,
  },
  filePickText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  fileInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  fileInfoText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  hint: {
    fontSize: 11,
  },
  csvInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    minHeight: 180,
    textAlignVertical: 'top' as const,
  },
  manualHeader: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1,
    paddingBottom: 6,
    marginBottom: 4,
    gap: 4,
  },
  manualHeaderText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  manualRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 3,
    borderBottomWidth: 1,
    gap: 4,
  },
  manualCell: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
  },
  removeRowBtn: {
    padding: 4,
  },
  addRowBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    alignSelf: 'flex-start' as const,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderStyle: 'dashed' as const,
  },
  addRowBtnText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  formatInfo: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  formatInfoTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  formatInfoText: {
    fontSize: 11,
    lineHeight: 16,
  },
  summaryBar: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  summaryBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden' as const,
  },
  previewCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: 12,
  },
  previewName: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  previewMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  previewStatus: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  importingContainer: {
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 30,
  },
  importingText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  progressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  resultCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    padding: 16,
    borderRadius: 10,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  resultText: {
    fontSize: 13,
    marginTop: 4,
  },
  resultError: {
    fontSize: 12,
  },
});
