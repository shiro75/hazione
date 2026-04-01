/**
 * @fileoverview CSV import modal for bulk-importing clients or products.
 * Parses CSV text, allows column mapping, previews data, and triggers import.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform } from 'react-native';
import { AlertTriangle, CheckCircle, FileText } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import FormModal from '@/components/FormModal';

interface ColumnMapping {
  csvColumn: string;
  appField: string;
}

interface CSVImportModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'products' | 'clients';
  appFields: { key: string; label: string; required?: boolean }[];
  onImport: (rows: Record<string, string>[]) => { imported: number; errors: string[] };
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(separator).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows = lines.slice(1).map((line) =>
    line.split(separator).map((cell) => cell.trim().replace(/^["']|["']$/g, ''))
  );
  return { headers, rows };
}

export default React.memo(function CSVImportModal({
  visible,
  onClose,
  type,
  appFields,
  onImport,
}: CSVImportModalProps) {
  const { colors } = useTheme();
  const [step, setStep] = useState<'paste' | 'mapping' | 'preview' | 'result'>('paste');
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const handleParse = useCallback(() => {
    const parsed = parseCSV(csvText);
    if (parsed.headers.length === 0) return;
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    const autoMappings: ColumnMapping[] = parsed.headers.map((h) => {
      const lower = h.toLowerCase().replace(/[_\s-]/g, '');
      const match = appFields.find((f) => {
        const fLower = f.key.toLowerCase().replace(/[_\s-]/g, '');
        const lLower = f.label.toLowerCase().replace(/[_\s-]/g, '');
        return fLower === lower || lLower === lower || lower.includes(fLower) || fLower.includes(lower);
      });
      return { csvColumn: h, appField: match?.key || '' };
    });
    setMappings(autoMappings);
    setStep('mapping');
  }, [csvText, appFields]);

  const handleMapping = useCallback((csvCol: string, appField: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.csvColumn === csvCol ? { ...m, appField } : m))
    );
  }, []);

  const goToPreview = useCallback(() => {
    setStep('preview');
  }, []);

  const getMappedRows = useCallback((): Record<string, string>[] => {
    return rows.map((row) => {
      const mapped: Record<string, string> = {};
      mappings.forEach((m, idx) => {
        if (m.appField && row[idx] !== undefined) {
          mapped[m.appField] = row[idx];
        }
      });
      return mapped;
    });
  }, [rows, mappings]);

  const handleImport = useCallback(() => {
    const mappedRows = getMappedRows();
    const res = onImport(mappedRows);
    setResult(res);
    setStep('result');
  }, [getMappedRows, onImport]);

  const handleClose = useCallback(() => {
    setStep('paste');
    setCsvText('');
    setHeaders([]);
    setRows([]);
    setMappings([]);
    setResult(null);
    onClose();
  }, [onClose]);

  const previewRows = getMappedRows().slice(0, 5);
  const mappedFieldKeys = mappings.filter((m) => m.appField).map((m) => m.appField);
  const previewFields = appFields.filter((f) => mappedFieldKeys.includes(f.key));

  return (
    <FormModal
      visible={visible}
      onClose={handleClose}
      title={`Importer des ${type === 'products' ? 'produits' : 'clients'}`}
      subtitle={
        step === 'paste' ? 'Collez votre contenu CSV ci-dessous' :
        step === 'mapping' ? 'Associez les colonnes CSV aux champs' :
        step === 'preview' ? 'Vérifiez avant d\'importer' :
        'Résultat de l\'import'
      }
      onSubmit={
        step === 'paste' ? handleParse :
        step === 'mapping' ? goToPreview :
        step === 'preview' ? handleImport :
        handleClose
      }
      submitLabel={
        step === 'paste' ? 'Analyser' :
        step === 'mapping' ? 'Prévisualiser' :
        step === 'preview' ? `Importer ${rows.length} lignes` :
        'Fermer'
      }
      width={650}
    >
      {step === 'paste' && (
        <View style={styles.section}>
          <View style={[styles.infoBox, { backgroundColor: colors.primaryLight }]}>
            <FileText size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>
              Format CSV avec séparateur virgule (,) ou point-virgule (;). La première ligne doit contenir les en-têtes.
            </Text>
          </View>
          <TextInput
            style={[styles.csvInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={csvText}
            onChangeText={setCsvText}
            placeholder={"Nom;Prix;Description\nProduit A;10.50;Un produit\nProduit B;25.00;Un autre"}
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={12}
            textAlignVertical="top"
            testID="csv-input"
          />
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Vous pouvez aussi copier-coller depuis Excel ou Google Sheets
          </Text>
        </View>
      )}

      {step === 'mapping' && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
            {headers.length} colonnes détectées · {rows.length} lignes
          </Text>
          {headers.map((h) => {
            const mapping = mappings.find((m) => m.csvColumn === h);
            return (
              <View key={h} style={[styles.mappingRow, { borderColor: colors.border }]}>
                <View style={styles.mappingLeft}>
                  <Text style={[styles.mappingCsvCol, { color: colors.text }]}>{h}</Text>
                  <Text style={[styles.mappingPreview, { color: colors.textTertiary }]} numberOfLines={1}>
                    ex: {rows[0]?.[headers.indexOf(h)] || '—'}
                  </Text>
                </View>
                <Text style={[styles.mappingArrow, { color: colors.textTertiary }]}>→</Text>
                <View style={styles.mappingRight}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={[
                        styles.mappingChip,
                        { backgroundColor: !mapping?.appField ? colors.warningLight : colors.surfaceHover, borderColor: colors.border },
                      ]}
                      onPress={() => handleMapping(h, '')}
                    >
                      <Text style={[styles.mappingChipText, { color: !mapping?.appField ? colors.warning : colors.textTertiary }]}>
                        {mapping?.appField ? 'Ignorer' : '— Ignoré —'}
                      </Text>
                    </TouchableOpacity>
                    {appFields.map((f) => (
                      <TouchableOpacity
                        key={f.key}
                        style={[
                          styles.mappingChip,
                          {
                            backgroundColor: mapping?.appField === f.key ? colors.primaryLight : colors.surfaceHover,
                            borderColor: mapping?.appField === f.key ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => handleMapping(h, f.key)}
                      >
                        <Text style={[
                          styles.mappingChipText,
                          { color: mapping?.appField === f.key ? colors.primary : colors.textSecondary },
                        ]}>
                          {f.label}{f.required ? ' *' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {step === 'preview' && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
            Aperçu des 5 premières lignes
          </Text>
          {previewRows.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Aucune donnée à importer</Text>
          ) : (
            previewRows.map((row, idx) => (
              <View key={idx} style={[styles.previewCard, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}>
                <Text style={[styles.previewIdx, { color: colors.textTertiary }]}>#{idx + 1}</Text>
                {previewFields.map((f) => (
                  <View key={f.key} style={styles.previewField}>
                    <Text style={[styles.previewLabel, { color: colors.textTertiary }]}>{f.label}</Text>
                    <Text style={[styles.previewValue, { color: colors.text }]} numberOfLines={1}>
                      {row[f.key] || '—'}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}
          {rows.length > 5 && (
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              ... et {rows.length - 5} autres lignes
            </Text>
          )}
        </View>
      )}

      {step === 'result' && result && (
        <View style={styles.section}>
          <View style={[styles.resultCard, { backgroundColor: colors.successLight }]}>
            <CheckCircle size={24} color={colors.success} />
            <Text style={[styles.resultText, { color: colors.success }]}>
              {result.imported} {type === 'products' ? 'produit(s)' : 'client(s)'} importé(s)
            </Text>
          </View>
          {result.errors.length > 0 && (
            <View style={[styles.resultCard, { backgroundColor: colors.dangerLight }]}>
              <AlertTriangle size={20} color={colors.danger} />
              <View style={styles.errorList}>
                <Text style={[styles.resultText, { color: colors.danger }]}>
                  {result.errors.length} erreur(s)
                </Text>
                {result.errors.slice(0, 10).map((err, idx) => (
                  <Text key={idx} style={[styles.errorItem, { color: colors.danger }]}>• {err}</Text>
                ))}
                {result.errors.length > 10 && (
                  <Text style={[styles.errorItem, { color: colors.danger }]}>
                    ... et {result.errors.length - 10} autres
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      )}
    </FormModal>
  );
});

const styles = StyleSheet.create({
  section: { gap: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '600' as const },
  infoBox: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, padding: 12, borderRadius: 8 },
  infoText: { fontSize: 12, fontWeight: '500' as const, flex: 1 },
  csvInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    minHeight: 200,
    textAlignVertical: 'top' as const,
  },
  hint: { fontSize: 11 },
  mappingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  mappingLeft: { width: 100 },
  mappingCsvCol: { fontSize: 13, fontWeight: '600' as const },
  mappingPreview: { fontSize: 11, marginTop: 2 },
  mappingArrow: { fontSize: 16 },
  mappingRight: { flex: 1 },
  mappingChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  mappingChipText: { fontSize: 11, fontWeight: '500' as const },
  previewCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  previewIdx: { fontSize: 10, fontWeight: '700' as const },
  previewField: { flexDirection: 'row' as const, gap: 8 },
  previewLabel: { fontSize: 11, fontWeight: '600' as const, width: 80 },
  previewValue: { fontSize: 12, flex: 1 },
  resultCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    padding: 16,
    borderRadius: 10,
  },
  resultText: { fontSize: 15, fontWeight: '600' as const },
  errorList: { flex: 1, gap: 4 },
  errorItem: { fontSize: 12 },
  emptyText: { fontSize: 13, textAlign: 'center' as const, paddingVertical: 20 },
});
