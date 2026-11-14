import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import { FamilyMember, Gender } from '../types';
import { AVATAR_PRESETS } from '../sampleData';

export type QuickRelationContext =
  | { type: 'none' }
  | { type: 'child_of'; target: FamilyMember }
  | { type: 'spouse_of'; target: FamilyMember }
  | { type: 'parent_of'; target: FamilyMember };

interface MemberModalProps {
  visible: boolean;
  editingMember: FamilyMember | null;
  relationContext: QuickRelationContext;
  allMembers: FamilyMember[];
  onClose: () => void;
  onSave: (
    memberData: Omit<FamilyMember, 'id'>,
    relationContext: QuickRelationContext
  ) => void;
}

export const MemberModal: React.FC<MemberModalProps> = ({
  visible,
  editingMember,
  relationContext,
  allMembers,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [birthYear, setBirthYear] = useState('');
  const [deathYear, setDeathYear] = useState('');
  const [avatar, setAvatar] = useState('🧑');
  const [notes, setNotes] = useState('');
  const [parentIds, setParentIds] = useState<string[]>([]);
  const [spouseIds, setSpouseIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    setError('');

    if (editingMember) {
      setName(editingMember.name);
      setGender(editingMember.gender === 'female' ? 'female' : 'male');
      setBirthYear(editingMember.birthYear || '');
      setDeathYear(editingMember.deathYear || '');
      const isUrl =
        editingMember.avatar.startsWith('http://') ||
        editingMember.avatar.startsWith('https://');
      setAvatar(isUrl ? '🧑' : editingMember.avatar || '🧑');
      setNotes(editingMember.notes || '');
      setParentIds(editingMember.parentIds || []);
      setSpouseIds(editingMember.spouseIds || []);
    } else {
      setName('');
      setGender('male');
      setBirthYear('');
      setDeathYear('');
      setAvatar('🧑');
      setNotes('');

      if (relationContext.type === 'child_of') {
        const defaultParents = [
          relationContext.target.id,
          ...relationContext.target.spouseIds.slice(0, 1),
        ];
        setParentIds(defaultParents);
        setSpouseIds([]);
      } else if (relationContext.type === 'spouse_of') {
        setParentIds([]);
        setSpouseIds([relationContext.target.id]);
        setGender(relationContext.target.gender === 'male' ? 'female' : 'male');
      } else {
        setParentIds([]);
        setSpouseIds([]);
      }
    }
  }, [visible, editingMember, relationContext]);

  const toggleParent = (id: string) => {
    setParentIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const toggleSpouse = (id: string) => {
    setSpouseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Please enter a name for this family member.');
      return;
    }

    onSave(
      {
        name: name.trim(),
        gender,
        birthYear: birthYear.trim() || undefined,
        deathYear: deathYear.trim() || undefined,
        avatar: avatar || '🧑',
        notes: notes.trim() || undefined,
        parentIds,
        spouseIds,
      },
      relationContext
    );
  };

  const candidateRelatives = allMembers.filter(
    (m) => !editingMember || m.id !== editingMember.id
  );

  const getContextBanner = () => {
    if (editingMember) return editingMember.name;
    switch (relationContext.type) {
      case 'child_of':
        return `Child of ${relationContext.target.name}`;
      case 'spouse_of':
        return `Spouse of ${relationContext.target.name}`;
      case 'parent_of':
        return `Parent of ${relationContext.target.name}`;
      default:
        return 'Adding a new family member';
    }
  };

  const row1Emojis = AVATAR_PRESETS.slice(0, 8);
  const row2Emojis = AVATAR_PRESETS.slice(8, 16);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
      >
        <View
          style={[
            styles.sheet,
            keyboardHeight > 0 && { maxHeight: '96%', paddingBottom: 8 },
          ]}
        >
          {/* Top Compact Header: Title on left, Birth/Death + Diskette Save + Close X on right */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {editingMember ? 'Edit Member' : 'New Member'}
              </Text>
              <Text style={styles.sheetSubtitle} numberOfLines={1}>
                {getContextBanner()}
              </Text>
            </View>

            <View style={styles.headerRightGroup}>
              <View style={styles.miniYearCol}>
                <Text style={styles.miniYearLabel}>Birth</Text>
                <TextInput
                  style={styles.miniYearInput}
                  placeholder="1997"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={4}
                  value={birthYear}
                  onChangeText={setBirthYear}
                />
              </View>

              <Text style={styles.yearDash}>–</Text>

              <View style={styles.miniYearCol}>
                <Text style={styles.miniYearLabel}>Death</Text>
                <TextInput
                  style={styles.miniYearInput}
                  placeholder="Living"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={4}
                  value={deathYear}
                  onChangeText={setDeathYear}
                />
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                style={styles.saveIconBtn}
                accessibilityLabel="Save Family Member"
              >
                <Text style={styles.saveIconText}>💾</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel="Close Modal"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.formScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Row 1: Full Name + Inline Gender Toggle */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Full Name *</Text>
              <Text style={styles.label}>Gender</Text>
            </View>
            <View style={styles.nameGenderRow}>
              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder="e.g., Eleanor Pendelton"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />
              <View style={styles.genderToggle}>
                <TouchableOpacity
                  style={[
                    styles.genderPill,
                    gender === 'male' && styles.genderPillMaleActive,
                  ]}
                  onPress={() => setGender('male')}
                >
                  <Text
                    style={[
                      styles.genderPillText,
                      gender === 'male' && styles.genderPillMaleTextActive,
                    ]}
                  >
                    ♂ Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderPill,
                    gender === 'female' && styles.genderPillFemaleActive,
                  ]}
                  onPress={() => setGender('female')}
                >
                  <Text
                    style={[
                      styles.genderPillText,
                      gender === 'female' && styles.genderPillFemaleTextActive,
                    ]}
                  >
                    ♀ Female
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Row 2: 16 Avatar Emojis (2×8 Compact Grid) */}
            <Text style={styles.label}>Avatar Emoji</Text>
            <View style={styles.avatarGridContainer}>
              {[row1Emojis, row2Emojis].map((row, rIdx) => (
                <View key={`emoji-row-${rIdx}`} style={styles.avatarRow}>
                  {row.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.avatarChip,
                        avatar === emoji && styles.avatarChipActive,
                      ]}
                      onPress={() => setAvatar(emoji)}
                    >
                      <Text style={styles.avatarChipEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            {/* Row 3: Compact Bio / Notes */}
            <Text style={styles.label}>Bio / Notes</Text>
            <TextInput
              style={[styles.input, styles.compactNotesInput]}
              placeholder="Occupation, hometown, memories..."
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
            />

            {/* Row 4 & 5: Compact Parents & Spouse Chips */}
            {candidateRelatives.length > 0 && (
              <>
                <Text style={styles.label}>
                  Parents (Select up to 2 • Selected: {parentIds.length}/2)
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {candidateRelatives.map((rel) => {
                    const selected = parentIds.includes(rel.id);
                    return (
                      <TouchableOpacity
                        key={`parent-${rel.id}`}
                        style={[styles.relChip, selected && styles.relChipActive]}
                        onPress={() => toggleParent(rel.id)}
                      >
                        <Text
                          style={[
                            styles.relChipText,
                            selected && styles.relChipTextActive,
                          ]}
                        >
                          {rel.avatar} {rel.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={styles.label}>Spouse / Partner</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {candidateRelatives.map((rel) => {
                    const selected = spouseIds.includes(rel.id);
                    return (
                      <TouchableOpacity
                        key={`spouse-${rel.id}`}
                        style={[
                          styles.relChip,
                          selected && styles.relChipSpouseActive,
                        ]}
                        onPress={() => toggleSpouse(rel.id)}
                      >
                        <Text
                          style={[
                            styles.relChipText,
                            selected && styles.relChipSpouseTextActive,
                          ]}
                        >
                          ❤️ {rel.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '85%',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 1,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  miniYearCol: {
    alignItems: 'flex-start',
  },
  miniYearLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
    marginLeft: 2,
  },
  miniYearInput: {
    width: 58,
    height: 32,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 0,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  yearDash: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 7,
  },
  saveIconBtn: {
    width: 34,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  saveIconText: {
    fontSize: 15,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  formScroll: {
    flexGrow: 0,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '600',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginTop: 7,
    marginBottom: 4,
  },
  nameGenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#0F172A',
  },
  nameInput: {
    flex: 1,
    height: 36,
  },
  genderToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 2,
    height: 36,
    alignItems: 'center',
  },
  genderPill: {
    paddingHorizontal: 9,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderPillMaleActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  genderPillFemaleActive: {
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#F472B6',
  },
  genderPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  genderPillMaleTextActive: {
    color: '#2563EB',
  },
  genderPillFemaleTextActive: {
    color: '#DB2777',
  },
  avatarGridContainer: {
    gap: 5,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: 5,
  },
  avatarChip: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChipActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
  },
  avatarChipEmoji: {
    fontSize: 18,
  },
  compactNotesInput: {
    height: 36,
  },
  chipScroll: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  relChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  relChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  relChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  relChipTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  relChipSpouseActive: {
    backgroundColor: '#FFF1F2',
    borderColor: '#F43F5E',
  },
  relChipSpouseTextActive: {
    color: '#E11D48',
    fontWeight: '700',
  },
});
