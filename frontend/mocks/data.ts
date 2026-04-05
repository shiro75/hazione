/**
 * @fileoverview Mock/seed data used as fallback when Supabase is not configured
 * or when the user has not yet created real data. Provides realistic French
 * business entities (company, clients, products, invoices, quotes, etc.).
 */
import { Company, User, Product, Client, Order, Invoice, Payment, DashboardStats, MonthlyRevenue, Quote, CreditNote, Expense, CashMovement, AuditLog, ReminderLog, Sale } from '@/types';

export const mockCompany: Company = {
  id: 'comp_001',
  name: 'Dupont Solutions',
  legalStructure: 'SAS',
  siret: '123 456 789 00012',
  vatNumber: 'FR12345678901',
  address: '42 Rue de la République',
  city: 'Lyon',
  postalCode: '69002',
  country: 'France',
  phone: '+33 4 72 00 00 00',
  email: 'contact@dupont-solutions.fr',
  website: 'www.dupont-solutions.fr',
  iban: 'FR76 3000 6000 0112 3456 7890 189',
  bic: 'AGRIFRPP',
  defaultVatRate: 20,
  paymentTermsDays: 30,
  invoicePrefix: 'FAC',
  invoiceNextNumber: 2025047,
  quotePrefix: 'DEV',
  quoteNextNumber: 2025019,
  creditNotePrefix: 'AV',
  creditNoteNextNumber: 2025003,
  purchaseOrderPrefix: 'CF',
  purchaseOrderNextNumber: 1,
  supplierInvoicePrefix: 'FR',
  supplierInvoiceNextNumber: 1,
  vatExempt: false,
  reminderEnabled: true,
  reminderDays: [7, 14, 30],
  lateFeeRate: 3.75,
  electronicInvoicingReady: true,
  currency: 'EUR',
  createdAt: '2023-01-15T10:00:00Z',
};

export const mockUsers: User[] = [
  { id: 'usr_001', companyId: 'comp_001', email: 'pierre.dupont@dupont-solutions.fr', firstName: 'Pierre', lastName: 'Dupont', role: 'admin', isActive: true, lastLoginAt: '2025-02-20T09:30:00Z', createdAt: '2023-01-15T10:00:00Z' },
  { id: 'usr_002', companyId: 'comp_001', email: 'marie.laurent@dupont-solutions.fr', firstName: 'Marie', lastName: 'Laurent', role: 'manager', isActive: true, lastLoginAt: '2025-02-19T14:20:00Z', createdAt: '2023-03-01T09:00:00Z' },
  { id: 'usr_003', companyId: 'comp_001', email: 'julien.moreau@dupont-solutions.fr', firstName: 'Julien', lastName: 'Moreau', role: 'employee', isActive: true, lastLoginAt: '2025-02-20T08:00:00Z', createdAt: '2023-06-15T09:00:00Z' },
  { id: 'usr_004', companyId: 'comp_001', email: 'sophie.bernard@cabinet-bernard.fr', firstName: 'Sophie', lastName: 'Bernard', role: 'accountant', isActive: true, lastLoginAt: '2025-02-18T16:00:00Z', createdAt: '2024-01-10T09:00:00Z' },
];

export const mockProducts: Product[] = [
  { id: 'prod_001', companyId: 'comp_001', name: 'Licence Logiciel Pro', description: 'Licence annuelle logiciel de gestion', sku: 'SOFT-PRO-001', purchasePrice: 120, salePrice: 299, vatRate: 20, stockQuantity: 999, lowStockThreshold: 10, unit: 'licence', type: 'service', isActive: true, isArchived: false, usedInValidatedInvoice: true, createdAt: '2023-02-01T10:00:00Z', updatedAt: '2023-02-01T10:00:00Z' },
  { id: 'prod_002', companyId: 'comp_001', name: 'Formation Management', description: 'Session de formation management 2 jours', sku: 'FORM-MAN-001', purchasePrice: 400, salePrice: 1200, vatRate: 20, stockQuantity: 50, lowStockThreshold: 5, unit: 'session', type: 'service', isActive: true, isArchived: false, usedInValidatedInvoice: true, createdAt: '2023-02-15T10:00:00Z', updatedAt: '2023-02-15T10:00:00Z' },
  { id: 'prod_003', companyId: 'comp_001', name: 'Audit Conformité RGPD', description: 'Audit complet de conformité RGPD', sku: 'AUD-RGPD-001', purchasePrice: 800, salePrice: 2500, vatRate: 20, stockQuantity: 30, lowStockThreshold: 3, unit: 'audit', type: 'service', isActive: true, isArchived: false, usedInValidatedInvoice: true, createdAt: '2023-03-01T10:00:00Z', updatedAt: '2023-03-01T10:00:00Z' },
  { id: 'prod_004', companyId: 'comp_001', name: 'Support Technique Premium', description: 'Support technique prioritaire mensuel', sku: 'SUP-PREM-001', purchasePrice: 50, salePrice: 149, vatRate: 20, stockQuantity: 200, lowStockThreshold: 20, unit: 'mois', type: 'service', isActive: true, isArchived: false, usedInValidatedInvoice: true, createdAt: '2023-03-15T10:00:00Z', updatedAt: '2023-03-15T10:00:00Z' },
  { id: 'prod_005', companyId: 'comp_001', name: 'Pack Démarrage PME', description: 'Pack complet pour les PME', sku: 'PACK-PME-001', purchasePrice: 1500, salePrice: 3990, vatRate: 20, stockQuantity: 15, lowStockThreshold: 3, unit: 'pack', type: 'produit_fini', isActive: true, isArchived: false, usedInValidatedInvoice: true, createdAt: '2023-04-01T10:00:00Z', updatedAt: '2023-04-01T10:00:00Z' },
  { id: 'prod_006', companyId: 'comp_001', name: 'Consultation Stratégique', description: 'Demi-journée de consultation', sku: 'CONS-STRAT-001', purchasePrice: 200, salePrice: 650, vatRate: 20, stockQuantity: 100, lowStockThreshold: 10, unit: 'demi-journée', type: 'service', isActive: true, isArchived: false, usedInValidatedInvoice: true, createdAt: '2023-05-01T10:00:00Z', updatedAt: '2023-05-01T10:00:00Z' },
  { id: 'prod_007', companyId: 'comp_001', name: 'Hébergement Cloud', description: 'Hébergement cloud sécurisé mensuel', sku: 'HOST-CLOUD-001', purchasePrice: 25, salePrice: 89, vatRate: 20, stockQuantity: 500, lowStockThreshold: 50, unit: 'mois', type: 'service', isActive: true, isArchived: false, usedInValidatedInvoice: false, createdAt: '2023-06-01T10:00:00Z', updatedAt: '2023-06-01T10:00:00Z' },
  { id: 'prod_008', companyId: 'comp_001', name: 'Migration Données', description: 'Service de migration de données', sku: 'MIG-DATA-001', purchasePrice: 600, salePrice: 1800, vatRate: 20, stockQuantity: 25, lowStockThreshold: 5, unit: 'projet', type: 'service', isActive: true, isArchived: false, usedInValidatedInvoice: false, createdAt: '2023-07-01T10:00:00Z', updatedAt: '2023-07-01T10:00:00Z' },
];

export const mockClients: Client[] = [
  { id: 'cli_001', companyId: 'comp_001', type: 'company', companyName: 'TechVision SAS', firstName: 'Thomas', lastName: 'Martin', email: 'thomas.martin@techvision.fr', phone: '+33 1 42 00 00 01', address: '15 Avenue des Champs-Élysées', city: 'Paris', postalCode: '75008', country: 'France', vatNumber: 'FR98765432101', notes: 'Client prioritaire', totalOrders: 12, totalRevenue: 45800, marginTotal: 28400, isDeleted: false, createdAt: '2023-02-01T10:00:00Z', updatedAt: '2023-02-01T10:00:00Z' },
  { id: 'cli_002', companyId: 'comp_001', type: 'company', companyName: 'Innovatech SARL', firstName: 'Claire', lastName: 'Dubois', email: 'claire.dubois@innovatech.fr', phone: '+33 4 78 00 00 02', address: '8 Rue Garibaldi', city: 'Lyon', postalCode: '69003', country: 'France', vatNumber: 'FR45678901234', notes: '', totalOrders: 8, totalRevenue: 32400, marginTotal: 19800, isDeleted: false, createdAt: '2023-03-15T10:00:00Z', updatedAt: '2023-03-15T10:00:00Z' },
  { id: 'cli_003', companyId: 'comp_001', type: 'company', companyName: 'GreenEnergy SA', firstName: 'Antoine', lastName: 'Leroy', email: 'a.leroy@greenenergy.fr', phone: '+33 5 56 00 00 03', address: '22 Cours de l\'Intendance', city: 'Bordeaux', postalCode: '33000', country: 'France', vatNumber: 'FR11223344556', notes: 'Prospect converti en mars 2024', totalOrders: 5, totalRevenue: 18900, marginTotal: 11200, isDeleted: false, createdAt: '2024-03-01T10:00:00Z', updatedAt: '2024-03-01T10:00:00Z' },
  { id: 'cli_004', companyId: 'comp_001', type: 'individual', firstName: 'Sophie', lastName: 'Petit', email: 'sophie.petit@gmail.com', phone: '+33 6 12 34 56 78', address: '5 Place Bellecour', city: 'Lyon', postalCode: '69002', country: 'France', notes: 'Auto-entrepreneur, consultante', totalOrders: 3, totalRevenue: 4470, marginTotal: 2680, isDeleted: false, createdAt: '2024-06-01T10:00:00Z', updatedAt: '2024-06-01T10:00:00Z' },
  { id: 'cli_005', companyId: 'comp_001', type: 'company', companyName: 'DataFlow SAS', firstName: 'Lucas', lastName: 'Roux', email: 'lucas.roux@dataflow.fr', phone: '+33 1 45 00 00 05', address: '100 Rue de Rivoli', city: 'Paris', postalCode: '75001', country: 'France', vatNumber: 'FR55667788990', notes: 'Grand compte', totalOrders: 15, totalRevenue: 67200, marginTotal: 42100, isDeleted: false, createdAt: '2023-04-01T10:00:00Z', updatedAt: '2023-04-01T10:00:00Z' },
  { id: 'cli_006', companyId: 'comp_001', type: 'company', companyName: 'MédiaSud EURL', firstName: 'Émilie', lastName: 'Garcia', email: 'e.garcia@mediasud.fr', phone: '+33 4 91 00 00 06', address: '30 La Canebière', city: 'Marseille', postalCode: '13001', country: 'France', vatNumber: 'FR99887766554', notes: '', totalOrders: 6, totalRevenue: 21300, marginTotal: 13200, isDeleted: false, createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T10:00:00Z' },
];

export const mockOrders: Order[] = [
  { id: 'ord_001', companyId: 'comp_001', clientId: 'cli_001', clientName: 'TechVision SAS', orderNumber: 'CMD-2025-041', status: 'paid', items: [{ id: 'oi_001', orderId: 'ord_001', productId: 'prod_001', productName: 'Licence Logiciel Pro', quantity: 10, unitPrice: 299, vatRate: 20, totalHT: 2990, totalTVA: 598, totalTTC: 3588 }], totalHT: 2990, totalTVA: 598, totalTTC: 3588, paidAmount: 3588, issueDate: '2025-02-01T10:00:00Z', dueDate: '2025-03-03T10:00:00Z', notes: '', createdAt: '2025-02-01T10:00:00Z' },
  { id: 'ord_002', companyId: 'comp_001', clientId: 'cli_002', clientName: 'Innovatech SARL', orderNumber: 'CMD-2025-042', status: 'sent', items: [{ id: 'oi_002', orderId: 'ord_002', productId: 'prod_002', productName: 'Formation Management', quantity: 2, unitPrice: 1200, vatRate: 20, totalHT: 2400, totalTVA: 480, totalTTC: 2880 }], totalHT: 2400, totalTVA: 480, totalTTC: 2880, paidAmount: 0, issueDate: '2025-02-10T10:00:00Z', dueDate: '2025-03-12T10:00:00Z', notes: '', createdAt: '2025-02-10T10:00:00Z' },
  { id: 'ord_003', companyId: 'comp_001', clientId: 'cli_005', clientName: 'DataFlow SAS', orderNumber: 'CMD-2025-043', status: 'late', items: [{ id: 'oi_003', orderId: 'ord_003', productId: 'prod_003', productName: 'Audit Conformité RGPD', quantity: 1, unitPrice: 2500, vatRate: 20, totalHT: 2500, totalTVA: 500, totalTTC: 3000 }, { id: 'oi_004', orderId: 'ord_003', productId: 'prod_004', productName: 'Support Technique Premium', quantity: 6, unitPrice: 149, vatRate: 20, totalHT: 894, totalTVA: 178.8, totalTTC: 1072.8 }], totalHT: 3394, totalTVA: 678.8, totalTTC: 4072.8, paidAmount: 1500, issueDate: '2025-01-05T10:00:00Z', dueDate: '2025-02-04T10:00:00Z', notes: 'Relance effectuée', createdAt: '2025-01-05T10:00:00Z' },
  { id: 'ord_004', companyId: 'comp_001', clientId: 'cli_003', clientName: 'GreenEnergy SA', orderNumber: 'CMD-2025-044', status: 'draft', items: [{ id: 'oi_005', orderId: 'ord_004', productId: 'prod_005', productName: 'Pack Démarrage PME', quantity: 1, unitPrice: 3990, vatRate: 20, totalHT: 3990, totalTVA: 798, totalTTC: 4788 }], totalHT: 3990, totalTVA: 798, totalTTC: 4788, paidAmount: 0, issueDate: '2025-02-18T10:00:00Z', dueDate: '2025-03-20T10:00:00Z', notes: 'En attente validation', createdAt: '2025-02-18T10:00:00Z' },
  { id: 'ord_005', companyId: 'comp_001', clientId: 'cli_006', clientName: 'MédiaSud EURL', orderNumber: 'CMD-2025-045', status: 'paid', items: [{ id: 'oi_006', orderId: 'ord_005', productId: 'prod_006', productName: 'Consultation Stratégique', quantity: 3, unitPrice: 650, vatRate: 20, totalHT: 1950, totalTVA: 390, totalTTC: 2340 }], totalHT: 1950, totalTVA: 390, totalTTC: 2340, paidAmount: 2340, issueDate: '2025-02-05T10:00:00Z', dueDate: '2025-03-07T10:00:00Z', notes: '', createdAt: '2025-02-05T10:00:00Z' },
  { id: 'ord_006', companyId: 'comp_001', clientId: 'cli_004', clientName: 'Sophie Petit', orderNumber: 'CMD-2025-046', status: 'sent', items: [{ id: 'oi_007', orderId: 'ord_006', productId: 'prod_001', productName: 'Licence Logiciel Pro', quantity: 1, unitPrice: 299, vatRate: 20, totalHT: 299, totalTVA: 59.8, totalTTC: 358.8 }], totalHT: 299, totalTVA: 59.8, totalTTC: 358.8, paidAmount: 0, issueDate: '2025-02-15T10:00:00Z', dueDate: '2025-03-17T10:00:00Z', notes: '', createdAt: '2025-02-15T10:00:00Z' },
];

export const mockInvoices: Invoice[] = [
  { id: 'inv_001', companyId: 'comp_001', orderId: 'ord_001', clientId: 'cli_001', clientName: 'TechVision SAS', invoiceNumber: 'FAC-2025-041', status: 'paid', items: mockOrders[0].items, totalHT: 2990, totalTVA: 598, totalTTC: 3588, paidAmount: 3588, issueDate: '2025-02-01T10:00:00Z', dueDate: '2025-03-03T10:00:00Z', paymentTerms: 'Paiement à 30 jours', legalMentions: 'Dupont Solutions SAS - SIRET: 123 456 789 00012 - TVA: FR12345678901', isValidated: true, isLocked: true, validatedAt: '2025-02-01T10:30:00Z', electronicReady: true, createdAt: '2025-02-01T10:00:00Z' },
  { id: 'inv_002', companyId: 'comp_001', orderId: 'ord_005', clientId: 'cli_006', clientName: 'MédiaSud EURL', invoiceNumber: 'FAC-2025-042', status: 'paid', items: mockOrders[4].items, totalHT: 1950, totalTVA: 390, totalTTC: 2340, paidAmount: 2340, issueDate: '2025-02-05T10:00:00Z', dueDate: '2025-03-07T10:00:00Z', paymentTerms: 'Paiement à 30 jours', legalMentions: 'Dupont Solutions SAS - SIRET: 123 456 789 00012 - TVA: FR12345678901', isValidated: true, isLocked: true, validatedAt: '2025-02-05T10:30:00Z', electronicReady: true, createdAt: '2025-02-05T10:00:00Z' },
  { id: 'inv_003', companyId: 'comp_001', orderId: 'ord_003', clientId: 'cli_005', clientName: 'DataFlow SAS', invoiceNumber: 'FAC-2025-043', status: 'late', items: mockOrders[2].items, totalHT: 3394, totalTVA: 678.8, totalTTC: 4072.8, paidAmount: 1500, issueDate: '2025-01-05T10:00:00Z', dueDate: '2025-02-04T10:00:00Z', paymentTerms: 'Paiement à 30 jours', legalMentions: 'Dupont Solutions SAS - SIRET: 123 456 789 00012 - TVA: FR12345678901', isValidated: true, isLocked: true, validatedAt: '2025-01-05T10:30:00Z', electronicReady: true, createdAt: '2025-01-05T10:00:00Z' },
  { id: 'inv_004', companyId: 'comp_001', orderId: 'ord_002', clientId: 'cli_002', clientName: 'Innovatech SARL', invoiceNumber: 'FAC-2025-044', status: 'sent', items: mockOrders[1].items, totalHT: 2400, totalTVA: 480, totalTTC: 2880, paidAmount: 0, issueDate: '2025-02-10T10:00:00Z', dueDate: '2025-03-12T10:00:00Z', paymentTerms: 'Paiement à 30 jours', legalMentions: 'Dupont Solutions SAS - SIRET: 123 456 789 00012 - TVA: FR12345678901', isValidated: true, isLocked: true, validatedAt: '2025-02-10T10:30:00Z', electronicReady: true, createdAt: '2025-02-10T10:00:00Z' },
  { id: 'inv_005', companyId: 'comp_001', clientId: 'cli_003', clientName: 'GreenEnergy SA', invoiceNumber: 'FAC-2025-045', status: 'draft', items: [{ id: 'oi_008', orderId: '', productId: 'prod_007', productName: 'Hébergement Cloud', quantity: 12, unitPrice: 89, vatRate: 20, totalHT: 1068, totalTVA: 213.6, totalTTC: 1281.6 }], totalHT: 1068, totalTVA: 213.6, totalTTC: 1281.6, paidAmount: 0, issueDate: '2025-02-20T10:00:00Z', dueDate: '2025-03-22T10:00:00Z', paymentTerms: 'Paiement à 30 jours', legalMentions: 'Dupont Solutions SAS - SIRET: 123 456 789 00012 - TVA: FR12345678901', isValidated: false, isLocked: false, electronicReady: false, createdAt: '2025-02-20T10:00:00Z' },
];

export const mockQuotes: Quote[] = [
  {
    id: 'qt_001', companyId: 'comp_001', clientId: 'cli_001', clientName: 'TechVision SAS',
    quoteNumber: 'DEV-2025-015', status: 'accepted',
    items: [
      { id: 'qi_001', quoteId: 'qt_001', productId: 'prod_005', productName: 'Pack Démarrage PME', quantity: 2, unitPrice: 3990, vatRate: 20, totalHT: 7980, totalTVA: 1596, totalTTC: 9576 },
      { id: 'qi_002', quoteId: 'qt_001', productId: 'prod_004', productName: 'Support Technique Premium', quantity: 12, unitPrice: 149, vatRate: 20, totalHT: 1788, totalTVA: 357.6, totalTTC: 2145.6 },
    ],
    totalHT: 9768, totalTVA: 1953.6, totalTTC: 11721.6,
    issueDate: '2025-01-20T10:00:00Z', expirationDate: '2025-02-20T10:00:00Z',
    acceptedAt: '2025-01-28T14:30:00Z', acceptedBy: 'Thomas Martin',
    convertedToInvoiceId: 'inv_001',
    notes: 'Offre spéciale fidélité', createdAt: '2025-01-20T10:00:00Z',
  },
  {
    id: 'qt_002', companyId: 'comp_001', clientId: 'cli_003', clientName: 'GreenEnergy SA',
    quoteNumber: 'DEV-2025-016', status: 'sent',
    items: [
      { id: 'qi_003', quoteId: 'qt_002', productId: 'prod_003', productName: 'Audit Conformité RGPD', quantity: 1, unitPrice: 2500, vatRate: 20, totalHT: 2500, totalTVA: 500, totalTTC: 3000 },
      { id: 'qi_004', quoteId: 'qt_002', productId: 'prod_008', productName: 'Migration Données', quantity: 1, unitPrice: 1800, vatRate: 20, totalHT: 1800, totalTVA: 360, totalTTC: 2160 },
    ],
    totalHT: 4300, totalTVA: 860, totalTTC: 5160,
    issueDate: '2025-02-12T10:00:00Z', expirationDate: '2025-03-12T10:00:00Z',
    notes: 'Projet de mise en conformité RGPD + migration', createdAt: '2025-02-12T10:00:00Z',
  },
  {
    id: 'qt_003', companyId: 'comp_001', clientId: 'cli_005', clientName: 'DataFlow SAS',
    quoteNumber: 'DEV-2025-017', status: 'draft',
    items: [
      { id: 'qi_005', quoteId: 'qt_003', productId: 'prod_002', productName: 'Formation Management', quantity: 5, unitPrice: 1200, vatRate: 20, totalHT: 6000, totalTVA: 1200, totalTTC: 7200 },
    ],
    totalHT: 6000, totalTVA: 1200, totalTTC: 7200,
    issueDate: '2025-02-18T10:00:00Z', expirationDate: '2025-03-18T10:00:00Z',
    notes: 'Formation pour équipe management', createdAt: '2025-02-18T10:00:00Z',
  },
  {
    id: 'qt_004', companyId: 'comp_001', clientId: 'cli_006', clientName: 'MédiaSud EURL',
    quoteNumber: 'DEV-2025-018', status: 'refused',
    items: [
      { id: 'qi_006', quoteId: 'qt_004', productId: 'prod_006', productName: 'Consultation Stratégique', quantity: 5, unitPrice: 650, vatRate: 20, totalHT: 3250, totalTVA: 650, totalTTC: 3900 },
    ],
    totalHT: 3250, totalTVA: 650, totalTTC: 3900,
    issueDate: '2025-02-01T10:00:00Z', expirationDate: '2025-03-01T10:00:00Z',
    notes: 'Budget insuffisant selon client', createdAt: '2025-02-01T10:00:00Z',
  },
  {
    id: 'qt_005', companyId: 'comp_001', clientId: 'cli_002', clientName: 'Innovatech SARL',
    quoteNumber: 'DEV-2025-019', status: 'expired',
    items: [
      { id: 'qi_007', quoteId: 'qt_005', productId: 'prod_001', productName: 'Licence Logiciel Pro', quantity: 25, unitPrice: 299, vatRate: 20, totalHT: 7475, totalTVA: 1495, totalTTC: 8970 },
    ],
    totalHT: 7475, totalTVA: 1495, totalTTC: 8970,
    issueDate: '2025-01-05T10:00:00Z', expirationDate: '2025-02-05T10:00:00Z',
    notes: 'Déploiement licences', createdAt: '2025-01-05T10:00:00Z',
  },
];

export const mockCreditNotes: CreditNote[] = [
  {
    id: 'cn_001', companyId: 'comp_001', invoiceId: 'inv_002', invoiceNumber: 'FAC-2025-042',
    clientId: 'cli_006', clientName: 'MédiaSud EURL',
    creditNoteNumber: 'AV-2025-001', status: 'validated',
    items: [{ id: 'cni_001', orderId: '', productId: 'prod_006', productName: 'Consultation Stratégique', quantity: 1, unitPrice: 650, vatRate: 20, totalHT: 650, totalTVA: 130, totalTTC: 780 }],
    totalHT: 650, totalTVA: 130, totalTTC: 780,
    reason: 'Prestation annulée - session du 15/02',
    issueDate: '2025-02-16T10:00:00Z',
    isValidated: true, validatedAt: '2025-02-16T10:30:00Z',
    createdAt: '2025-02-16T10:00:00Z',
  },
  {
    id: 'cn_002', companyId: 'comp_001', invoiceId: 'inv_003', invoiceNumber: 'FAC-2025-043',
    clientId: 'cli_005', clientName: 'DataFlow SAS',
    creditNoteNumber: 'AV-2025-002', status: 'draft',
    items: [{ id: 'cni_002', orderId: '', productId: 'prod_004', productName: 'Support Technique Premium', quantity: 2, unitPrice: 149, vatRate: 20, totalHT: 298, totalTVA: 59.6, totalTTC: 357.6 }],
    totalHT: 298, totalTVA: 59.6, totalTTC: 357.6,
    reason: 'Mois de support non utilisés',
    issueDate: '2025-02-20T10:00:00Z',
    isValidated: false,
    createdAt: '2025-02-20T10:00:00Z',
  },
];

export const mockExpenses: Expense[] = [
  { id: 'exp_001', companyId: 'comp_001', category: 'rent', description: 'Loyer bureau Lyon', amount: 2800, vatAmount: 0, vatRate: 0, date: '2025-02-01T10:00:00Z', supplier: 'SCI Immobilière', reference: 'LOYER-0225', isRecurring: true, createdAt: '2025-02-01T10:00:00Z' },
  { id: 'exp_002', companyId: 'comp_001', category: 'software', description: 'Abonnement CRM HubSpot', amount: 890, vatAmount: 178, vatRate: 20, date: '2025-02-03T10:00:00Z', supplier: 'HubSpot', reference: 'HS-INV-2025-02', isRecurring: true, createdAt: '2025-02-03T10:00:00Z' },
  { id: 'exp_003', companyId: 'comp_001', category: 'marketing', description: 'Campagne Google Ads Février', amount: 1500, vatAmount: 300, vatRate: 20, date: '2025-02-05T10:00:00Z', supplier: 'Google Ireland', reference: 'GADS-0225', isRecurring: false, createdAt: '2025-02-05T10:00:00Z' },
  { id: 'exp_004', companyId: 'comp_001', category: 'salary', description: 'Salaires Février', amount: 18500, vatAmount: 0, vatRate: 0, date: '2025-02-28T10:00:00Z', supplier: 'Paie interne', reference: 'SAL-0225', isRecurring: true, createdAt: '2025-02-28T10:00:00Z' },
  { id: 'exp_005', companyId: 'comp_001', category: 'travel', description: 'Déplacement Paris - Client DataFlow', amount: 420, vatAmount: 84, vatRate: 20, date: '2025-02-10T10:00:00Z', supplier: 'SNCF / Hôtel', reference: 'DEPL-0225-01', isRecurring: false, createdAt: '2025-02-10T10:00:00Z' },
  { id: 'exp_006', companyId: 'comp_001', category: 'insurance', description: 'Assurance RC Pro', amount: 350, vatAmount: 0, vatRate: 0, date: '2025-02-15T10:00:00Z', supplier: 'AXA Entreprises', reference: 'AXA-RC-0225', isRecurring: true, createdAt: '2025-02-15T10:00:00Z' },
  { id: 'exp_007', companyId: 'comp_001', category: 'office', description: 'Fournitures bureau', amount: 180, vatAmount: 36, vatRate: 20, date: '2025-02-12T10:00:00Z', supplier: 'Bureau Vallée', reference: 'BV-2025-0892', isRecurring: false, createdAt: '2025-02-12T10:00:00Z' },
];

export const mockCashMovements: CashMovement[] = [
  { id: 'cm_001', companyId: 'comp_001', type: 'income', amount: 3588, description: 'Paiement FAC-2025-041 - TechVision SAS', category: 'Ventes', date: '2025-02-15T10:00:00Z', invoiceId: 'inv_001', balance: 45230, createdAt: '2025-02-15T10:00:00Z' },
  { id: 'cm_002', companyId: 'comp_001', type: 'expense', amount: 2800, description: 'Loyer bureau Lyon', category: 'Loyer', date: '2025-02-01T10:00:00Z', expenseId: 'exp_001', balance: 41642, createdAt: '2025-02-01T10:00:00Z' },
  { id: 'cm_003', companyId: 'comp_001', type: 'income', amount: 2340, description: 'Paiement FAC-2025-042 - MédiaSud EURL', category: 'Ventes', date: '2025-02-20T10:00:00Z', invoiceId: 'inv_002', balance: 47570, createdAt: '2025-02-20T10:00:00Z' },
  { id: 'cm_004', companyId: 'comp_001', type: 'expense', amount: 890, description: 'Abonnement CRM HubSpot', category: 'Logiciels', date: '2025-02-03T10:00:00Z', expenseId: 'exp_002', balance: 40752, createdAt: '2025-02-03T10:00:00Z' },
  { id: 'cm_005', companyId: 'comp_001', type: 'expense', amount: 18500, description: 'Salaires Février', category: 'Salaires', date: '2025-02-28T10:00:00Z', expenseId: 'exp_004', balance: 29070, createdAt: '2025-02-28T10:00:00Z' },
  { id: 'cm_006', companyId: 'comp_001', type: 'income', amount: 1500, description: 'Paiement partiel FAC-2025-043 - DataFlow SAS', category: 'Ventes', date: '2025-02-01T10:00:00Z', invoiceId: 'inv_003', balance: 43142, createdAt: '2025-02-01T10:00:00Z' },
  { id: 'cm_007', companyId: 'comp_001', type: 'expense', amount: 1500, description: 'Campagne Google Ads', category: 'Marketing', date: '2025-02-05T10:00:00Z', expenseId: 'exp_003', balance: 39252, createdAt: '2025-02-05T10:00:00Z' },
  { id: 'cm_008', companyId: 'comp_001', type: 'expense', amount: 420, description: 'Déplacement Paris', category: 'Déplacements', date: '2025-02-10T10:00:00Z', expenseId: 'exp_005', balance: 38832, createdAt: '2025-02-10T10:00:00Z' },
];

export const mockPayments: Payment[] = [
  { id: 'pay_001', companyId: 'comp_001', orderId: 'ord_001', invoiceId: 'inv_001', amount: 3588, method: 'bank_transfer', reference: 'VIR-20250215-001', paidAt: '2025-02-15T10:00:00Z', createdAt: '2025-02-15T10:00:00Z' },
  { id: 'pay_002', companyId: 'comp_001', orderId: 'ord_005', invoiceId: 'inv_002', amount: 2340, method: 'card', reference: 'CB-20250220-001', paidAt: '2025-02-20T10:00:00Z', createdAt: '2025-02-20T10:00:00Z' },
  { id: 'pay_003', companyId: 'comp_001', orderId: 'ord_003', invoiceId: 'inv_003', amount: 1500, method: 'bank_transfer', reference: 'VIR-20250201-003', paidAt: '2025-02-01T10:00:00Z', createdAt: '2025-02-01T10:00:00Z' },
];

export const mockAuditLogs: AuditLog[] = [
  { id: 'audit_001', companyId: 'comp_001', userId: 'usr_001', userName: 'Pierre Dupont', action: 'validate', entityType: 'invoice', entityId: 'inv_001', entityLabel: 'FAC-2025-041', details: 'Facture validée et verrouillée', timestamp: '2025-02-01T10:30:00Z' },
  { id: 'audit_002', companyId: 'comp_001', userId: 'usr_001', userName: 'Pierre Dupont', action: 'send', entityType: 'invoice', entityId: 'inv_001', entityLabel: 'FAC-2025-041', details: 'Facture envoyée par email à thomas.martin@techvision.fr', timestamp: '2025-02-01T10:35:00Z' },
  { id: 'audit_003', companyId: 'comp_001', userId: 'usr_002', userName: 'Marie Laurent', action: 'create', entityType: 'quote', entityId: 'qt_002', entityLabel: 'DEV-2025-016', details: 'Devis créé pour GreenEnergy SA', timestamp: '2025-02-12T10:00:00Z' },
  { id: 'audit_004', companyId: 'comp_001', userId: 'usr_001', userName: 'Pierre Dupont', action: 'payment', entityType: 'invoice', entityId: 'inv_003', entityLabel: 'FAC-2025-043', details: 'Paiement partiel de 1 500,00 € enregistré', timestamp: '2025-02-01T10:00:00Z' },
  { id: 'audit_005', companyId: 'comp_001', userId: 'usr_002', userName: 'Marie Laurent', action: 'validate', entityType: 'invoice', entityId: 'inv_004', entityLabel: 'FAC-2025-044', details: 'Facture validée et verrouillée', timestamp: '2025-02-10T10:30:00Z' },
  { id: 'audit_006', companyId: 'comp_001', userId: 'usr_001', userName: 'Pierre Dupont', action: 'create', entityType: 'credit_note', entityId: 'cn_001', entityLabel: 'AV-2025-001', details: 'Avoir créé pour annulation prestation MédiaSud EURL', timestamp: '2025-02-16T10:00:00Z' },
  { id: 'audit_007', companyId: 'comp_001', userId: 'usr_001', userName: 'Pierre Dupont', action: 'validate', entityType: 'credit_note', entityId: 'cn_001', entityLabel: 'AV-2025-001', details: 'Avoir validé - 780,00 €', timestamp: '2025-02-16T10:30:00Z' },
  { id: 'audit_008', companyId: 'comp_001', userId: 'usr_003', userName: 'Julien Moreau', action: 'convert', entityType: 'quote', entityId: 'qt_001', entityLabel: 'DEV-2025-015', details: 'Devis converti en facture FAC-2025-041', timestamp: '2025-01-28T15:00:00Z' },
  { id: 'audit_009', companyId: 'comp_001', userId: 'usr_002', userName: 'Marie Laurent', action: 'send', entityType: 'quote', entityId: 'qt_002', entityLabel: 'DEV-2025-016', details: 'Devis envoyé à a.leroy@greenenergy.fr', timestamp: '2025-02-12T11:00:00Z' },
  { id: 'audit_010', companyId: 'comp_001', userId: 'usr_001', userName: 'Pierre Dupont', action: 'update', entityType: 'company', entityId: 'comp_001', entityLabel: 'Dupont Solutions', details: 'Activation de la facturation électronique', timestamp: '2025-02-15T09:00:00Z' },
];

export const mockReminderLogs: ReminderLog[] = [
  { id: 'rem_001', companyId: 'comp_001', invoiceId: 'inv_003', invoiceNumber: 'FAC-2025-043', clientName: 'DataFlow SAS', type: 'payment_overdue_7', sentAt: '2025-02-11T09:00:00Z', sentBy: 'auto', emailTo: 'lucas.roux@dataflow.fr', status: 'sent' },
  { id: 'rem_002', companyId: 'comp_001', invoiceId: 'inv_003', invoiceNumber: 'FAC-2025-043', clientName: 'DataFlow SAS', type: 'payment_overdue_14', sentAt: '2025-02-18T09:00:00Z', sentBy: 'auto', emailTo: 'lucas.roux@dataflow.fr', status: 'sent' },
  { id: 'rem_003', companyId: 'comp_001', invoiceId: 'inv_004', invoiceNumber: 'FAC-2025-044', clientName: 'Innovatech SARL', type: 'payment_due', sentAt: '2025-03-05T09:00:00Z', sentBy: 'auto', emailTo: 'claire.dubois@innovatech.fr', status: 'sent' },
];

export const mockDashboardStats: DashboardStats = {
  revenue: 87420,
  revenueChange: 12.3,
  revenuePreviousPeriod: 77840,
  ordersCount: 46,
  ordersChange: 8.1,
  clientsCount: 6,
  clientsChange: 15.0,
  outstandingAmount: 7311.6,
  outstandingChange: -5.2,
  vatCollected: 14570,
  vatCollectedByRate: { '20%': 13200, '10%': 890, '5.5%': 380, '2.1%': 100 },
  margin: 52460,
  marginPercent: 60.0,
  marginPreviousPeriod: 46800,
  cashPosition: 29070,
  projectedEndOfMonth: 38420,
  projectedEndOfYear: 245000,
  growthRate: 12.3,
  cashShortageRisk: false,
  topClients: [
    { name: 'DataFlow SAS', revenue: 67200, margin: 42100 },
    { name: 'TechVision SAS', revenue: 45800, margin: 28400 },
    { name: 'Innovatech SARL', revenue: 32400, margin: 19800 },
    { name: 'MédiaSud EURL', revenue: 21300, margin: 13200 },
    { name: 'GreenEnergy SA', revenue: 18900, margin: 11200 },
  ],
  stockTotalCost: 142850,
  quotesAccepted: 8,
  quotesTotal: 18,
  averagePaymentDays: 24,
  monthlyExpenses: 5600,
  realMargin: 81820,
  lowStockAlerts: 2,
  supplierInvoicesToPay: 3,
  supplierInvoicesToPayAmount: 12450,
};

export const mockMonthlyRevenue: MonthlyRevenue[] = [
  { month: 'Jan', revenue: 12400, expenses: 4200, margin: 8200, cashflow: 8200 },
  { month: 'Fév', revenue: 15800, expenses: 5100, margin: 10700, cashflow: 10700 },
  { month: 'Mar', revenue: 11200, expenses: 3800, margin: 7400, cashflow: 7400 },
  { month: 'Avr', revenue: 18500, expenses: 6200, margin: 12300, cashflow: 12300 },
  { month: 'Mai', revenue: 14300, expenses: 4900, margin: 9400, cashflow: 9400 },
  { month: 'Jun', revenue: 21000, expenses: 7100, margin: 13900, cashflow: 13900 },
  { month: 'Jul', revenue: 16800, expenses: 5600, margin: 11200, cashflow: 11200 },
  { month: 'Aoû', revenue: 9200, expenses: 3100, margin: 6100, cashflow: 6100 },
  { month: 'Sep', revenue: 19400, expenses: 6500, margin: 12900, cashflow: 12900 },
  { month: 'Oct', revenue: 22100, expenses: 7400, margin: 14700, cashflow: 14700 },
  { month: 'Nov', revenue: 17800, expenses: 5900, margin: 11900, cashflow: 11900 },
  { month: 'Déc', revenue: 24500, expenses: 8200, margin: 16300, cashflow: 16300 },
];

export const mockSales: Sale[] = [
  {
    id: 'sale_001', companyId: 'comp_001', saleNumber: 'VEN-2026-001',
    clientId: 'cli_004', clientName: 'Sophie Petit',
    items: [
      { id: 'si_001', saleId: 'sale_001', productId: 'prod_001', productName: 'Licence Logiciel Pro', quantity: 2, unitPrice: 299, vatRate: 20, totalHT: 598, totalTVA: 119.6, totalTTC: 717.6 },
    ],
    totalHT: 598, totalTVA: 119.6, totalTTC: 717.6,
    paymentMethod: 'card', status: 'paid',
    createdAt: '2026-02-22T09:15:00Z',
  },
  {
    id: 'sale_002', companyId: 'comp_001', saleNumber: 'VEN-2026-002',
    items: [
      { id: 'si_002', saleId: 'sale_002', productId: 'prod_004', productName: 'Support Technique Premium', quantity: 1, unitPrice: 149, vatRate: 20, totalHT: 149, totalTVA: 29.8, totalTTC: 178.8 },
      { id: 'si_003', saleId: 'sale_002', productId: 'prod_007', productName: 'Hébergement Cloud', quantity: 3, unitPrice: 89, vatRate: 20, totalHT: 267, totalTVA: 53.4, totalTTC: 320.4 },
    ],
    totalHT: 416, totalTVA: 83.2, totalTTC: 499.2,
    paymentMethod: 'cash', status: 'paid',
    createdAt: '2026-02-22T10:30:00Z',
  },
  {
    id: 'sale_003', companyId: 'comp_001', saleNumber: 'VEN-2026-003',
    clientId: 'cli_001', clientName: 'TechVision SAS',
    items: [
      { id: 'si_004', saleId: 'sale_003', productId: 'prod_006', productName: 'Consultation Stratégique', quantity: 1, unitPrice: 650, vatRate: 20, totalHT: 650, totalTVA: 130, totalTTC: 780 },
    ],
    totalHT: 650, totalTVA: 130, totalTTC: 780,
    paymentMethod: 'card', status: 'paid',
    createdAt: '2026-02-21T14:00:00Z',
  },
  {
    id: 'sale_004', companyId: 'comp_001', saleNumber: 'VEN-2026-004',
    items: [
      { id: 'si_005', saleId: 'sale_004', productId: 'prod_001', productName: 'Licence Logiciel Pro', quantity: 1, unitPrice: 299, vatRate: 20, totalHT: 299, totalTVA: 59.8, totalTTC: 358.8 },
    ],
    totalHT: 299, totalTVA: 59.8, totalTTC: 358.8,
    paymentMethod: 'transfer', status: 'refunded',
    refundedAt: '2026-02-21T16:00:00Z',
    createdAt: '2026-02-21T11:00:00Z',
  },
  {
    id: 'sale_005', companyId: 'comp_001', saleNumber: 'VEN-2026-005',
    items: [
      { id: 'si_006', saleId: 'sale_005', productId: 'prod_005', productName: 'Pack Démarrage PME', quantity: 1, unitPrice: 3990, vatRate: 20, totalHT: 3990, totalTVA: 798, totalTTC: 4788 },
    ],
    totalHT: 3990, totalTVA: 798, totalTTC: 4788,
    paymentMethod: 'card', status: 'paid',
    createdAt: '2026-02-20T09:45:00Z',
  },
];

export const mockTopProducts = [
  { name: 'Pack Démarrage PME', revenue: 27930, quantity: 7 },
  { name: 'Audit Conformité RGPD', revenue: 22500, quantity: 9 },
  { name: 'Formation Management', revenue: 18000, quantity: 15 },
  { name: 'Migration Données', revenue: 14400, quantity: 8 },
  { name: 'Consultation Stratégique', revenue: 11050, quantity: 17 },
];
