import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

export default function AdminReportsScreen({ onBack }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const res = await api.getDailyReports();
      if (res.success && res.data) {
        setReports(res.data);
      }
    } catch (e) {
      console.warn('[AdminReports] Error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Daily Task Reports</Text>
          <Text style={styles.headerSubtitle}>{reports.length} Reports Submitted</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadReports}>
          <Ionicons name="refresh" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching daily task summaries...</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Daily Reports</Text>
          <Text style={styles.emptySubtitle}>Daily task summaries filed by employees will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.userName}>{item.user_name || 'Employee'}</Text>
                  <Text style={styles.projectText}>
                    Project: <Text style={styles.projectValue}>{item.project_name || 'General Operations'}</Text>
                  </Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreVal}>{item.rating_average_overall || '8.5'}</Text>
                  <Text style={styles.scoreMax}>/10</Text>
                </View>
              </View>

              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.dateText}>{item.work_date}</Text>
                <Text style={styles.dotSeparator}>&bull;</Text>
                <Text style={styles.statusCompleted}>
                  Completed: {item.tasks_completed || 'Yes'}
                </Text>
              </View>

              {item.work_summary && (
                <Text style={styles.summaryText}>{item.work_summary}</Text>
              )}

              {/* 6-Factor Rating Breakdown */}
              <View style={styles.ratingGrid}>
                {[
                  { label: 'Speed', val: item.rating_speed || 8 },
                  { label: 'Understanding', val: item.rating_understanding || 9 },
                  { label: 'Problem Solving', val: item.rating_problem_solving || 8 },
                  { label: 'Talking / Comm', val: item.rating_talking_behaviour || 9 },
                  { label: 'Work Quality', val: item.rating_work_quality || 9 },
                  { label: 'Discipline', val: item.rating_discipline || 9 }
                ].map((factor, i) => (
                  <View key={i} style={styles.ratingChip}>
                    <Text style={styles.ratingChipLabel}>{factor.label}</Text>
                    <Text style={styles.ratingChipVal}>{factor.val}/10</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const getStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    backBtn: {
      padding: 6,
      marginRight: 8
    },
    headerTitleWrap: {
      flex: 1
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary
    },
    refreshBtn: {
      padding: 6
    },
    listContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 40
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30
    },
    loadingText: {
      marginTop: 10,
      fontSize: 12,
      color: colors.textSecondary
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 12
    },
    emptySubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    },
    userName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary
    },
    projectText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2
    },
    projectValue: {
      color: colors.primary,
      fontWeight: '600'
    },
    scoreBadge: {
      flexDirection: 'row',
      alignItems: 'baseline',
      backgroundColor: isDark ? '#1a2218' : '#f0f5ee',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8
    },
    scoreVal: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary
    },
    scoreMax: {
      fontSize: 10,
      color: colors.textSecondary
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      marginBottom: 8
    },
    dateText: {
      fontSize: 11,
      color: colors.textSecondary
    },
    dotSeparator: {
      color: colors.textSecondary
    },
    statusCompleted: {
      fontSize: 11,
      fontWeight: '600',
      color: '#10b981'
    },
    summaryText: {
      fontSize: 12,
      color: colors.textPrimary,
      lineHeight: 18,
      marginBottom: 10
    },
    ratingGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      backgroundColor: isDark ? '#1a2218' : '#f7faf5',
      padding: 10,
      borderRadius: 10
    },
    ratingChip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '48%',
      paddingVertical: 2
    },
    ratingChipLabel: {
      fontSize: 10,
      color: colors.textSecondary
    },
    ratingChipVal: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textPrimary
    }
  });
