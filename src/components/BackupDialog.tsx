import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Share,
} from 'react-native';
import { FamilyMember } from '../types';

interface BackupDialogProps {
  members: FamilyMember[];
  onClose: () => void;
  onImport: (imported: FamilyMember[]) => void;
  onResetSample: () => void;
  onClearAll: () => void;
}

export const BackupDialog: React.FC<BackupDialogProps> = ({
  members,
  onClose,
  onImport,
  onResetSample,
  onClearAll,
}) => {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(members, null, 2));
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(
    null
  );

  useEffect(() => {
    setJsonText(JSON.stringify(members, null, 2));
  }, [members]);

  const handleShareExport = async () => {
    try {
      await Share.share({
        message: jsonText,
        title: 'Family Tree Backup JSON',
      });
    } catch {
      setStatusMsg({
        text: 'Select and copy the JSON text below to back it up.',
      });
    }
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        setStatusMsg({ text: 'JSON must be an array of family members.', isError: true });
        return;
      }
      const valid = parsed.every(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          Array.isArray(item.parentIds) &&
          Array.isArray(item.spouseIds)
      );
      if (!valid) {
        setStatusMsg({
          text: 'Invalid format: each entry needs id, name, parentIds, and spouseIds.',
          isError: true,
        });
        return;
      }
      onImport(parsed);
      setStatusMsg({ text: `Imported ${parsed.length} members successfully!` });
    } catch {
      setStatusMsg({ text: 'Invalid JSON syntax. Please check your input.', isError: true });
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.dialog}>
        <View style={styles.header}>
          <Text style={styles.title}>Backup & Restore (JSON)</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.desc}>
          Your family tree is automatically saved locally on your device. You can copy or
          share the JSON below as a backup, or paste JSON to restore.
        </Text>

        {statusMsg && (
          <View
            style={[
              styles.statusBanner,
              statusMsg.isError ? styles.statusError : styles.statusSuccess,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                statusMsg.isError ? styles.statusErrorText : styles.statusSuccessText,
              ]}
            >
              {statusMsg.text}
            </Text>
          </View>
        )}

        <TextInput
          style={styles.jsonBox}
          multiline
          value={jsonText}
          onChangeText={setJsonText}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleShareExport}>
            <Text style={styles.secondaryBtnText}>📤 Share / Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleImportJson}>
            <Text style={styles.primaryBtnText}>📥 Load from JSON</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetBtn} onPress={onResetSample}>
            <Text style={styles.presetBtnText}>Reset to Sample Tree</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetBtn, styles.dangerPresetBtn]}
            onPress={onClearAll}
          >
            <Text style={styles.dangerPresetText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 18,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  desc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  statusBanner: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  statusSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusSuccessText: {
    color: '#047857',
  },
  statusErrorText: {
    color: '#DC2626',
  },
  jsonBox: {
    backgroundColor: '#0F172A',
    color: '#E2E8F0',
    fontFamily: 'monospace',
    fontSize: 11,
    borderRadius: 12,
    padding: 12,
    height: 210,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    gap: 10,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  dangerPresetBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  dangerPresetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
});
