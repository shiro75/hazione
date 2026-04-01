/**
 * @fileoverview Audit trail service for tracking all critical business actions.
 * Creates immutable log entries for invoice validation, payments, deletions, etc.
 * Required for French accounting compliance (anti-fraud regulations).
 */

import type { AuditLog, AuditActionType, AuditEntityType } from '@/types';

let auditStore: AuditLog[] = [];

export function createAuditEntry(
  companyId: string,
  userId: string,
  userName: string,
  action: AuditActionType,
  entityType: AuditEntityType,
  entityId: string,
  entityLabel: string,
  details: string,
  previousValue?: string,
  newValue?: string
): AuditLog {
  const entry: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    companyId,
    userId,
    userName,
    action,
    entityType,
    entityId,
    entityLabel,
    details,
    previousValue,
    newValue,
    timestamp: new Date().toISOString(),
  };
  auditStore = [entry, ...auditStore];
  return entry;
}

export function getAuditLogs(companyId: string, filters?: {
  entityType?: AuditEntityType;
  action?: AuditActionType;
  userId?: string;
  from?: string;
  to?: string;
}): AuditLog[] {
  let logs = auditStore.filter((l) => l.companyId === companyId);

  if (filters?.entityType) {
    logs = logs.filter((l) => l.entityType === filters.entityType);
  }
  if (filters?.action) {
    logs = logs.filter((l) => l.action === filters.action);
  }
  if (filters?.userId) {
    logs = logs.filter((l) => l.userId === filters.userId);
  }
  if (filters?.from) {
    logs = logs.filter((l) => l.timestamp >= filters.from!);
  }
  if (filters?.to) {
    logs = logs.filter((l) => l.timestamp <= filters.to!);
  }

  return logs;
}

export function initializeAuditStore(logs: AuditLog[]): void {
  auditStore = [...logs, ...auditStore];
}

export function getActionLabel(action: AuditActionType): string {
  const labels: Record<AuditActionType, string> = {
    create: 'Création',
    update: 'Modification',
    delete: 'Suppression',
    validate: 'Validation',
    cancel: 'Annulation',
    send: 'Envoi',
    payment: 'Paiement',
    convert: 'Conversion',
    lock: 'Verrouillage',
    refund: 'Remboursement',
  };
  return labels[action] || action;
}

export function getEntityLabel(entityType: AuditEntityType): string {
  const labels: Record<AuditEntityType, string> = {
    invoice: 'Facture',
    order: 'Commande',
    quote: 'Devis',
    credit_note: 'Avoir',
    client: 'Client',
    product: 'Produit',
    payment: 'Paiement',
    user: 'Utilisateur',
    company: 'Entreprise',
    expense: 'Dépense',
    sale: 'Vente',
    supplier: 'Fournisseur',
    purchase_order: 'Commande fournisseur',
    supplier_invoice: 'Facture reçue',
    stock_movement: 'Mouvement stock',
    reminder: 'Relance',
  };
  return labels[entityType] || entityType;
}
