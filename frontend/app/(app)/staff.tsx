import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  useWindowDimensions, Modal,
} from 'react-native';
import {
  Search, Plus, Users, Calendar, FileText, X, Trash2,
  Check, ChevronDown, Upload, Download,
  ChevronLeft, ChevronRight, Copy,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useRole } from '@/contexts/RoleContext';
import AccessDenied from '@/components/AccessDenied';
import { formatCurrency } from '@/utils/format';
import type { Employee, EmployeeSchedule, ContractType } from '@/types';
import PageHeader from '@/components/PageHeader';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import StatusBadge from '@/components/StatusBadge';
import DatePickerField from '@/components/DatePickerField';
import AddressFields from '@/components/AddressFields';
import PhoneField from '@/components/PhoneField';
import { useI18n } from '@/contexts/I18nContext';
import UniversalImportModal from '@/components/UniversalImportModal';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';

type StaffTab = 'employees' | 'planning' | 'payroll';

const TAB_KEYS: { key: StaffTab; labelKey: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { key: 'employees', labelKey: 'staff.employees', icon: Users },
  { key: 'planning', labelKey: 'staff.planning', icon: Calendar },
  { key: 'payroll', labelKey: 'staff.payroll', icon: FileText },
];

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'Apprenti', label: 'Apprenti' },
  { value: 'Stage', label: 'Stage' },
  { value: 'Interim', label: 'Intérim' },
  { value: 'Freelance', label: 'Freelance' },
  { value: 'Autre', label: 'Autre' },
];

const DEPARTMENTS = ['Direction', 'Production', 'Ventes', 'Cuisine', 'Service', 'Logistique', 'Administration', 'Marketing', 'IT', 'Autre'];

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export default function StaffScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { canAccess } = useRole();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<StaffTab>('employees');
  const scrollRef = useRef<ScrollView>(null);

  if (!canAccess('staff')) {
    return <AccessDenied />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader title={t('staff.title')} />
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TAB_KEYS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => { setActiveTab(tab.key); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                activeOpacity={0.7}
              >
                <tab.icon size={16} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>{t(tab.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'employees' && <EmployeesSection isMobile={isMobile} />}
        {activeTab === 'planning' && <PlanningSection isMobile={isMobile} />}
        {activeTab === 'payroll' && <PayrollSection />}
      </ScrollView>
    </View>
  );
}

function EmployeesSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { activeEmployees, createEmployee, updateEmployee, deleteEmployee, company } = useData();
  const cur = company.currency || 'EUR';
  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [_formError, setFormError] = useState('');
  const [csvImportVisible, setCsvImportVisible] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', city: '',
    postalCode: '', country: 'France', department: '', position: '',
    contractType: 'CDI' as ContractType, hourlyRate: 0, monthlySalary: 0,
    hireDate: new Date().toISOString(), endDate: undefined as string | undefined,
    socialSecurityNumber: '', notes: '', isActive: true,
  });

  const filtered = useMemo(() => {
    let list = activeEmployees;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [activeEmployees, search]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({
      firstName: '', lastName: '', email: '', phone: '', address: '', city: '',
      postalCode: '', country: 'France', department: '', position: '',
      contractType: 'CDI', hourlyRate: 0, monthlySalary: 0,
      hireDate: new Date().toISOString(), endDate: undefined,
      socialSecurityNumber: '', notes: '', isActive: true,
    });
    setFormError('');
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((id: string) => {
    const e = activeEmployees.find(emp => emp.id === id);
    if (!e) return;
    setEditingId(id);
    setForm({
      firstName: e.firstName, lastName: e.lastName, email: e.email, phone: e.phone,
      address: e.address, city: e.city, postalCode: e.postalCode, country: e.country,
      department: e.department, position: e.position, contractType: e.contractType,
      hourlyRate: e.hourlyRate, monthlySalary: e.monthlySalary,
      hireDate: e.hireDate, endDate: e.endDate,
      socialSecurityNumber: e.socialSecurityNumber, notes: e.notes, isActive: e.isActive,
    });
    setFormError('');
    setFormVisible(true);
  }, [activeEmployees]);

  const handleSubmit = useCallback(() => {
    const result = editingId
      ? updateEmployee(editingId, form)
      : createEmployee(form);
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [form, editingId, createEmployee, updateEmployee]);

  const handleDuplicate = useCallback(() => {
    if (!editingId) return;
    const emp = activeEmployees.find(e => e.id === editingId);
    if (!emp) return;
    const data = { ...form, firstName: form.firstName + ' - Copy' };
    const result = createEmployee(data);
    if (result.success) setFormVisible(false);
  }, [editingId, activeEmployees, form, createEmployee]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteEmployee(deleteConfirm);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteEmployee]);

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showContractPicker, setShowContractPicker] = useState(false);

  return (
    <>
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('staff.searchEmployee')}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <X size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }} onPress={() => setCsvImportVisible(true)}>
          <Upload size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
          onPress={() => {
            const cols: ExportColumn<Record<string, unknown>>[] = [
              { key: 'firstName', label: 'Prénom' },
              { key: 'lastName', label: 'Nom' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Téléphone' },
              { key: 'department', label: 'Service' },
              { key: 'position', label: 'Poste' },
              { key: 'contractType', label: 'Contrat' },
              { key: 'monthlySalary', label: 'Salaire mensuel' },
            ];
            const data = activeEmployees.map(e => ({ ...e } as unknown as Record<string, unknown>));
            void exportToCSV(data, cols, `employes_${new Date().toISOString().slice(0, 10)}.csv`);
          }}
        >
          <Download size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary }} onPress={openCreate}>
          <Plus size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <Users size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            {search ? 'Aucun résultat' : t('staff.noEmployees')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            {search ? 'Essayez un autre terme' : t('staff.addFirst')}
          </Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {!isMobile ? (
            <View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.colHeader, { flex: 2, color: colors.textTertiary }]}>Employé</Text>
              <Text style={[styles.colHeader, { flex: 1.5, color: colors.textTertiary }]}>Service</Text>
              <Text style={[styles.colHeader, { flex: 1, color: colors.textTertiary }]}>Contrat</Text>
              <Text style={[styles.colHeader, { flex: 1, color: colors.textTertiary, textAlign: 'right' as const }]}>Salaire</Text>
            </View>
          ) : null}
          {filtered.map((emp, idx) => (
            <TouchableOpacity
              key={emp.id}
              style={[styles.tableRow, idx < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
              onPress={() => openEdit(emp.id)}
              activeOpacity={0.7}
            >
              <View style={isMobile ? { flex: 1 } : { flex: 2 }}>
                <Text style={[styles.cellText, { color: colors.text, fontWeight: '600' as const }]}>{emp.firstName} {emp.lastName}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{emp.email || emp.phone}</Text>
              </View>
              {!isMobile ? (
                <>
                  <View style={{ flex: 1.5 }}>
                    <Text style={[styles.cellText, { color: colors.text }]}>{emp.department || '—'}</Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary }}>{emp.position || ''}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <StatusBadge status={emp.contractType} />
                  </View>
                  <Text style={[styles.cellText, { flex: 1, color: colors.text, textAlign: 'right' as const, fontWeight: '600' as const }]}>
                    {formatCurrency(emp.monthlySalary, cur)}
                  </Text>
                </>
              ) : (
                <View style={{ alignItems: 'flex-end' as const }}>
                  <StatusBadge status={emp.contractType} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{formatCurrency(emp.monthlySalary, cur)}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingId ? t('staff.editEmployee') : t('staff.newEmployee')}
        onSubmit={handleSubmit}
        headerActions={editingId ? (
          <View style={{ flexDirection: 'row' as const, gap: 8 }}>
            <TouchableOpacity onPress={handleDuplicate} style={{ padding: 6 }}>
              <Copy size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setFormVisible(false); setDeleteConfirm(editingId); }} style={{ padding: 6 }}>
              <Trash2 size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ) : undefined}
      >
        <FormField label={t('staff.firstName')} value={form.firstName} onChangeText={(v) => setForm(p => ({ ...p, firstName: v }))} required />
        <FormField label={t('staff.lastName')} value={form.lastName} onChangeText={(v) => setForm(p => ({ ...p, lastName: v }))} required />
        <FormField label={t('staff.email')} value={form.email} onChangeText={(v) => setForm(p => ({ ...p, email: v }))} />
        <PhoneField value={form.phone} onChangeText={(v: string) => setForm(p => ({ ...p, phone: v }))} />

        <View style={{ marginBottom: 16 }}>
          <Text style={[{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary, marginBottom: 6 }]}>{t('staff.department')}</Text>
          <TouchableOpacity
            style={[styles.pickerBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            onPress={() => setShowDeptPicker(p => !p)}
          >
            <Text style={{ color: form.department ? colors.text : colors.textTertiary, fontSize: 14 }}>
              {form.department || 'Sélectionner un service'}
            </Text>
            <ChevronDown size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          {showDeptPicker ? (
            <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
              {DEPARTMENTS.map(d => (
                <TouchableOpacity key={d} style={[styles.pickerOption, { borderBottomColor: colors.borderLight }]} onPress={() => { setForm(p => ({ ...p, department: d })); setShowDeptPicker(false); }}>
                  <Text style={{ fontSize: 13, color: form.department === d ? colors.primary : colors.text }}>{d}</Text>
                  {form.department === d ? <Check size={14} color={colors.primary} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <FormField label={t('staff.position')} value={form.position} onChangeText={(v) => setForm(p => ({ ...p, position: v }))} />

        <View style={{ marginBottom: 16 }}>
          <Text style={[{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary, marginBottom: 6 }]}>{t('staff.contractType')}</Text>
          <TouchableOpacity
            style={[styles.pickerBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            onPress={() => setShowContractPicker(p => !p)}
          >
            <Text style={{ color: colors.text, fontSize: 14 }}>{form.contractType}</Text>
            <ChevronDown size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          {showContractPicker ? (
            <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
              {CONTRACT_TYPES.map(ct => (
                <TouchableOpacity key={ct.value} style={[styles.pickerOption, { borderBottomColor: colors.borderLight }]} onPress={() => { setForm(p => ({ ...p, contractType: ct.value })); setShowContractPicker(false); }}>
                  <Text style={{ fontSize: 13, color: form.contractType === ct.value ? colors.primary : colors.text }}>{ct.label}</Text>
                  {form.contractType === ct.value ? <Check size={14} color={colors.primary} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <FormField label={t('staff.hourlyRate')} value={form.hourlyRate > 0 ? String(form.hourlyRate) : ''} onChangeText={(v) => setForm(p => ({ ...p, hourlyRate: parseFloat(v.replace(/,/g, '.')) || 0 }))} keyboardType="decimal-pad" />
        <FormField label={t('staff.monthlySalary')} value={form.monthlySalary > 0 ? String(form.monthlySalary) : ''} onChangeText={(v) => setForm(p => ({ ...p, monthlySalary: parseFloat(v.replace(/,/g, '.')) || 0 }))} keyboardType="decimal-pad" />

        <DatePickerField label={t('staff.hireDate')} value={form.hireDate} onChange={(v) => setForm(p => ({ ...p, hireDate: v }))} />

        <AddressFields
          address={form.address}
          city={form.city}
          postalCode={form.postalCode}
          country={form.country}
          onAddressChange={(v: string) => setForm(p => ({ ...p, address: v }))}
          onCityChange={(v: string) => setForm(p => ({ ...p, city: v }))}
          onPostalCodeChange={(v: string) => setForm(p => ({ ...p, postalCode: v }))}
          onCountryChange={(v: string) => setForm(p => ({ ...p, country: v }))}
        />

        <FormField label={t('staff.ssn')} value={form.socialSecurityNumber} onChangeText={(v) => setForm(p => ({ ...p, socialSecurityNumber: v }))} />
        <FormField label={t('staff.notes')} value={form.notes} onChangeText={(v) => setForm(p => ({ ...p, notes: v }))} multiline numberOfLines={3} />
      </FormModal>

      <ConfirmModal
        visible={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t('staff.deleteEmployee')}
        message={t('staff.deleteEmployeeMsg')}
        onConfirm={handleDelete}
        confirmLabel="Supprimer"
        destructive
      />

      <UniversalImportModal
        visible={csvImportVisible}
        onClose={() => setCsvImportVisible(false)}
        title="Importer des employés"
        entityLabel="employé"
        fields={[
          { key: 'firstName', label: 'Prénom', required: true },
          { key: 'lastName', label: 'Nom', required: true },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Téléphone' },
          { key: 'department', label: 'Service' },
          { key: 'position', label: 'Poste' },
          { key: 'contractType', label: 'Contrat' },
          { key: 'monthlySalary', label: 'Salaire mensuel' },
        ]}
        onImport={(rows) => {
          let count = 0;
          const errors: string[] = [];
          rows.forEach((row: Record<string, string>) => {
            const data = {
              firstName: row['Prénom'] || row['firstName'] || '',
              lastName: row['Nom'] || row['lastName'] || '',
              email: row['Email'] || row['email'] || '',
              phone: row['Téléphone'] || row['phone'] || '',
              address: '', city: '', postalCode: '', country: 'France',
              department: row['Service'] || row['department'] || '',
              position: row['Poste'] || row['position'] || '',
              contractType: (row['Contrat'] || row['contractType'] || 'CDI') as ContractType,
              hourlyRate: parseFloat(row['Taux horaire'] || '0') || 0,
              monthlySalary: parseFloat(row['Salaire'] || row['monthlySalary'] || '0') || 0,
              hireDate: new Date().toISOString(),
              endDate: undefined,
              socialSecurityNumber: '',
              notes: '',
              isActive: true,
            };
            if (data.firstName && data.lastName) {
              createEmployee(data);
              count++;
            } else {
              errors.push('Prénom et nom requis');
            }
          });
          return { imported: count, errors };
        }}
      />
    </>
  );
}

function PlanningSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { activeEmployees, schedules, upsertSchedule } = useData();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [editingSchedule, setEditingSchedule] = useState<{ employeeId: string; dayOfWeek: number } | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    plannedStart: '', plannedEnd: '', plannedHours: 0,
    actualStart: '', actualEnd: '', actualHours: 0,
    notes: '',
  });

  const weekSchedules = useMemo(() => {
    return schedules.filter(s => s.weekStart === currentWeekStart);
  }, [schedules, currentWeekStart]);

  const getScheduleFor = useCallback((employeeId: string, dayOfWeek: number) => {
    return weekSchedules.find(s => s.employeeId === employeeId && s.dayOfWeek === dayOfWeek);
  }, [weekSchedules]);

  const prevWeek = useCallback(() => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d.toISOString().slice(0, 10));
  }, [currentWeekStart]);

  const nextWeek = useCallback(() => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d.toISOString().slice(0, 10));
  }, [currentWeekStart]);

  const openScheduleEdit = useCallback((employeeId: string, dayOfWeek: number) => {
    const existing = getScheduleFor(employeeId, dayOfWeek);
    setEditingSchedule({ employeeId, dayOfWeek });
    setScheduleForm({
      plannedStart: existing?.plannedStart || '',
      plannedEnd: existing?.plannedEnd || '',
      plannedHours: existing?.plannedHours || 0,
      actualStart: existing?.actualStart || '',
      actualEnd: existing?.actualEnd || '',
      actualHours: existing?.actualHours || 0,
      notes: existing?.notes || '',
    });
  }, [getScheduleFor]);

  const saveScheduleEdit = useCallback(() => {
    if (!editingSchedule) return;
    const existing = getScheduleFor(editingSchedule.employeeId, editingSchedule.dayOfWeek);
    const now = new Date().toISOString();
    const schedule: EmployeeSchedule = {
      id: existing?.id || generateId('sch'),
      companyId: '',
      employeeId: editingSchedule.employeeId,
      weekStart: currentWeekStart,
      dayOfWeek: editingSchedule.dayOfWeek,
      plannedStart: scheduleForm.plannedStart || undefined,
      plannedEnd: scheduleForm.plannedEnd || undefined,
      plannedHours: scheduleForm.plannedHours,
      actualStart: scheduleForm.actualStart || undefined,
      actualEnd: scheduleForm.actualEnd || undefined,
      actualHours: scheduleForm.actualHours,
      notes: scheduleForm.notes,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    upsertSchedule(schedule);
    setEditingSchedule(null);
  }, [editingSchedule, scheduleForm, currentWeekStart, getScheduleFor, upsertSchedule]);

  const getEmployeeTotals = useCallback((employeeId: string) => {
    const empSchedules = weekSchedules.filter(s => s.employeeId === employeeId);
    const planned = empSchedules.reduce((s, sc) => s + sc.plannedHours, 0);
    const actual = empSchedules.reduce((s, sc) => s + sc.actualHours, 0);
    return { planned, actual };
  }, [weekSchedules]);

  const weekLabel = useMemo(() => {
    const d = new Date(currentWeekStart);
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }, [currentWeekStart]);

  return (
    <>
      <View style={[styles.weekNav, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={prevWeek} style={styles.weekNavBtn}>
          <ChevronLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' as const }}>
          <Text style={[styles.weekLabel, { color: colors.text }]}>{weekLabel}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Semaine du {new Date(currentWeekStart).toLocaleDateString('fr-FR')}</Text>
        </View>
        <TouchableOpacity onPress={nextWeek} style={styles.weekNavBtn}>
          <ChevronRight size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {activeEmployees.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{t('staff.noEmployees')}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>{t('staff.addFirst')}</Text>
        </View>
      ) : (
        <ScrollView horizontal={isMobile} showsHorizontalScrollIndicator={false}>
          <View style={[styles.planningTable, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.planningHeaderRow, { borderBottomColor: colors.border }]}>
              <View style={styles.planningNameCol}>
                <Text style={[styles.planningHeaderText, { color: colors.textTertiary }]}>Employé</Text>
              </View>
              {DAY_LABELS.map((day, idx) => (
                <View key={idx} style={styles.planningDayCol}>
                  <Text style={[styles.planningHeaderText, { color: colors.textTertiary }]}>{day}</Text>
                </View>
              ))}
              <View style={styles.planningTotalCol}>
                <Text style={[styles.planningHeaderText, { color: colors.textTertiary }]}>Total</Text>
              </View>
            </View>

            {activeEmployees.map(emp => {
              const totals = getEmployeeTotals(emp.id);
              return (
                <View key={emp.id} style={[styles.planningRow, { borderBottomColor: colors.borderLight }]}>
                  <View style={styles.planningNameCol}>
                    <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.text }} numberOfLines={1}>
                      {emp.firstName} {emp.lastName.charAt(0)}.
                    </Text>
                  </View>
                  {DAY_LABELS.map((_day, idx) => {
                    const schedule = getScheduleFor(emp.id, idx);
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.planningCell, { borderColor: colors.borderLight, backgroundColor: schedule ? (schedule.actualHours > 0 ? colors.successLight : colors.primaryLight) : 'transparent' }]}
                        onPress={() => openScheduleEdit(emp.id, idx)}
                        activeOpacity={0.7}
                      >
                        {schedule ? (
                          <>
                            <Text style={{ fontSize: 11, fontWeight: '600' as const, color: colors.primary }}>{schedule.plannedHours}h</Text>
                            {schedule.actualHours > 0 ? (
                              <Text style={{ fontSize: 10, color: colors.success }}>{schedule.actualHours}h</Text>
                            ) : null}
                          </>
                        ) : (
                          <Text style={{ fontSize: 18, color: colors.textTertiary }}>+</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  <View style={styles.planningTotalCol}>
                    <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.primary }}>{totals.planned}h</Text>
                    <Text style={{ fontSize: 11, color: colors.success }}>{totals.actual}h</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <View style={[styles.legendRow, { marginTop: 12 }]}>
        <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
          <View style={[styles.legendDot, { backgroundColor: colors.primaryLight }]} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('staff.planned')}</Text>
        </View>
        <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
          <View style={[styles.legendDot, { backgroundColor: colors.successLight }]} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('staff.actual')}</Text>
        </View>
      </View>

      <Modal visible={!!editingSchedule} transparent animationType="fade" onRequestClose={() => setEditingSchedule(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingSchedule ? `${activeEmployees.find(e => e.id === editingSchedule.employeeId)?.firstName || ''} — ${DAY_LABELS[editingSchedule.dayOfWeek]}` : ''}
              </Text>
              <TouchableOpacity onPress={() => setEditingSchedule(null)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.primary }]}>{t('staff.planned')}</Text>
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Début</Text>
                <TextInput style={[styles.timeInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={scheduleForm.plannedStart} onChangeText={v => setScheduleForm(p => ({ ...p, plannedStart: v }))} placeholder="08:00" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Fin</Text>
                <TextInput style={[styles.timeInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={scheduleForm.plannedEnd} onChangeText={v => setScheduleForm(p => ({ ...p, plannedEnd: v }))} placeholder="17:00" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Heures</Text>
                <TextInput style={[styles.timeInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={scheduleForm.plannedHours > 0 ? String(scheduleForm.plannedHours) : ''} onChangeText={v => setScheduleForm(p => ({ ...p, plannedHours: parseFloat(v) || 0 }))} placeholder="8" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.success, marginTop: 16 }]}>{t('staff.actual')}</Text>
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Début</Text>
                <TextInput style={[styles.timeInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={scheduleForm.actualStart} onChangeText={v => setScheduleForm(p => ({ ...p, actualStart: v }))} placeholder="08:15" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Fin</Text>
                <TextInput style={[styles.timeInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={scheduleForm.actualEnd} onChangeText={v => setScheduleForm(p => ({ ...p, actualEnd: v }))} placeholder="17:30" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Heures</Text>
                <TextInput style={[styles.timeInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={scheduleForm.actualHours > 0 ? String(scheduleForm.actualHours) : ''} onChangeText={v => setScheduleForm(p => ({ ...p, actualHours: parseFloat(v) || 0 }))} placeholder="8.5" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 20 }]} onPress={saveScheduleEdit} activeOpacity={0.8}>
              <Check size={16} color="#FFF" />
              <Text style={styles.saveBtnText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function PayrollSection({ _isMobile }: { _isMobile?: boolean }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { activeEmployees, schedules, payslips, createPayslip, updatePayslip, company } = useData();
  const cur = company.currency || 'EUR';

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthPayslips = useMemo(() => {
    return payslips.filter(p => p.periodStart.startsWith(selectedMonth));
  }, [payslips, selectedMonth]);

  const getEmployeeMonthlyHours = useCallback((employeeId: string) => {
    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]) - 1;
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const relevant = schedules.filter(s => {
      const ws = new Date(s.weekStart);
      return s.employeeId === employeeId && ws >= monthStart && ws <= monthEnd;
    });

    const planned = relevant.reduce((sum, s) => sum + s.plannedHours, 0);
    const actual = relevant.reduce((sum, s) => sum + s.actualHours, 0);
    return { planned, actual };
  }, [schedules, selectedMonth]);

  const generatePayslipForEmployee = useCallback((emp: Employee) => {
    const hours = getEmployeeMonthlyHours(emp.id);
    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]) - 1;
    const periodStart = new Date(year, month, 1).toISOString().slice(0, 10);
    const periodEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    const existing = monthPayslips.find(p => p.employeeId === emp.id);
    if (existing) return;

    const overtime = Math.max(0, hours.actual - hours.planned);
    const grossSalary = emp.hourlyRate > 0 ? emp.hourlyRate * hours.actual + overtime * emp.hourlyRate * 0.25 : emp.monthlySalary;
    const deductions = grossSalary * 0.23;
    const netSalary = grossSalary - deductions;

    createPayslip({
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      periodStart,
      periodEnd,
      plannedHours: hours.planned,
      actualHours: hours.actual,
      overtimeHours: overtime,
      hourlyRate: emp.hourlyRate,
      grossSalary: Math.round(grossSalary * 100) / 100,
      deductions: Math.round(deductions * 100) / 100,
      netSalary: Math.round(netSalary * 100) / 100,
      status: 'draft',
      notes: '',
    });
  }, [selectedMonth, getEmployeeMonthlyHours, monthPayslips, createPayslip]);

  const handleValidate = useCallback((id: string) => {
    updatePayslip(id, { status: 'validated', validatedAt: new Date().toISOString() });
  }, [updatePayslip]);

  const handleMarkPaid = useCallback((id: string) => {
    updatePayslip(id, { status: 'paid', paidAt: new Date().toISOString() });
  }, [updatePayslip]);

  const prevMonth = useCallback(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }, [selectedMonth]);

  const nextMonth = useCallback(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }, [selectedMonth]);

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  return (
    <>
      <View style={[styles.weekNav, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={prevMonth} style={styles.weekNavBtn}>
          <ChevronLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.weekLabel, { color: colors.text, textTransform: 'capitalize' as const }]}>{monthLabel}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.weekNavBtn}>
          <ChevronRight size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={{ gap: 12 }}>
        {activeEmployees.map(emp => {
          const payslip = monthPayslips.find(p => p.employeeId === emp.id);
          const hours = getEmployeeMonthlyHours(emp.id);

          return (
            <View key={emp.id} style={[styles.payrollCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.payrollHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.payrollName, { color: colors.text }]}>{emp.firstName} {emp.lastName}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{emp.department} — {emp.contractType}</Text>
                </View>
                {payslip ? (
                  <StatusBadge status={payslip.status === 'draft' ? t('staff.payslipDraft') : payslip.status === 'validated' ? t('staff.payslipValidated') : t('staff.payslipPaid')} />
                ) : null}
              </View>

              <View style={styles.payrollStats}>
                <View style={styles.payrollStat}>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{t('staff.totalPlanned')}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.text }}>{payslip?.plannedHours ?? hours.planned}h</Text>
                </View>
                <View style={styles.payrollStat}>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{t('staff.totalActual')}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.text }}>{payslip?.actualHours ?? hours.actual}h</Text>
                </View>
                {payslip ? (
                  <>
                    <View style={styles.payrollStat}>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>{t('staff.grossSalary')}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.text }}>{formatCurrency(payslip.grossSalary, cur)}</Text>
                    </View>
                    <View style={styles.payrollStat}>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>{t('staff.netSalary')}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700' as const, color: colors.primary }}>{formatCurrency(payslip.netSalary, cur)}</Text>
                    </View>
                  </>
                ) : null}
              </View>

              <View style={styles.payrollActions}>
                {!payslip ? (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => generatePayslipForEmployee(emp)} activeOpacity={0.8}>
                    <FileText size={14} color="#FFF" />
                    <Text style={styles.actionBtnText}>{t('staff.generatePayslip')}</Text>
                  </TouchableOpacity>
                ) : payslip.status === 'draft' ? (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => handleValidate(payslip.id)} activeOpacity={0.8}>
                    <Check size={14} color="#FFF" />
                    <Text style={styles.actionBtnText}>{t('staff.validatePayslip')}</Text>
                  </TouchableOpacity>
                ) : payslip.status === 'validated' ? (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#059669' }]} onPress={() => handleMarkPaid(payslip.id)} activeOpacity={0.8}>
                    <Check size={14} color="#FFF" />
                    <Text style={styles.actionBtnText}>{t('staff.markPaid')}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.actionBtn, { backgroundColor: colors.successLight }]}>
                    <Check size={14} color={colors.success} />
                    <Text style={[styles.actionBtnText, { color: colors.success }]}>{t('staff.payslipPaid')}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {activeEmployees.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{t('staff.noPayslips')}</Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBarWrapper: { borderBottomWidth: 1 },
  tabBar: { flexDirection: 'row' as const, paddingHorizontal: 16, gap: 4 },
  tab: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingVertical: 12, paddingHorizontal: 14 },
  tabText: { fontSize: 13, fontWeight: '600' as const },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  searchRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 16, alignItems: 'center' as const },
  searchBar: { flexDirection: 'row' as const, alignItems: 'center' as const, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, height: '100%' as const },
  emptyState: { alignItems: 'center' as const, paddingVertical: 40, gap: 8 },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600' as const },
  emptySubtitle: { fontSize: 13 },
  tableCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' as const },
  headerRow: { flexDirection: 'row' as const, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' as const },
  colHeader: { fontSize: 12, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row' as const, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' as const },
  cellText: { fontSize: 14 },
  pickerBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  pickerDropdown: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' as const },
  pickerOption: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  weekNav: { flexDirection: 'row' as const, alignItems: 'center' as const, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  weekNavBtn: { padding: 8 },
  weekLabel: { fontSize: 15, fontWeight: '700' as const },
  planningTable: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' as const, minWidth: 700 },
  planningHeaderRow: { flexDirection: 'row' as const, borderBottomWidth: 1, paddingVertical: 10 },
  planningHeaderText: { fontSize: 12, fontWeight: '600' as const, textAlign: 'center' as const },
  planningNameCol: { width: 130, paddingHorizontal: 12, justifyContent: 'center' as const },
  planningDayCol: { width: 70, alignItems: 'center' as const, justifyContent: 'center' as const },
  planningTotalCol: { width: 70, alignItems: 'center' as const, justifyContent: 'center' as const },
  planningRow: { flexDirection: 'row' as const, borderBottomWidth: 1, minHeight: 56, alignItems: 'center' as const },
  planningCell: { width: 70, height: 48, borderRadius: 8, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const, marginHorizontal: 2 },
  legendRow: { flexDirection: 'row' as const, gap: 16 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, alignItems: 'center' as const },
  modalContent: { width: '90%' as const, maxWidth: 440, borderRadius: 16, borderWidth: 1, padding: 24 },
  modalHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700' as const },
  sectionLabel: { fontSize: 13, fontWeight: '700' as const, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  timeRow: { flexDirection: 'row' as const, gap: 10 },
  timeInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textAlign: 'center' as const },
  saveBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, paddingVertical: 14, borderRadius: 10 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },
  payrollCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  payrollHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 12 },
  payrollName: { fontSize: 15, fontWeight: '700' as const },
  payrollStats: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12, marginBottom: 12 },
  payrollStat: { minWidth: 80 },
  payrollActions: { flexDirection: 'row' as const, gap: 8 },
  actionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  actionBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
});
