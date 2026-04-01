/**
 * @fileoverview Invoice import section with document picker and camera OCR.
 * Allows importing invoice data from PDF/image files or camera capture.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { FileText, Camera, ChevronDown, ChevronUp, Bot } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { processInvoiceFile, type ParsedInvoiceData } from '@/services/ocrService';

interface InvoiceImportSectionProps {
  onDataExtracted: (data: ParsedInvoiceData, fileUri: string, fileName: string) => void;
}

export default function InvoiceImportSection({ onDataExtracted }: InvoiceImportSectionProps) {
  const { colors } = useTheme();
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState('');
  const [extractionError, setExtractionError] = useState('');
  const [rawTextVisible, setRawTextVisible] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastConfidence, setLastConfidence] = useState<'high' | 'medium' | 'low' | null>(null);

  const progressAnim = React.useRef(new Animated.Value(0)).current;

  const updateProgress = useCallback((p: number, step: string) => {
    setProgress(p);
    setStepLabel(step);
    Animated.timing(progressAnim, {
      toValue: p,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progressAnim]);

  const handlePickPDF = useCallback(async () => {
    if (Platform.OS !== 'web') {
      setExtractionError("L'import PDF est disponible uniquement sur navigateur web");
      return;
    }
    setExtractionError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const file = result.assets[0];

      setIsExtracting(true);
      setProgress(0);
      setStepLabel('Préparation...');
      progressAnim.setValue(0);

      const data = await processInvoiceFile(file.uri, 'pdf', (p, step) => {
        updateProgress(p, step);
      });

      setLastRawText(data.raw_text);
      setLastConfidence(data.confidence);
      setIsExtracting(false);
      onDataExtracted(data, file.uri, file.name || 'facture.pdf');
    } catch {
      setExtractionError("Erreur lors de l'import du PDF");
      setIsExtracting(false);
    }
  }, [onDataExtracted, updateProgress, progressAnim]);

  const handleTakePhoto = useCallback(async () => {
    if (Platform.OS !== 'web') {
      setExtractionError("L'OCR est disponible uniquement sur navigateur web");
      return;
    }
    setExtractionError('');
    try {
      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permResult.granted) {
        setExtractionError("Permission caméra refusée");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];

      setIsExtracting(true);
      setProgress(0);
      setStepLabel('Préparation OCR...');
      progressAnim.setValue(0);

      const data = await processInvoiceFile(asset.uri, 'image', (p, step) => {
        updateProgress(p, step);
      });

      setLastRawText(data.raw_text);
      setLastConfidence(data.confidence);
      setIsExtracting(false);
      onDataExtracted(data, asset.uri, 'photo-facture.jpg');
    } catch {
      setExtractionError("Erreur lors de l'import photo");
      setIsExtracting(false);
    }
  }, [onDataExtracted, updateProgress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {!isExtracting && !lastConfidence && (
        <View style={[styles.importCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}>
          <View style={styles.importHeader}>
            <FileText size={20} color={colors.primary} />
            <Text style={[styles.importTitle, { color: colors.primary }]}>Importer une facture</Text>
          </View>
          <Text style={[styles.importDesc, { color: colors.textSecondary }]}>
            Extraction automatique des données depuis un PDF ou une photo
          </Text>
          <View style={styles.importActions}>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: colors.primary }]}
              onPress={handlePickPDF}
              activeOpacity={0.7}
            >
              <FileText size={16} color="#FFF" />
              <Text style={styles.importBtnText}>Choisir un PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary }]}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <Camera size={16} color={colors.primary} />
              <Text style={[styles.importBtnText, { color: colors.primary }]}>Prendre en photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isExtracting && (
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.progressHeader}>
            <Bot size={18} color={colors.primary} />
            <Text style={[styles.progressTitle, { color: colors.text }]}>{stepLabel}</Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.borderLight }]}>
            <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.progressPercent, { color: colors.textTertiary }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      )}

      {lastConfidence && !isExtracting && (
        <View style={[
          styles.confidenceBanner,
          {
            backgroundColor: lastConfidence === 'high' ? colors.successLight :
              lastConfidence === 'medium' ? colors.warningLight : colors.dangerLight,
            borderColor: lastConfidence === 'high' ? colors.success + '40' :
              lastConfidence === 'medium' ? colors.warning + '40' : colors.danger + '40',
          },
        ]}>
          <Text style={[styles.confidenceText, {
            color: lastConfidence === 'high' ? colors.success :
              lastConfidence === 'medium' ? colors.warning : colors.danger,
          }]}>
            {lastConfidence === 'high' && 'Facture analysee avec succes -- Verifiez avant de valider'}
            {lastConfidence === 'medium' && 'Facture partiellement lue -- Completez les champs manquants'}
            {lastConfidence === 'low' && 'Lecture difficile -- Completez manuellement'}
          </Text>
          <TouchableOpacity
            style={styles.rawTextToggle}
            onPress={() => setRawTextVisible(!rawTextVisible)}
          >
            <Text style={[styles.rawTextToggleText, { color: colors.textSecondary }]}>
              {rawTextVisible ? 'Masquer' : 'Voir'} le texte brut
            </Text>
            {rawTextVisible ? <ChevronUp size={14} color={colors.textSecondary} /> : <ChevronDown size={14} color={colors.textSecondary} />}
          </TouchableOpacity>
          {rawTextVisible && (
            <View style={[styles.rawTextBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Text style={[styles.rawText, { color: colors.textSecondary }]} selectable>
                {lastRawText || '(aucun texte extrait)'}
              </Text>
            </View>
          )}
        </View>
      )}

      {extractionError ? (
        <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{extractionError}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function OcrFieldIndicator() {
  return (
    <View style={ocrStyles.indicator}>
      <Bot size={12} color="#3B82F6" />
    </View>
  );
}

const ocrStyles = StyleSheet.create({
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 6,
  },
});

const styles = StyleSheet.create({
  container: { gap: 12, marginBottom: 4 },
  importCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderStyle: 'dashed' as const,
  },
  importHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  importTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  importDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  importActions: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 4,
  },
  importBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  importBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%' as const,
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 11,
    textAlign: 'right' as const,
  },
  confidenceBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  rawTextToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    alignSelf: 'flex-start' as const,
  },
  rawTextToggleText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  rawTextBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    maxHeight: 200,
  },
  rawText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    lineHeight: 16,
  },
  errorBanner: {
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
});
