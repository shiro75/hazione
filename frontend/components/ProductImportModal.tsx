/**
 * @fileoverview Product import modal supporting CSV paste and OCR.
 * Parses product data, previews entries, and bulk-creates products via DataContext.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import {
  FileText, ClipboardPaste, Table, CheckCircle, AlertTriangle, XCircle,
  Plus, Trash2, ChevronRight, Upload, Columns,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '@/contexts/ThemeContext';
import FormModal from '@/components/FormModal';
import type { ProductType } from '@/types';

type ImportMethod = 'file' | 'paste' | 'manual';
type ImportStep = 'input' | 'preview' | 'importing' | 'result';

const FIXED_COLUMNS = [
  'Nom', 'Description', 'Type', 'Catégorie', 'Marque',
  'Prix vente', "Prix achat", 'Stock', 'Stock min', 'Unité',
] as const;

type FixedColumnKey = 'name' | 'description' | 'type' | 'category' | 'brand'
  | 'salePrice' | 'purchasePrice' | 'stockQuantity' | 'minStock' | 'unit';

const _FIXED_KEY_MAP: Record<number, FixedColumnKey> = {
  0: 'name', 1: 'description', 2: 'type', 3: 'category', 4: 'brand',
  5: 'salePrice', 6: 'purchasePrice', 7: 'stockQuantity', 8: 'minStock', 9: 'unit',
};

interface ParsedRow {
  name: string;
  description: string;
  type: string;
  category: string;
  brand: string;
  salePrice: string;
  purchasePrice: string;
  stockQuantity: string;
  minStock: string;
  unit: string;
  dynamicAttributes: Record<string, string>;
}

export interface PreviewVariant {
  attributes: Record<string, string>;
  salePrice: number;
  purchasePrice: number;
  stockQuantity: number;
  minStock: number;
}

export type DuplicateAction = 'ignore' | 'update';

export interface DuplicateInfo {
  existingProductId: string;
  existingProductName: string;
  source: 'database' | 'intra-import';
}

export interface PreviewProduct {
  name: string;
  description: string;
  type: ProductType;
  category: string;
  brand: string;
  salePrice: number;
  purchasePrice: number;
  stockQuantity: number;
  minStock: number;
  unit: string;
  variants: PreviewVariant[];
  detectedAttributes: string[];
  status: 'ready' | 'warning' | 'error';
  statusMessage: string;
  duplicate?: DuplicateInfo;
  duplicateAction?: DuplicateAction;
}

export interface ImportResult {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  categoriesCreated: number;
  errors: string[];
}

export interface ExistingProductRef {
  id: string;
  name: string;
  type: ProductType;
  categoryName?: string;
}

interface ProductImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImportProducts: (products: PreviewProduct[]) => ImportResult;
  existingCategories: string[];
  existingProducts: ExistingProductRef[];
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const HEADER_ALIASES: Record<string, FixedColumnKey> = {
  nom: 'name',
  name: 'name',
  description: 'description',
  desc: 'description',
  type: 'type',
  categorie: 'category',
  category: 'category',
  cat: 'category',
  marque: 'brand',
  brand: 'brand',
  'prix de vente': 'salePrice',
  'prix_de_vente': 'salePrice',
  'prix vente': 'salePrice',
  prixvente: 'salePrice',
  saleprice: 'salePrice',
  prix: 'salePrice',
  price: 'salePrice',
  "prix d'achat": 'purchasePrice',
  "prix_d'achat": 'purchasePrice',
  'prix achat': 'purchasePrice',
  prixachat: 'purchasePrice',
  purchaseprice: 'purchasePrice',
  achat: 'purchasePrice',
  'stock initial': 'stockQuantity',
  stock: 'stockQuantity',
  stockquantity: 'stockQuantity',
  'stock minimum': 'minStock',
  'stock min': 'minStock',
  minstock: 'minStock',
  seuil: 'minStock',
  unite: 'unit',
  unit: 'unit',
  unité: 'unit',
};

function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  if (tabCount > semiCount && tabCount > commaCount) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
}

interface ParseResult {
  rows: ParsedRow[];
  dynamicColumnNames: string[];
}

function parseCSVText(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], dynamicColumnNames: [] };
  const sep = detectSeparator(text);
  const rawHeaders = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));

  const columnMap: (FixedColumnKey | null)[] = [];
  const dynamicColumnNames: string[] = [];
  let fixedColumnsEnded = false;

  for (let i = 0; i < rawHeaders.length; i++) {
    const h = rawHeaders[i];
    const normalized = stripAccents(h.toLowerCase().replace(/[_\-\s]+/g, '').replace(/['"]/g, ''));

    let matchedKey: FixedColumnKey | null = null;
    for (const [alias, key] of Object.entries(HEADER_ALIASES)) {
      if (normalized === stripAccents(alias.replace(/[_\-\s]+/g, '').replace(/['"]/g, ''))) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey && !fixedColumnsEnded) {
      columnMap.push(matchedKey);
      if (matchedKey === 'unit') {
        fixedColumnsEnded = true;
      }
    } else if (fixedColumnsEnded || (!matchedKey && i >= FIXED_COLUMNS.length)) {
      columnMap.push(null);
      if (h.trim()) {
        dynamicColumnNames.push(h.trim());
      }
    } else if (matchedKey) {
      columnMap.push(matchedKey);
    } else {
      columnMap.push(null);
      if (h.trim()) {
        dynamicColumnNames.push(h.trim());
      }
    }
  }

  const hasNameCol = columnMap.includes('name');
  if (!hasNameCol && rawHeaders.length >= 1) {
    columnMap[0] = 'name';
  }

  const dynamicStartIdx = columnMap.length - dynamicColumnNames.length;

  const rows: ParsedRow[] = lines.slice(1).map(line => {
    const cells = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const row: ParsedRow = {
      name: '', description: '', type: '', category: '', brand: '',
      salePrice: '', purchasePrice: '', stockQuantity: '', minStock: '',
      unit: '', dynamicAttributes: {},
    };

    cells.forEach((cell, idx) => {
      if (idx < columnMap.length) {
        const key = columnMap[idx];
        if (key) {
          row[key] = cell;
        } else if (idx >= dynamicStartIdx) {
          const dynIdx = idx - dynamicStartIdx;
          if (dynIdx < dynamicColumnNames.length && cell.trim()) {
            row.dynamicAttributes[dynamicColumnNames[dynIdx]] = cell.trim();
          }
        }
      } else if (idx >= dynamicStartIdx) {
        const dynIdx = idx - dynamicStartIdx;
        if (dynIdx < dynamicColumnNames.length && cell.trim()) {
          row.dynamicAttributes[dynamicColumnNames[dynIdx]] = cell.trim();
        }
      }
    });
    return row;
  }).filter(r => r.name.trim());

  return { rows, dynamicColumnNames };
}

function resolveType(raw: string): ProductType {
  const lower = (raw || '').toLowerCase().replace(/[_\-\s]+/g, '');
  if (lower.includes('matiere') || lower.includes('rawmaterial') || lower.includes('matièrepremière') || lower.includes('matierepremiere')) return 'matiere_premiere';
  if (lower.includes('consommable') || lower.includes('consumable')) return 'consommable';
  if (lower.includes('revendu') || lower.includes('resold')) return 'produit_revendu';
  if (lower.includes('service')) return 'service';
  return 'produit_fini';
}

function groupRowsIntoProducts(rows: ParsedRow[], _dynamicColumnNames: string[]): PreviewProduct[] {
  const productMap = new Map<string, ParsedRow[]>();

  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (!productMap.has(key)) {
      productMap.set(key, []);
    }
    productMap.get(key)!.push(row);
  }

  const products: PreviewProduct[] = [];
  for (const [, groupRows] of productMap) {
    const parent = groupRows[0];

    const allDetectedAttrs = new Set<string>();
    const rowsWithAttrs: ParsedRow[] = [];
    const rowsWithoutAttrs: ParsedRow[] = [];

    for (const row of groupRows) {
      const hasAnyAttr = Object.keys(row.dynamicAttributes).length > 0;
      if (hasAnyAttr) {
        rowsWithAttrs.push(row);
        Object.keys(row.dynamicAttributes).forEach(k => allDetectedAttrs.add(k));
      } else {
        rowsWithoutAttrs.push(row);
      }
    }

    const variants: PreviewVariant[] = [];
    const detectedAttributes = Array.from(allDetectedAttrs);

    if (rowsWithAttrs.length > 0) {
      for (const row of rowsWithAttrs) {
        variants.push({
          attributes: { ...row.dynamicAttributes },
          salePrice: parseFloat(row.salePrice) || parseFloat(parent.salePrice) || 0,
          purchasePrice: parseFloat(row.purchasePrice) || parseFloat(parent.purchasePrice) || 0,
          stockQuantity: parseInt(row.stockQuantity, 10) || 0,
          minStock: parseInt(row.minStock, 10) || parseInt(parent.minStock, 10) || 5,
        });
      }
      if (rowsWithoutAttrs.length > 1) {
        for (let i = 1; i < rowsWithoutAttrs.length; i++) {
          variants.push({
            attributes: {},
            salePrice: parseFloat(rowsWithoutAttrs[i].salePrice) || parseFloat(parent.salePrice) || 0,
            purchasePrice: parseFloat(rowsWithoutAttrs[i].purchasePrice) || parseFloat(parent.purchasePrice) || 0,
            stockQuantity: parseInt(rowsWithoutAttrs[i].stockQuantity, 10) || 0,
            minStock: parseInt(rowsWithoutAttrs[i].minStock, 10) || parseInt(parent.minStock, 10) || 5,
          });
        }
      }
    } else if (groupRows.length > 1) {
      for (let i = 1; i < groupRows.length; i++) {
        variants.push({
          attributes: {},
          salePrice: parseFloat(groupRows[i].salePrice) || parseFloat(parent.salePrice) || 0,
          purchasePrice: parseFloat(groupRows[i].purchasePrice) || parseFloat(parent.purchasePrice) || 0,
          stockQuantity: parseInt(groupRows[i].stockQuantity, 10) || 0,
          minStock: parseInt(groupRows[i].minStock, 10) || parseInt(parent.minStock, 10) || 5,
        });
      }
    }

    const salePrice = parseFloat(parent.salePrice) || 0;
    const purchasePrice = parseFloat(parent.purchasePrice) || 0;
    const stockQuantity = parseInt(parent.stockQuantity, 10) || 0;
    const minStock = parseInt(parent.minStock, 10) || 5;

    let status: PreviewProduct['status'] = 'ready';
    let statusMessage = 'Prêt';

    if (!parent.name.trim()) {
      status = 'error';
      statusMessage = 'Nom manquant';
    } else if (salePrice <= 0 && !parent.salePrice) {
      status = 'warning';
      statusMessage = 'Prix de vente manquant';
    }

    products.push({
      name: parent.name.trim(),
      description: parent.description.trim(),
      type: resolveType(parent.type),
      category: parent.category.trim(),
      brand: parent.brand.trim(),
      salePrice,
      purchasePrice,
      stockQuantity,
      minStock,
      unit: parent.unit.trim() || 'pièce',
      variants,
      detectedAttributes,
      status,
      statusMessage,
    });
  }

  return products;
}

const EMPTY_ROW: ParsedRow = {
  name: '', description: '', type: '', category: '', brand: '',
  salePrice: '', purchasePrice: '', stockQuantity: '', minStock: '',
  unit: '', dynamicAttributes: {},
};

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

function makeDuplicateKey(name: string, type: string, category: string): string {
  return `${normalizeName(name)}||${normalizeName(type)}||${normalizeName(category || '')}`;
}

export default React.memo(function ProductImportModal({
  visible,
  onClose,
  onImportProducts,
  existingCategories: _existingCategories,
  existingProducts,
}: ProductImportModalProps) {
  const { colors } = useTheme();

  const [method, setMethod] = useState<ImportMethod>('paste');
  const [step, setStep] = useState<ImportStep>('input');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [manualRows, setManualRows] = useState<ParsedRow[]>([{ ...EMPTY_ROW, dynamicAttributes: {} }]);
  const [manualDynamicCols, setManualDynamicCols] = useState<string[]>([]);
  const [newColName, setNewColName] = useState('');
  const [previewProducts, setPreviewProducts] = useState<PreviewProduct[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [expandedProductIdx, setExpandedProductIdx] = useState<Set<number>>(new Set());
  const [detectedAttrNames, setDetectedAttrNames] = useState<string[]>([]);

  const handleReset = useCallback(() => {
    setMethod('paste');
    setStep('input');
    setCsvText('');
    setFileName('');
    setManualRows([{ ...EMPTY_ROW, dynamicAttributes: {} }]);
    setManualDynamicCols([]);
    setNewColName('');
    setPreviewProducts([]);
    setImportResult(null);
    setImportProgress(0);
    setExpandedProductIdx(new Set());
    setDetectedAttrNames([]);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

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

  const detectDuplicates = useCallback((products: PreviewProduct[]): PreviewProduct[] => {
    const existingMap = new Map<string, ExistingProductRef>();
    for (const ep of existingProducts) {
      const key = makeDuplicateKey(ep.name, ep.type, ep.categoryName || '');
      existingMap.set(key, ep);
    }

    const importMap = new Map<string, number>();

    return products.map((p, idx) => {
      const key = makeDuplicateKey(p.name, p.type, p.category);

      const existingMatch = existingMap.get(key);
      if (existingMatch) {
        return {
          ...p,
          duplicate: {
            existingProductId: existingMatch.id,
            existingProductName: existingMatch.name,
            source: 'database' as const,
          },
          duplicateAction: 'ignore' as DuplicateAction,
        };
      }

      if (importMap.has(key)) {
        return {
          ...p,
          duplicate: {
            existingProductId: '',
            existingProductName: products[importMap.get(key)!].name,
            source: 'intra-import' as const,
          },
          duplicateAction: 'ignore' as DuplicateAction,
          status: 'error' as const,
          statusMessage: 'Doublon dans le fichier',
        };
      }

      importMap.set(key, idx);
      return p;
    });
  }, [existingProducts]);

  const handleAnalyze = useCallback(() => {
    let rows: ParsedRow[] = [];
    let dynCols: string[] = [];

    if (method === 'manual') {
      rows = manualRows.filter(r => r.name.trim());
      dynCols = manualDynamicCols;
    } else {
      const result = parseCSVText(csvText);
      rows = result.rows;
      dynCols = result.dynamicColumnNames;
    }
    if (rows.length === 0) return;
    const products = groupRowsIntoProducts(rows, dynCols);
    const withDuplicates = detectDuplicates(products);
    setPreviewProducts(withDuplicates);
    setDetectedAttrNames(dynCols);
    setStep('preview');
  }, [method, csvText, manualRows, manualDynamicCols, detectDuplicates]);

  const handleImport = useCallback(() => {
    setStep('importing');
    setImportProgress(0);
    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      const nonDuplicates = previewProducts.filter(p => p.status !== 'error' && !p.duplicate);
      const updatables = previewProducts.filter(p => p.duplicate && p.duplicate.source === 'database' && p.duplicateAction === 'update');
      const result = onImportProducts([...nonDuplicates, ...updatables]);
      setImportProgress(100);
      setImportResult(result);
      setStep('result');
    }, 800);
  }, [previewProducts, onImportProducts]);

  const updateManualRow = useCallback((idx: number, field: FixedColumnKey, value: string) => {
    setManualRows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }, []);

  const updateManualRowAttr = useCallback((idx: number, attrName: string, value: string) => {
    setManualRows(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        dynamicAttributes: { ...updated[idx].dynamicAttributes, [attrName]: value },
      };
      return updated;
    });
  }, []);

  const addManualRow = useCallback(() => {
    setManualRows(prev => [...prev, { ...EMPTY_ROW, dynamicAttributes: {} }]);
  }, []);

  const removeManualRow = useCallback((idx: number) => {
    setManualRows(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addDynamicColumn = useCallback(() => {
    const name = newColName.trim();
    if (!name || manualDynamicCols.includes(name)) return;
    setManualDynamicCols(prev => [...prev, name]);
    setNewColName('');
  }, [newColName, manualDynamicCols]);

  const removeDynamicColumn = useCallback((colName: string) => {
    setManualDynamicCols(prev => prev.filter(c => c !== colName));
    setManualRows(prev => prev.map(row => {
      const attrs = { ...row.dynamicAttributes };
      delete attrs[colName];
      return { ...row, dynamicAttributes: attrs };
    }));
  }, []);

  const updatePreviewField = useCallback((productIdx: number, field: keyof PreviewProduct, value: string) => {
    setPreviewProducts(prev => {
      const updated = [...prev];
      const p = { ...updated[productIdx] };
      if (field === 'name') p.name = value;
      else if (field === 'salePrice') p.salePrice = parseFloat(value) || 0;
      else if (field === 'category') p.category = value;

      if (p.name.trim() && p.status === 'error') {
        p.status = 'ready';
        p.statusMessage = 'Prêt';
      }
      if (p.salePrice > 0 && p.status === 'warning') {
        p.status = 'ready';
        p.statusMessage = 'Prêt';
      }

      updated[productIdx] = p;
      return updated;
    });
  }, []);

  const setDuplicateAction = useCallback((idx: number, action: DuplicateAction) => {
    setPreviewProducts(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], duplicateAction: action };
      return updated;
    });
  }, []);

  const summary = useMemo(() => {
    const totalProducts = previewProducts.length;
    const totalVariants = previewProducts.reduce((s, p) => s + p.variants.length, 0);
    const withVariants = previewProducts.filter(p => p.variants.length > 0).length;
    const simple = totalProducts - withVariants;
    const errors = previewProducts.filter(p => p.status === 'error').length;
    const warnings = previewProducts.filter(p => p.status === 'warning').length;
    const ready = previewProducts.filter(p => p.status === 'ready' && !p.duplicate).length;
    const dbDuplicates = previewProducts.filter(p => p.duplicate?.source === 'database').length;
    const intraDuplicates = previewProducts.filter(p => p.duplicate?.source === 'intra-import').length;
    const toUpdate = previewProducts.filter(p => p.duplicate?.source === 'database' && p.duplicateAction === 'update').length;
    const toIgnore = previewProducts.filter(p => p.duplicate && p.duplicateAction === 'ignore').length;
    return { totalProducts, totalVariants, withVariants, simple, errors, warnings, ready, dbDuplicates, intraDuplicates, toUpdate, toIgnore };
  }, [previewProducts]);

  const canAnalyze = method === 'manual'
    ? manualRows.some(r => r.name.trim())
    : csvText.trim().length > 0;

  const canImport = summary.ready > 0 || summary.warnings > 0 || summary.toUpdate > 0;

  const toggleExpand = useCallback((idx: number) => {
    setExpandedProductIdx(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const renderMethodTabs = () => (
    <View style={[mStyles.methodBar, { borderBottomColor: colors.border }]}>
      {([
        { key: 'file' as const, label: 'Fichier CSV', icon: Upload },
        { key: 'paste' as const, label: 'Copier-coller', icon: ClipboardPaste },
        { key: 'manual' as const, label: 'Saisie manuelle', icon: Table },
      ]).map(m => (
        <TouchableOpacity
          key={m.key}
          style={[
            mStyles.methodTab,
            {
              backgroundColor: method === m.key ? `${colors.primary}12` : 'transparent',
              borderColor: method === m.key ? colors.primary : 'transparent',
            },
          ]}
          onPress={() => setMethod(m.key)}
          activeOpacity={0.7}
        >
          <m.icon size={14} color={method === m.key ? colors.primary : colors.textSecondary} />
          <Text style={[mStyles.methodTabText, { color: method === m.key ? colors.primary : colors.textSecondary }]}>
            {m.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFileInput = () => (
    <View style={mStyles.section}>
      <TouchableOpacity
        style={[mStyles.filePickBtn, { borderColor: colors.primary, backgroundColor: `${colors.primary}08` }]}
        onPress={handlePickFile}
        activeOpacity={0.7}
      >
        <Upload size={20} color={colors.primary} />
        <Text style={[mStyles.filePickText, { color: colors.primary }]}>
          {fileName || 'Parcourir... (.csv, .txt)'}
        </Text>
      </TouchableOpacity>
      {fileName ? (
        <View style={[mStyles.fileInfo, { backgroundColor: colors.successLight }]}>
          <FileText size={14} color={colors.success} />
          <Text style={[mStyles.fileInfoText, { color: colors.success }]}>{fileName}</Text>
        </View>
      ) : null}
      {csvText.length > 0 && (
        <Text style={[mStyles.hint, { color: colors.textTertiary }]}>
          {parseCSVText(csvText).rows.length} ligne(s) détectée(s)
        </Text>
      )}
    </View>
  );

  const renderPasteInput = () => (
    <View style={mStyles.section}>
      <TextInput
        style={[mStyles.csvInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
        value={csvText}
        onChangeText={setCsvText}
        placeholder={
          "Nom;Description;Type;Catégorie;Marque;Prix vente;Prix achat;Stock;Stock min;Unité;Taille;Couleur\n" +
          "T-Shirt;Coton bio;Produit fini;Vêtements;Nike;25.00;8.00;20;5;pièce;S;Rouge\n" +
          "T-Shirt;Coton bio;Produit fini;Vêtements;Nike;25.00;8.00;15;5;pièce;M;Bleu\n" +
          "Casquette;Ajustable;Produit fini;Accessoires;;15.00;5.00;50;10;pièce;;"
        }
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={10}
        textAlignVertical="top"
        testID="import-csv-input"
      />
      <Text style={[mStyles.hint, { color: colors.textTertiary }]}>
        Séparateurs auto-détectés : virgule, point-virgule ou tabulation.{'\n'}
        Les colonnes après "Unité" sont des attributs dynamiques (Taille, Couleur, etc.)
      </Text>
    </View>
  );

  const MANUAL_FIXED_FIELDS: { key: FixedColumnKey; label: string; flex: number }[] = [
    { key: 'name', label: 'Nom *', flex: 2 },
    { key: 'category', label: 'Catégorie', flex: 1 },
    { key: 'brand', label: 'Marque', flex: 1 },
    { key: 'salePrice', label: 'Prix vente', flex: 0.8 },
    { key: 'purchasePrice', label: 'Prix achat', flex: 0.8 },
    { key: 'stockQuantity', label: 'Stock', flex: 0.6 },
    { key: 'unit', label: 'Unité', flex: 0.7 },
  ];

  const renderManualInput = () => (
    <View style={mStyles.section}>
      <View style={[mStyles.dynColBar, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}>
        <Columns size={14} color={colors.textSecondary} />
        <Text style={[mStyles.dynColLabel, { color: colors.textSecondary }]}>Attributs :</Text>
        {manualDynamicCols.map(col => (
          <View key={col} style={[mStyles.dynColChip, { backgroundColor: `${colors.primary}18`, borderColor: colors.primary }]}>
            <Text style={[mStyles.dynColChipText, { color: colors.primary }]}>{col}</Text>
            <TouchableOpacity onPress={() => removeDynamicColumn(col)} hitSlop={4}>
              <XCircle size={12} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={mStyles.dynColAddRow}>
          <TextInput
            style={[mStyles.dynColInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={newColName}
            onChangeText={setNewColName}
            placeholder="Ex: Taille"
            placeholderTextColor={colors.textTertiary}
            onSubmitEditing={addDynamicColumn}
          />
          <TouchableOpacity
            style={[mStyles.dynColAddBtn, { backgroundColor: newColName.trim() ? colors.primary : colors.borderLight }]}
            onPress={addDynamicColumn}
            disabled={!newColName.trim()}
          >
            <Plus size={14} color={newColName.trim() ? '#fff' : colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
        <View>
          <View style={[mStyles.manualHeader, { borderBottomColor: colors.border }]}>
            {MANUAL_FIXED_FIELDS.map(f => (
              <Text key={f.key} style={[mStyles.manualHeaderText, { color: colors.textTertiary, width: f.flex * 80 }]}>
                {f.label}
              </Text>
            ))}
            {manualDynamicCols.map(col => (
              <Text key={col} style={[mStyles.manualHeaderText, { color: colors.primary, width: 80 }]}>
                {col}
              </Text>
            ))}
            <View style={{ width: 28 }} />
          </View>
          {manualRows.map((row, idx) => (
            <View key={idx} style={[mStyles.manualRow, { borderBottomColor: colors.borderLight }]}>
              {MANUAL_FIXED_FIELDS.map(f => (
                <TextInput
                  key={f.key}
                  style={[mStyles.manualCell, { width: f.flex * 80, color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                  value={row[f.key]}
                  onChangeText={v => updateManualRow(idx, f.key, v)}
                  placeholder={f.label.replace(' *', '')}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType={['salePrice', 'purchasePrice', 'stockQuantity', 'minStock'].includes(f.key) ? 'decimal-pad' : 'default'}
                />
              ))}
              {manualDynamicCols.map(col => (
                <TextInput
                  key={col}
                  style={[mStyles.manualCell, { width: 80, color: colors.text, backgroundColor: `${colors.primary}06`, borderColor: `${colors.primary}30` }]}
                  value={row.dynamicAttributes[col] || ''}
                  onChangeText={v => updateManualRowAttr(idx, col, v)}
                  placeholder={col}
                  placeholderTextColor={colors.textTertiary}
                />
              ))}
              <TouchableOpacity onPress={() => removeManualRow(idx)} hitSlop={6} style={mStyles.removeRowBtn}>
                <Trash2 size={14} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
      <TouchableOpacity
        style={[mStyles.addRowBtn, { borderColor: colors.primary }]}
        onPress={addManualRow}
        activeOpacity={0.7}
      >
        <Plus size={14} color={colors.primary} />
        <Text style={[mStyles.addRowBtnText, { color: colors.primary }]}>Ligne</Text>
      </TouchableOpacity>
    </View>
  );

  const renderInputStep = () => (
    <View style={{ gap: 12 }}>
      {renderMethodTabs()}
      {method === 'file' && renderFileInput()}
      {method === 'paste' && renderPasteInput()}
      {method === 'manual' && renderManualInput()}
      <View style={[mStyles.formatInfo, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}>
        <FileText size={14} color={colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={[mStyles.formatInfoTitle, { color: colors.text }]}>Format reconnu</Text>
          <Text style={[mStyles.formatInfoText, { color: colors.textTertiary }]}>
            Nom* ; Description ; Type ; Catégorie ; Marque ; Prix vente ; Prix achat ; Stock ; Stock min ; Unité ; [Attribut1] ; [Attribut2] ...
          </Text>
          <Text style={[mStyles.formatInfoText, { color: colors.textTertiary, marginTop: 4 }]}>
            Les colonnes après Unité sont des attributs dynamiques. Les lignes ayant le même Nom sont regroupées en variantes.
          </Text>
        </View>
      </View>
    </View>
  );

  const formatAttrString = (attrs: Record<string, string>): string => {
    return Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(', ');
  };

  const renderPreviewStep = () => (
    <View style={{ gap: 12 }}>
      <View style={[mStyles.summaryBar, { backgroundColor: colors.surfaceHover }]}>
        <View style={[mStyles.summaryBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[mStyles.summaryBadgeText, { color: colors.primary }]}>
            {summary.totalProducts} produit{summary.totalProducts > 1 ? 's' : ''} ({summary.withVariants > 0 ? `${summary.withVariants} avec variantes, ${summary.simple} simple${summary.simple > 1 ? 's' : ''}` : `${summary.simple} simple${summary.simple > 1 ? 's' : ''}`})
          </Text>
        </View>
        {summary.totalVariants > 0 && (
          <View style={[mStyles.summaryBadge, { backgroundColor: '#EDE9FE' }]}>
            <Text style={[mStyles.summaryBadgeText, { color: '#7C3AED' }]}>{summary.totalVariants} variante{summary.totalVariants > 1 ? 's' : ''}</Text>
          </View>
        )}
        {(summary.dbDuplicates + summary.intraDuplicates) > 0 && (
          <View style={[mStyles.summaryBadge, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[mStyles.summaryBadgeText, { color: '#B45309' }]}>{summary.dbDuplicates + summary.intraDuplicates} doublon{(summary.dbDuplicates + summary.intraDuplicates) > 1 ? 's' : ''}</Text>
          </View>
        )}
        {summary.toUpdate > 0 && (
          <View style={[mStyles.summaryBadge, { backgroundColor: '#DBEAFE' }]}>
            <Text style={[mStyles.summaryBadgeText, { color: '#1D4ED8' }]}>{summary.toUpdate} à mettre à jour</Text>
          </View>
        )}
        {summary.errors > 0 && (
          <View style={[mStyles.summaryBadge, { backgroundColor: colors.dangerLight }]}>
            <Text style={[mStyles.summaryBadgeText, { color: colors.danger }]}>{summary.errors} erreur{summary.errors > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {detectedAttrNames.length > 0 && (
        <View style={[mStyles.attrDetectedBar, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}20` }]}>
          <Columns size={14} color={colors.primary} />
          <Text style={[mStyles.attrDetectedText, { color: colors.primary }]}>
            Attributs détectés : {detectedAttrNames.join(', ')}
          </Text>
        </View>
      )}

      {previewProducts.map((product, idx) => {
        const isExpanded = expandedProductIdx.has(idx);
        const isDuplicate = !!product.duplicate;
        const isIntraDup = product.duplicate?.source === 'intra-import';
        const isDbDup = product.duplicate?.source === 'database';
        const dupAction = product.duplicateAction;

        let cardBorderColor = colors.cardBorder;
        if (product.status === 'error' || isIntraDup) cardBorderColor = colors.danger;
        else if (isDbDup) cardBorderColor = '#D97706';

        let cardBgColor = colors.card;
        if (isDbDup && dupAction === 'ignore') cardBgColor = `${colors.card}`;
        if (isIntraDup) cardBgColor = '#FEF2F2';

        const StatusIcon = isIntraDup ? XCircle
          : isDbDup ? AlertTriangle
          : product.status === 'ready' ? CheckCircle
          : product.status === 'warning' ? AlertTriangle
          : XCircle;
        const statusColor = isIntraDup ? colors.danger
          : isDbDup ? '#B45309'
          : product.status === 'ready' ? colors.success
          : product.status === 'warning' ? colors.warning
          : colors.danger;

        return (
          <View key={idx} style={[mStyles.previewCard, { borderColor: cardBorderColor, backgroundColor: cardBgColor, opacity: (isDbDup && dupAction === 'ignore') ? 0.6 : 1 }]}>
            <TouchableOpacity
              style={mStyles.previewCardHeader}
              onPress={() => product.variants.length > 0 ? toggleExpand(idx) : undefined}
              activeOpacity={product.variants.length > 0 ? 0.7 : 1}
            >
              <StatusIcon size={16} color={statusColor} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, flexWrap: 'wrap' as const }}>
                  <Text style={[mStyles.previewName, { color: colors.text }]} numberOfLines={1}>{product.name || '(sans nom)'}</Text>
                  {isDbDup && (
                    <View style={[mStyles.dupBadge, { backgroundColor: '#FEF3C7' }]}>
                      <AlertTriangle size={10} color="#B45309" />
                      <Text style={mStyles.dupBadgeText}>Existe déjà</Text>
                    </View>
                  )}
                  {isIntraDup && (
                    <View style={[mStyles.dupBadge, { backgroundColor: '#FEE2E2' }]}>
                      <XCircle size={10} color={colors.danger} />
                      <Text style={[mStyles.dupBadgeText, { color: colors.danger }]}>Doublon fichier</Text>
                    </View>
                  )}
                </View>
                <Text style={[mStyles.previewMeta, { color: colors.textTertiary }]}>
                  {product.category || 'Sans catégorie'}
                  {product.brand ? ` · ${product.brand}` : ''}
                  {' · '}{product.salePrice > 0 ? `${product.salePrice.toFixed(2)}€` : 'Prix ?'}
                  {' · '}{product.unit}
                  {product.variants.length > 0 ? ` · ${product.variants.length} var.` : ''}
                </Text>
              </View>
              {!isDuplicate && (
                <Text style={[mStyles.previewStatus, { color: statusColor }]}>{product.statusMessage}</Text>
              )}
              {product.variants.length > 0 && (
                <ChevronRight size={14} color={colors.textTertiary} style={isExpanded ? { transform: [{ rotate: '90deg' }] } : undefined} />
              )}
            </TouchableOpacity>

            {isDbDup && (
              <View style={[mStyles.dupActionBar, { borderTopColor: colors.borderLight }]}>
                <TouchableOpacity
                  style={[
                    mStyles.dupActionBtn,
                    {
                      backgroundColor: dupAction === 'ignore' ? '#FEF3C7' : colors.surfaceHover,
                      borderColor: dupAction === 'ignore' ? '#D97706' : colors.border,
                    },
                  ]}
                  onPress={() => setDuplicateAction(idx, 'ignore')}
                  activeOpacity={0.7}
                >
                  <XCircle size={12} color={dupAction === 'ignore' ? '#B45309' : colors.textTertiary} />
                  <Text style={[mStyles.dupActionText, { color: dupAction === 'ignore' ? '#B45309' : colors.textSecondary }]}>Ignorer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    mStyles.dupActionBtn,
                    {
                      backgroundColor: dupAction === 'update' ? '#DBEAFE' : colors.surfaceHover,
                      borderColor: dupAction === 'update' ? '#1D4ED8' : colors.border,
                    },
                  ]}
                  onPress={() => setDuplicateAction(idx, 'update')}
                  activeOpacity={0.7}
                >
                  <CheckCircle size={12} color={dupAction === 'update' ? '#1D4ED8' : colors.textTertiary} />
                  <Text style={[mStyles.dupActionText, { color: dupAction === 'update' ? '#1D4ED8' : colors.textSecondary }]}>Mettre à jour</Text>
                </TouchableOpacity>
              </View>
            )}

            {product.status === 'error' && !isDuplicate && (
              <View style={[mStyles.inlineEdit, { borderTopColor: colors.borderLight }]}>
                <TextInput
                  style={[mStyles.inlineEditInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.danger }]}
                  value={product.name}
                  onChangeText={v => updatePreviewField(idx, 'name', v)}
                  placeholder="Nom du produit"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            )}
            {product.status === 'warning' && !isDuplicate && (
              <View style={[mStyles.inlineEdit, { borderTopColor: colors.borderLight }]}>
                <TextInput
                  style={[mStyles.inlineEditInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.warning, flex: 1 }]}
                  value={product.salePrice > 0 ? String(product.salePrice) : ''}
                  onChangeText={v => updatePreviewField(idx, 'salePrice', v)}
                  placeholder="Prix de vente"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>
            )}

            {isExpanded && product.variants.length > 0 && (
              <View style={[mStyles.variantsList, { borderTopColor: colors.borderLight }]}>
                {product.variants.map((v, vIdx) => (
                  <View key={vIdx} style={[mStyles.variantRow, { backgroundColor: `${colors.primary}06` }]}>
                    <View style={[mStyles.variantIndent, { backgroundColor: colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[mStyles.variantText, { color: colors.text }]} numberOfLines={1}>
                        {Object.keys(v.attributes).length > 0
                          ? formatAttrString(v.attributes)
                          : `Variante ${vIdx + 1}`
                        }
                      </Text>
                      <Text style={[mStyles.variantMeta, { color: colors.textTertiary }]}>
                        {v.salePrice.toFixed(2)}€ · Stock: {v.stockQuantity}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderImportingStep = () => (
    <View style={mStyles.importingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[mStyles.importingText, { color: colors.text }]}>Import en cours...</Text>
      <View style={[mStyles.progressBar, { backgroundColor: colors.borderLight }]}>
        <View style={[mStyles.progressFill, { backgroundColor: colors.primary, width: `${importProgress}%` as never }]} />
      </View>
      <Text style={[mStyles.progressText, { color: colors.textTertiary }]}>{importProgress}%</Text>
    </View>
  );

  const renderResultStep = () => {
    if (!importResult) return null;
    return (
      <View style={{ gap: 16 }}>
        <View style={[mStyles.resultCard, { backgroundColor: colors.successLight }]}>
          <CheckCircle size={24} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={[mStyles.resultTitle, { color: colors.success }]}>Import terminé</Text>
            <Text style={[mStyles.resultText, { color: colors.text }]}>
              {importResult.productsCreated} produit{importResult.productsCreated > 1 ? 's' : ''} créé{importResult.productsCreated > 1 ? 's' : ''}
              {importResult.productsUpdated > 0 ? `, ${importResult.productsUpdated} mis à jour` : ''}
              {importResult.variantsCreated > 0 ? `, ${importResult.variantsCreated} variante${importResult.variantsCreated > 1 ? 's' : ''}` : ''}
              {importResult.categoriesCreated > 0 ? `, ${importResult.categoriesCreated} catégorie${importResult.categoriesCreated > 1 ? 's' : ''} créée${importResult.categoriesCreated > 1 ? 's' : ''}` : ''}
            </Text>
          </View>
        </View>
        {importResult.errors.length > 0 && (
          <View style={[mStyles.resultCard, { backgroundColor: colors.dangerLight }]}>
            <AlertTriangle size={20} color={colors.danger} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[mStyles.resultTitle, { color: colors.danger }]}>{importResult.errors.length} erreur(s)</Text>
              {importResult.errors.slice(0, 10).map((err, idx) => (
                <Text key={idx} style={[mStyles.resultError, { color: colors.danger }]}>• {err}</Text>
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
      const importCount = summary.ready + summary.warnings;
      const updateCount = summary.toUpdate;
      const parts: string[] = [];
      if (importCount > 0) parts.push(`${importCount} nouveau${importCount > 1 ? 'x' : ''}`);
      if (updateCount > 0) parts.push(`${updateCount} mise${updateCount > 1 ? 's' : ''} à jour`);
      return parts.length > 0 ? `Importer (${parts.join(', ')})` : 'Rien à importer';
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
      title="Importer des produits"
      onSubmit={step !== 'importing' ? handleSubmit : undefined}
      submitLabel={getSubmitLabel()}
      submitDisabled={step === 'input' ? !canAnalyze : step === 'preview' ? !canImport : false}
      width={720}
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

const mStyles = StyleSheet.create({
  methodBar: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderRadius: 0,
  },
  methodTabText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  section: { gap: 10 },
  csvInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    minHeight: 160,
    textAlignVertical: 'top' as const,
  },
  hint: { fontSize: 11 },
  filePickBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderRadius: 10,
    paddingVertical: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  filePickText: { fontSize: 14, fontWeight: '600' as const },
  fileInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  fileInfoText: { fontSize: 13, fontWeight: '500' as const },
  dynColBar: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  dynColLabel: { fontSize: 12, fontWeight: '600' as const },
  dynColChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  dynColChipText: { fontSize: 11, fontWeight: '600' as const },
  dynColAddRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  dynColInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    width: 100,
  },
  dynColAddBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  manualHeader: {
    flexDirection: 'row' as const,
    gap: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    paddingRight: 28,
  },
  manualHeaderText: { fontSize: 10, fontWeight: '600' as const, textTransform: 'uppercase' as const },
  manualRow: {
    flexDirection: 'row' as const,
    gap: 4,
    paddingVertical: 4,
    borderBottomWidth: 1,
    alignItems: 'center' as const,
  },
  manualCell: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
  },
  removeRowBtn: { width: 28, alignItems: 'center' as const },
  addRowBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderRadius: 8,
    paddingVertical: 8,
  },
  addRowBtnText: { fontSize: 12, fontWeight: '600' as const },
  formatInfo: {
    flexDirection: 'row' as const,
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  formatInfoTitle: { fontSize: 12, fontWeight: '600' as const, marginBottom: 2 },
  formatInfoText: { fontSize: 11, lineHeight: 16 },
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
  summaryBadgeText: { fontSize: 12, fontWeight: '600' as const },
  attrDetectedBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  attrDetectedText: { fontSize: 12, fontWeight: '600' as const },
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
  previewName: { fontSize: 14, fontWeight: '600' as const },
  previewMeta: { fontSize: 11, marginTop: 2 },
  previewStatus: { fontSize: 11, fontWeight: '600' as const },
  inlineEdit: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  inlineEditInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  variantsList: {
    borderTopWidth: 1,
  },
  variantRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  variantIndent: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  variantText: { fontSize: 12, fontWeight: '500' as const },
  variantMeta: { fontSize: 11, marginTop: 2 },
  importingContainer: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 40,
    gap: 16,
  },
  importingText: { fontSize: 16, fontWeight: '600' as const },
  progressBar: {
    width: '80%' as const,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: { fontSize: 13, fontWeight: '500' as const },
  resultCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    padding: 16,
    borderRadius: 10,
  },
  resultTitle: { fontSize: 15, fontWeight: '700' as const },
  resultText: { fontSize: 13, marginTop: 2 },
  resultError: { fontSize: 12 },
  dupBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  dupBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#B45309',
  },
  dupActionBar: {
    flexDirection: 'row' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  dupActionBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  dupActionText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
});