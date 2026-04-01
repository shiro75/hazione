/**
 * @fileoverview Barrel export for all shared UI components.
 * Import from '@/components/shared' to use any shared component.
 */

export { default as SharedPageHeader } from '@/components/PageHeader';
export { default as SharedTabBar } from '@/components/SectionTabBar';
export { default as DataTable } from './DataTable';
export { default as SharedFormField, SelectField as SharedSelectField } from '@/components/FormField';
export { default as FormSection } from './FormSection';
export { default as SharedStatusBadge } from '@/components/StatusBadge';
export { default as SharedEmptyState } from '@/components/EmptyState';
export { default as SharedConfirmModal } from '@/components/ConfirmModal';
export { default as StatCard } from './StatCard';
export { default as SearchFilterBar } from './SearchFilterBar';
export { default as PriceDisplay } from './PriceDisplay';
export { default as QuantitySelector } from './QuantitySelector';
export { default as LoadingScreen } from './LoadingScreen';
export { default as ErrorScreen } from './ErrorScreen';
