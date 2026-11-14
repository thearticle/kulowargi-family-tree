import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  StatusBar as RNStatusBar,
  Platform,
  Keyboard,
  Modal,
  Image,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FamilyMember, Gender } from './src/types';
import { SAMPLE_FAMILY } from './src/sampleData';
import { computeTreeLayout } from './src/treeLayout';
import { TreeCanvas } from './src/components/TreeCanvas';
import { MemberModal, QuickRelationContext } from './src/components/MemberModal';
import { BackupModal } from './src/components/BackupModal';

const STORAGE_KEY = '@family_tree_members_v2';
const THEME_STORAGE_KEY = '@family_tree_theme_mode';

export default function App() {
  const [members, setMembers] = useState<FamilyMember[]>(SAMPLE_FAMILY);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Navigation & selection state
  const [activeTab, setActiveTab] = useState<'tree' | 'directory'>('tree');
  const [selectedId, setSelectedId] = useState<string | null>('g3_1');

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | Gender>('all');
  const [genFilter, setGenFilter] = useState<number | 'all'>('all');

  // Modal state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [relationContext, setRelationContext] = useState<QuickRelationContext>({
    type: 'none',
  });
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [confirmDeleteMember, setConfirmDeleteMember] =
    useState<FamilyMember | null>(null);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subtle breathing glow animation on logo to indicate clickability
  const logoGlowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: false,
        }),
        Animated.timing(logoGlowAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [logoGlowAnim]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () =>
      setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () =>
      setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load saved tree and theme on mount
  useEffect(() => {
    (async () => {
      try {
        const [rawMembers, rawTheme] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(THEME_STORAGE_KEY),
        ]);
        if (rawMembers) {
          const parsed = JSON.parse(rawMembers);
          if (Array.isArray(parsed)) {
            const sanitized: FamilyMember[] = parsed.map((m: any) => ({
              ...m,
              gender: m.gender === 'female' ? 'female' : 'male',
              avatar: typeof m.avatar === 'string' && m.avatar ? m.avatar : '🧑',
              parentIds: Array.isArray(m.parentIds) ? m.parentIds : [],
              spouseIds: Array.isArray(m.spouseIds) ? m.spouseIds : [],
              position:
                m.position && typeof m.position.x === 'number' && typeof m.position.y === 'number'
                  ? { x: m.position.x, y: m.position.y }
                  : undefined,
            }));
            setMembers(sanitized);
          }
        }
        if (rawTheme !== null) {
          setIsDarkMode(rawTheme === 'dark');
        }
      } catch (e) {
        console.warn('Failed to load family tree or theme from storage:', e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light').catch(console.warn);
      return next;
    });
  };

  // Persist whenever members change
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(members)).catch((e) =>
      console.warn('Failed to save family tree:', e)
    );
  }, [members, isLoaded]);

  // Compute visual layout & generations
  const layout = useMemo(() => computeTreeLayout(members), [members]);

  const availableGenerations = useMemo(() => {
    const gens = new Set<number>(Object.values(layout.generationMap));
    return Array.from(gens).sort((a, b) => a - b);
  }, [layout.generationMap]);

  // Filtered members for search & directory
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (genderFilter !== 'all' && m.gender !== genderFilter) return false;
      if (genFilter !== 'all' && layout.generationMap[m.id] !== genFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.birthYear && m.birthYear.includes(q)) ||
        (m.notes && m.notes.toLowerCase().includes(q))
      );
    });
  }, [members, searchQuery, genderFilter, genFilter, layout.generationMap]);

  const highlightedIds = useMemo(() => {
    const hasActiveFilter =
      searchQuery.trim().length > 0 || genderFilter !== 'all' || genFilter !== 'all';
    if (!hasActiveFilter) return new Set<string>();
    return new Set(filteredMembers.map((m) => m.id));
  }, [filteredMembers, searchQuery, genderFilter, genFilter]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedId) || null,
    [members, selectedId]
  );

  // Helpers to resolve relatives of a member
  const getMemberById = useCallback((id: string) => members.find((m) => m.id === id), [members]);
  const getChildrenOf = useCallback(
    (id: string) => members.filter((m) => m.parentIds.includes(id)),
    [members]
  );

  const handleSelectMember = useCallback((m: FamilyMember) => {
    setSelectedId(m.id);
  }, []);

  const keyExtractor = useCallback((item: FamilyMember) => item.id, []);

  // Open Modal handlers
  const handleOpenAddStandalone = useCallback(() => {
    setEditingMember(null);
    setRelationContext({ type: 'none' });
    setMemberModalOpen(true);
  }, []);

  const handleOpenQuickRelation = useCallback((ctx: QuickRelationContext) => {
    setEditingMember(null);
    setRelationContext(ctx);
    setMemberModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((member: FamilyMember) => {
    setEditingMember(member);
    setRelationContext({ type: 'none' });
    setMemberModalOpen(true);
  }, []);

  // Save (Add or Edit) Member with bidirectional spouse sync
  const handleSaveMember = (
    data: Omit<FamilyMember, 'id'>,
    ctx: QuickRelationContext
  ) => {
    const isEditing = Boolean(editingMember);
    const createdId = editingMember ? editingMember.id : `m_${Date.now()}`;

    setMembers((prev) => {
      const targetId = createdId;
      const savedMember: FamilyMember = {
        id: targetId,
        ...data,
        position: editingMember?.position,
      };

      let nextList = editingMember
        ? prev.map((m) => (m.id === targetId ? savedMember : m))
        : [...prev, savedMember];

      // Synchronize bidirectional spouseIds
      nextList = nextList.map((m) => {
        if (m.id === targetId) return m;
        const shouldBeSpouse = savedMember.spouseIds.includes(m.id);
        const currentlyHasSpouse = m.spouseIds.includes(targetId);

        if (shouldBeSpouse && !currentlyHasSpouse) {
          return { ...m, spouseIds: [...m.spouseIds, targetId] };
        }
        if (!shouldBeSpouse && currentlyHasSpouse) {
          return { ...m, spouseIds: m.spouseIds.filter((id) => id !== targetId) };
        }
        return m;
      });

      // If adding a parent of an existing target member, attach targetId to that child's parentIds
      if (!editingMember && ctx.type === 'parent_of') {
        nextList = nextList.map((m) => {
          if (m.id === ctx.target.id && !m.parentIds.includes(targetId)) {
            const updatedParents = [...m.parentIds, targetId].slice(-2);
            return { ...m, parentIds: updatedParents };
          }
          return m;
        });
      }

      return nextList;
    });

    setSelectedId(createdId);
    setMemberModalOpen(false);
    showToast(
      isEditing
        ? `✅ Saved "${data.name}" successfully!`
        : `✅ Added "${data.name}" successfully!`
    );
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteMember) return;
    const id = confirmDeleteMember.id;
    const deletedName = confirmDeleteMember.name;
    setMembers((prev) =>
      prev
        .filter((m) => m.id !== id)
        .map((m) => ({
          ...m,
          parentIds: m.parentIds.filter((pid) => pid !== id),
          spouseIds: m.spouseIds.filter((sid) => sid !== id),
        }))
    );
    if (selectedId === id) {
      setSelectedId(null);
    }
    setConfirmDeleteMember(null);
    showToast(`🗑️ Deleted "${deletedName}"`);
  };

  const handleUpdateMemberPosition = useCallback(
    (memberId: string, position: { x: number; y: number }) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, position } : m))
      );
    },
    []
  );

  const handleResetAllPositions = useCallback(() => {
    setMembers((prev) =>
      prev.map((m) => {
        if (!m.position) return m;
        const { position, ...rest } = m;
        return rest as FamilyMember;
      })
    );
    showToast('🔄 Reset card positions to auto-layout');
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.safeAreaDark]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Top App Bar */}
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity
          style={styles.headerBrandRow}
          onPress={() => setCreditsModalOpen(true)}
          activeOpacity={0.7}
          accessibilityLabel="Open Credits"
        >
          <Animated.View
            style={[
              styles.logoGlowWrapper,
              {
                shadowOpacity: logoGlowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.15, 0.6],
                }),
                shadowRadius: logoGlowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [3, 8],
                }),
                borderColor: logoGlowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: isDarkMode
                    ? ['#334155', '#4ADE80']
                    : ['#E2E8F0', '#16A34A'],
                }),
                transform: [
                  {
                    scale: logoGlowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.05],
                    }),
                  },
                ],
              },
            ]}
          >
            <Image
              source={require('./assets/header-logo.png')}
              style={styles.headerLogo}
            />
          </Animated.View>
          <View>
            <Text style={[styles.appTitle, isDarkMode && styles.textLight]}>KuloWargi</Text>
            <Text style={[styles.appSubtitle, isDarkMode && styles.textMutedDark]}>
              {members.length} {members.length === 1 ? 'member' : 'members'} •{' '}
              {availableGenerations.length}{' '}
              {availableGenerations.length === 1 ? 'generation' : 'generations'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.themeBtn, isDarkMode && styles.themeBtnDark]}
            onPress={toggleTheme}
            accessibilityLabel="Toggle Dark Mode"
          >
            <Text style={styles.themeBtnText}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backupBtn, isDarkMode && styles.backupBtnDark]}
            onPress={() => setBackupModalOpen(true)}
          >
            <Text style={[styles.backupBtnText, isDarkMode && styles.backupBtnTextDark]}>💾 Backup</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleOpenAddStandalone}
          >
            <Text style={styles.addBtnText}>＋ Person</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & View Switcher Bar */}
      <View style={[styles.toolbar, isDarkMode && styles.toolbarDark]}>
        <View style={[styles.searchContainer, isDarkMode && styles.searchContainerDark]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, isDarkMode && styles.searchInputDark]}
            placeholder="Search name, year, or notes..."
            placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.tabSwitch, isDarkMode && styles.tabSwitchDark]}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'tree' && (isDarkMode ? styles.tabBtnActiveDark : styles.tabBtnActive),
            ]}
            onPress={() => setActiveTab('tree')}
          >
            <Text
              style={[
                styles.tabBtnText,
                isDarkMode && styles.tabBtnTextDark,
                activeTab === 'tree' && (isDarkMode ? styles.tabBtnTextActiveDark : styles.tabBtnTextActive),
              ]}
            >
              Tree
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'directory' && (isDarkMode ? styles.tabBtnActiveDark : styles.tabBtnActive),
            ]}
            onPress={() => setActiveTab('directory')}
          >
            <Text
              style={[
                styles.tabBtnText,
                isDarkMode && styles.tabBtnTextDark,
                activeTab === 'directory' && (isDarkMode ? styles.tabBtnTextActiveDark : styles.tabBtnTextActive),
              ]}
            >
              List ({filteredMembers.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Pills */}
      <View style={[styles.filterBar, isDarkMode && styles.filterBarDark]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['all', 'male', 'female'] as const).map((g) => (
            <TouchableOpacity
              key={`gf-${g}`}
              style={[
                styles.filterChip,
                isDarkMode && styles.filterChipDark,
                genderFilter === g && (isDarkMode ? styles.filterChipActiveDark : styles.filterChipActive),
              ]}
              onPress={() => setGenderFilter(g)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isDarkMode && styles.filterChipTextDark,
                  genderFilter === g && (isDarkMode ? styles.filterChipTextActiveDark : styles.filterChipTextActive),
                ]}
              >
                {g === 'all'
                  ? 'All Genders'
                  : g === 'male'
                  ? '♂ Male'
                  : '♀ Female'}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={[styles.filterDivider, isDarkMode && styles.filterDividerDark]} />

          <TouchableOpacity
            style={[
              styles.filterChip,
              isDarkMode && styles.filterChipDark,
              genFilter === 'all' && (isDarkMode ? styles.filterChipActiveDark : styles.filterChipActive),
            ]}
            onPress={() => setGenFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                isDarkMode && styles.filterChipTextDark,
                genFilter === 'all' && (isDarkMode ? styles.filterChipTextActiveDark : styles.filterChipTextActive),
              ]}
            >
              All Generations
            </Text>
          </TouchableOpacity>

          {availableGenerations.map((g) => (
            <TouchableOpacity
              key={`gen-${g}`}
              style={[
                styles.filterChip,
                isDarkMode && styles.filterChipDark,
                genFilter === g && (isDarkMode ? styles.filterChipActiveDark : styles.filterChipActive),
              ]}
              onPress={() => setGenFilter(g)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isDarkMode && styles.filterChipTextDark,
                  genFilter === g && (isDarkMode ? styles.filterChipTextActiveDark : styles.filterChipTextActive),
                ]}
              >
                Gen {g + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <View style={[styles.mainContent, isDarkMode && styles.mainContentDark]}>
        {members.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={[styles.emptyTitle, isDarkMode && styles.textLight]}>Start Your Family Tree</Text>
            <Text style={[styles.emptySubtitle, isDarkMode && styles.textMutedDark]}>
              Add the first person to begin mapping generations, or load the sample
              family tree from the Backup menu.
            </Text>
            <TouchableOpacity
              style={styles.emptyPrimaryBtn}
              onPress={handleOpenAddStandalone}
            >
              <Text style={styles.emptyPrimaryBtnText}>＋ Add First Person</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'tree' ? (
          <TreeCanvas
            layout={layout}
            selectedId={selectedId}
            highlightedIds={highlightedIds}
            onSelectMember={handleSelectMember}
            members={members}
            isDarkMode={isDarkMode}
            onUpdateMemberPosition={handleUpdateMemberPosition}
            onResetAllPositions={handleResetAllPositions}
            onAutoArrange={() => showToast('✨ Symmetrically auto-arranged family tree')}
          />
        ) : (
          <FlatList
            data={filteredMembers}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={({ item }) => {
              const gen = (layout.generationMap[item.id] ?? 0) + 1;
              const children = getChildrenOf(item.id);
              return (
                <DirectoryCard
                  item={item}
                  gen={gen}
                  childrenCount={children.length}
                  isSelected={selectedId === item.id}
                  isDarkMode={isDarkMode}
                  onPress={() => {
                    setSelectedId(item.id);
                    setActiveTab('tree');
                  }}
                />
              );
            }}
          />
        )}

        {/* Floating Toaster Notification inside mainContent (never overlaps Search/Tree/Filter bars) */}
        {toastMessage && (
          <View style={styles.toastWrapper} pointerEvents="box-none">
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.toastBanner}
              onPress={() => setToastMessage(null)}
            >
              <Text style={styles.toastText}>{toastMessage}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Selected Member Inspector & Quick Relationship Sheet */}
      {selectedMember && !isKeyboardVisible && (
        <View style={[styles.inspectorSheet, isDarkMode && styles.inspectorSheetDark]}>
          <View style={styles.inspectorTop}>
            <View style={styles.inspectorIdentity}>
              <View style={[styles.inspectorAvatarBox, isDarkMode && styles.inspectorAvatarBoxDark]}>
                <Text style={styles.inspectorAvatarText}>
                  {selectedMember.avatar.startsWith('http')
                    ? '🖼️'
                    : selectedMember.avatar || '🧑'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inspectorName, isDarkMode && styles.textLight]}>{selectedMember.name}</Text>
                <Text style={[styles.inspectorYears, isDarkMode && styles.textMutedDark]}>
                  {selectedMember.birthYear
                    ? `${selectedMember.birthYear} – ${
                        selectedMember.deathYear || 'Present'
                      }`
                    : 'Birth year unknown'}{' '}
                  • Gen {(layout.generationMap[selectedMember.id] ?? 0) + 1}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.dismissInspectorBtn, isDarkMode && styles.dismissInspectorBtnDark]}
                onPress={() => setSelectedId(null)}
              >
                <Text style={[styles.dismissInspectorText, isDarkMode && styles.textMutedDark]}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedMember.notes ? (
              <Text style={[styles.inspectorNotes, isDarkMode && styles.textSubtleDark]} numberOfLines={2}>
                {selectedMember.notes}
              </Text>
            ) : null}

            {/* Clickable Relative Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.relativeBadgesRow}
            >
              {selectedMember.parentIds.map((pid) => {
                const p = getMemberById(pid);
                if (!p) return null;
                return (
                  <TouchableOpacity
                    key={`rel-p-${pid}`}
                    style={[styles.miniRelBadge, isDarkMode && styles.miniRelBadgeDark]}
                    onPress={() => setSelectedId(p.id)}
                  >
                    <Text style={[styles.miniRelText, isDarkMode && styles.textLight]}>⬆️ Parent: {p.name}</Text>
                  </TouchableOpacity>
                );
              })}
              {selectedMember.spouseIds.map((sid) => {
                const s = getMemberById(sid);
                if (!s) return null;
                return (
                  <TouchableOpacity
                    key={`rel-s-${sid}`}
                    style={[styles.miniRelBadge, styles.miniRelSpouse, isDarkMode && styles.miniRelSpouseDark]}
                    onPress={() => setSelectedId(s.id)}
                  >
                    <Text style={styles.miniRelSpouseText}>❤️ Spouse: {s.name}</Text>
                  </TouchableOpacity>
                );
              })}
              {getChildrenOf(selectedMember.id).map((c) => (
                <TouchableOpacity
                  key={`rel-c-${c.id}`}
                  style={[styles.miniRelBadge, isDarkMode && styles.miniRelBadgeDark]}
                  onPress={() => setSelectedId(c.id)}
                >
                  <Text style={[styles.miniRelText, isDarkMode && styles.textLight]}>⬇️ Child: {c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Quick Relationship & Edit Buttons */}
          <View style={styles.quickActionRow}>
            <TouchableOpacity
              style={[styles.quickRelBtn, isDarkMode && styles.quickRelBtnDark]}
              onPress={() =>
                handleOpenQuickRelation({
                  type: 'child_of',
                  target: selectedMember,
                })
              }
            >
              <Text style={styles.quickRelBtnText}>＋ Child</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickRelBtn, isDarkMode && styles.quickRelBtnDark]}
              onPress={() =>
                handleOpenQuickRelation({
                  type: 'spouse_of',
                  target: selectedMember,
                })
              }
            >
              <Text style={styles.quickRelBtnText}>＋ Spouse</Text>
            </TouchableOpacity>

            {selectedMember.parentIds.length < 2 && (
              <TouchableOpacity
                style={[styles.quickRelBtn, isDarkMode && styles.quickRelBtnDark]}
                onPress={() =>
                  handleOpenQuickRelation({
                    type: 'parent_of',
                    target: selectedMember,
                  })
                }
              >
                <Text style={styles.quickRelBtnText}>＋ Parent</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.editActionBtn, isDarkMode && styles.editActionBtnDark]}
              onPress={() => handleOpenEdit(selectedMember)}
            >
              <Text style={[styles.editActionText, isDarkMode && styles.textLight]}>✏️ Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteActionBtn}
              onPress={() => setConfirmDeleteMember(selectedMember)}
            >
              <Text style={styles.deleteActionText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Delete Confirmation Yes/No Modal */}
      <Modal
        visible={Boolean(confirmDeleteMember)}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteMember(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, isDarkMode && styles.confirmBoxDark]}>
            <View style={styles.confirmIconCircle}>
              <Text style={styles.confirmIconEmoji}>🗑️</Text>
            </View>
            <Text style={[styles.confirmTitle, isDarkMode && styles.textLight]}>
              Delete Family Member?
            </Text>
            <Text style={[styles.confirmMessage, isDarkMode && styles.textMutedDark]}>
              Are you sure you want to delete{' '}
              <Text style={[styles.confirmNameBold, isDarkMode && styles.textLight]}>
                {confirmDeleteMember?.name}
              </Text>{' '}
              from your family tree?
            </Text>
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity
                style={[styles.confirmNoBtn, isDarkMode && styles.confirmNoBtnDark]}
                onPress={() => setConfirmDeleteMember(null)}
              >
                <Text style={[styles.confirmNoText, isDarkMode && styles.textLight]}>
                  No
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmYesBtn}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.confirmYesText}>Yes, Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modals */}
      <MemberModal
        visible={memberModalOpen}
        editingMember={editingMember}
        relationContext={relationContext}
        allMembers={members}
        onClose={() => setMemberModalOpen(false)}
        onSave={handleSaveMember}
      />

      <BackupModal
        visible={backupModalOpen}
        members={members}
        onClose={() => setBackupModalOpen(false)}
        onImport={(imported) => {
          setMembers(imported);
          setSelectedId(imported[0]?.id ?? null);
        }}
        onResetSample={() => {
          setMembers(SAMPLE_FAMILY);
          setSelectedId('g3_1');
          setBackupModalOpen(false);
        }}
        onClearAll={() => {
          setMembers([]);
          setSelectedId(null);
          setBackupModalOpen(false);
        }}
      />

      {/* Credits Modal */}
      <Modal
        visible={creditsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreditsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.creditsCard, isDarkMode && styles.creditsCardDark]}>
            <View style={styles.creditsIconBox}>
              <Image
                source={require('./assets/header-logo.png')}
                style={styles.creditsLogo}
              />
            </View>

            <Text style={[styles.creditsAppTitle, isDarkMode && styles.textLight]}>
              KuloWargi
            </Text>
            <Text style={[styles.creditsVersion, isDarkMode && styles.textMutedDark]}>
              Mobile Genealogy • Offline-First
            </Text>

            <View style={[styles.creditsDivider, isDarkMode && styles.creditsDividerDark]} />

            <View style={styles.creditsContentBlock}>
              <Text style={[styles.creditsAuthorLabel, isDarkMode && styles.textMutedDark]}>
                Created by
              </Text>
              <Text style={[styles.creditsAuthorName, isDarkMode && styles.textLight]}>
                fauzan afianto
              </Text>

              <View style={[styles.creditsEmailPill, isDarkMode && styles.creditsEmailPillDark]}>
                <Text style={styles.creditsEmailIcon}>✉️</Text>
                <Text style={[styles.creditsEmailText, isDarkMode && styles.textLight]}>
                  fauzan@afianto.dev
                </Text>
              </View>

              <Text style={[styles.creditsQuote, isDarkMode && styles.creditsQuoteDark]}>
                “may this app found its way to you”
              </Text>
            </View>

            <TouchableOpacity
              style={styles.creditsCloseBtn}
              onPress={() => setCreditsModalOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.creditsCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoGlowWrapper: {
    borderRadius: 22,
    borderWidth: 1.5,
    marginRight: 10,
    padding: 1,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
    backgroundColor: 'transparent',
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  appSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBtn: {
    padding: 2,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  logoBtnDark: {
    backgroundColor: '#1E293B',
  },
  headerLogoTopRight: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  backupBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  backupBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  addBtn: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  clearSearchText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  filterDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginRight: 6,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyPrimaryBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 10,
  },
  listCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listAvatarEmoji: {
    fontSize: 22,
  },
  listInfo: {
    flex: 1,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  listGenBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  listGenBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  listMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  listNotes: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    fontStyle: 'italic',
  },
  inspectorSheet: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  inspectorTop: {
    marginBottom: 10,
  },
  inspectorIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inspectorAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  inspectorAvatarText: {
    fontSize: 22,
  },
  inspectorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  inspectorYears: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  dismissInspectorBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissInspectorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  inspectorNotes: {
    fontSize: 12,
    color: '#475569',
    marginTop: 6,
    lineHeight: 17,
  },
  relativeBadgesRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  miniRelBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  miniRelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  miniRelSpouse: {
    backgroundColor: '#FFF1F2',
  },
  miniRelSpouseText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E11D48',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickRelBtn: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  quickRelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  editActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  editActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  deleteActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  deleteActionText: {
    fontSize: 12,
  },
  // Dark mode style variants
  safeAreaDark: {
    backgroundColor: '#0F172A',
  },
  headerDark: {
    backgroundColor: '#0F172A',
    borderBottomColor: '#1E293B',
  },
  toolbarDark: {
    backgroundColor: '#0F172A',
  },
  filterBarDark: {
    backgroundColor: '#0F172A',
    borderBottomColor: '#1E293B',
  },
  mainContentDark: {
    backgroundColor: '#020617',
  },
  searchContainerDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  searchInputDark: {
    color: '#F8FAFC',
  },
  tabSwitchDark: {
    backgroundColor: '#1E293B',
  },
  tabBtnActiveDark: {
    backgroundColor: '#334155',
  },
  tabBtnTextDark: {
    color: '#94A3B8',
  },
  tabBtnTextActiveDark: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  themeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtnDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  themeBtnText: {
    fontSize: 14,
  },
  backupBtnDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  backupBtnTextDark: {
    color: '#CBD5E1',
  },
  filterChipDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  filterChipActiveDark: {
    backgroundColor: '#312E81',
    borderColor: '#6366F1',
  },
  filterChipTextActiveDark: {
    color: '#A5B4FC',
    fontWeight: '700',
  },
  filterChipTextDark: {
    color: '#94A3B8',
  },
  filterDividerDark: {
    backgroundColor: '#334155',
  },
  listCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
  },
  listCardSelectedDark: {
    borderColor: '#6366F1',
    backgroundColor: '#1E1B4B',
  },
  listAvatarDark: {
    backgroundColor: '#1E293B',
  },
  listGenBadgeDark: {
    backgroundColor: '#312E81',
  },
  listGenBadgeTextDark: {
    color: '#A5B4FC',
  },
  inspectorSheetDark: {
    backgroundColor: '#0F172A',
    borderTopColor: '#1E293B',
    shadowColor: '#000000',
  },
  inspectorAvatarBoxDark: {
    backgroundColor: '#1E293B',
  },
  dismissInspectorBtnDark: {
    backgroundColor: '#1E293B',
  },
  miniRelBadgeDark: {
    backgroundColor: '#1E293B',
  },
  miniRelSpouseDark: {
    backgroundColor: '#4C0519',
  },
  quickRelBtnDark: {
    backgroundColor: '#1E1B4B',
    borderColor: '#4338CA',
  },
  editActionBtnDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  textLight: {
    color: '#F8FAFC',
  },
  textMutedDark: {
    color: '#94A3B8',
  },
  textSubtleDark: {
    color: '#CBD5E1',
  },
  toastWrapper: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999,
    elevation: 20,
  },
  toastBanner: {
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#34D399',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  confirmBoxDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  confirmIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmIconEmoji: {
    fontSize: 22,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  confirmMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  confirmNameBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmNoBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmNoBtnDark: {
    backgroundColor: '#334155',
  },
  confirmNoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  confirmYesBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmYesText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  creditsCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  creditsCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  creditsIconBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  creditsLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  creditsAppTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  creditsVersion: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  creditsDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  creditsDividerDark: {
    backgroundColor: '#334155',
  },
  creditsContentBlock: {
    width: '100%',
    alignItems: 'center',
  },
  creditsAuthorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  creditsAuthorName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  creditsEmailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 16,
  },
  creditsEmailPillDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  creditsEmailIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  creditsEmailText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  creditsQuote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#15803D',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  creditsQuoteDark: {
    color: '#4ADE80',
  },
  creditsCloseBtn: {
    width: '100%',
    backgroundColor: '#15803D',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

interface DirectoryCardProps {
  item: FamilyMember;
  gen: number;
  childrenCount: number;
  isSelected: boolean;
  isDarkMode: boolean;
  onPress: () => void;
}

const DirectoryCard = React.memo<DirectoryCardProps>(
  ({ item, gen, childrenCount, isSelected, isDarkMode, onPress }) => {
    return (
      <TouchableOpacity
        style={[
          styles.listCard,
          isDarkMode && styles.listCardDark,
          isSelected &&
            (isDarkMode ? styles.listCardSelectedDark : styles.listCardSelected),
        ]}
        onPress={onPress}
      >
        <View style={[styles.listAvatar, isDarkMode && styles.listAvatarDark]}>
          <Text style={styles.listAvatarEmoji}>{item.avatar || '🧑'}</Text>
        </View>
        <View style={styles.listInfo}>
          <View style={styles.listTitleRow}>
            <Text style={[styles.listName, isDarkMode && styles.textLight]}>
              {item.name}
            </Text>
            <View
              style={[
                styles.listGenBadge,
                isDarkMode && styles.listGenBadgeDark,
              ]}
            >
              <Text
                style={[
                  styles.listGenBadgeText,
                  isDarkMode && styles.listGenBadgeTextDark,
                ]}
              >
                Gen {gen}
              </Text>
            </View>
          </View>
          <Text style={[styles.listMeta, isDarkMode && styles.textMutedDark]}>
            {item.birthYear
              ? `b. ${item.birthYear}${item.deathYear ? ` – d. ${item.deathYear}` : ''}`
              : 'Years not set'}{' '}
            • {item.parentIds.length} parents • {childrenCount} children
          </Text>
          {item.notes ? (
            <Text
              style={[styles.listNotes, isDarkMode && styles.textSubtleDark]}
              numberOfLines={1}
            >
              {item.notes}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }
);
