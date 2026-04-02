# HaziOne — Simplifie ton business

Application mobile et web de gestion commerciale complete construite avec React Native (Expo).
Cible : petits commercants, artisans, PME en Afrique francophone et en France.

## Fonctionnalites principales

| Module | Description |
|--------|-------------|
| **Tableau de bord** | KPIs, CA du jour, bloc "A faire", comparaison mois precedent, tresorerie integree |
| **Ventes** | Devis, factures, avoirs, relances clients (SMS/WhatsApp), paiements partiels |
| **Achats** | Fournisseurs, commandes fournisseur, factures recues, conversion en facture |
| **Produits & Stock** | Catalogue, variantes, inventaire, categories, marques, mouvements de stock |
| **Caisse (POS)** | Point de vente, especes/carte/Wave/Orange Money/mixte, historique |
| **Boutique en ligne** | Vitrine publique, commandes en ligne, panier, checkout |
| **Paiements** | Stripe (CB) et CinetPay (Wave, Orange Money, MTN) |
| **Parametres** | Entreprise, bancaire, facturation, modules, abonnement, langue |
| **Administration** | Journaux d'audit, gestion des employes, roles et permissions |
| **Console (Super Admin)** | Licences, utilisateurs, statistiques (acces restreint) |

## Architecture technique

### Stack

- **React Native** + **Expo SDK 54** — Cross-platform iOS / Android / Web
- **Expo Router** — Routage base sur les fichiers
- **TypeScript** — Typage strict
- **React Query** — Gestion de l'etat serveur (queries, mutations, cache)
- **Supabase** — Backend (auth, base de donnees, storage, edge functions)
- **AsyncStorage** — Persistance locale et mode hors-ligne
- **@nkzw/create-context-hook** — Contextes React typesafe
- **Lucide React Native** — Icones

### Systeme de roles (RBAC)

| Role | Acces |
|------|-------|
| **Proprietaire** (admin) | Acces complet |
| **Gerant** (manager) | Tout sauf suppression entreprise et abonnement |
| **Caissier** (employee) | Caisse, ventes, produits (sans prix d'achat), clients, dashboard simplifie |
| **Comptable** (accountant) | Ventes, achats, tresorerie (lecture seule), exports |

### Super Admin

L'acces super admin est gere via la table `profiles` (colonne `is_super_admin`).
La verification utilise une RPC Supabase `check_is_super_admin()` en `SECURITY DEFINER`
pour eviter la recursion RLS. Le module Console n'apparait dans la navigation que pour
les utilisateurs marques super admin.

### Internationalisation (i18n)

- Francais (defaut) et Anglais
- Detection automatique de la langue du systeme
- Changement instantane dans Parametres > Langue

### Mode hors-ligne

- Cache local des produits, clients et parametres entreprise
- File d'attente des ventes creees sans connexion
- Synchronisation automatique au retour de la connexion
- Banniere visuelle "Mode hors-ligne" avec compteur de ventes en attente

### Abonnements et licences

- Plans : Solo (9 EUR/mois), Pro (19 EUR/mois), Business (39 EUR/mois)
- Essai gratuit 14 jours sur le plan Pro
- Licences a usage unique generees par le super admin
- Activation par code dans Parametres > Abonnement

## Structure du projet

```
expo/
├── app/                          # Ecrans (Expo Router file-based routing)
│   ├── _layout.tsx               # Layout racine — providers
│   ├── auth.tsx                  # Ecran d'authentification
│   ├── landing.tsx               # Landing page marketing
│   ├── super-admin.tsx           # Console super admin (modale)
│   ├── (app)/                    # Groupe de routes authentifiees
│   │   ├── _layout.tsx           # Shell responsive : Sidebar / BottomTabBar
│   │   ├── index.tsx             # Tableau de bord
│   │   ├── ventes.tsx            # Module Ventes
│   │   ├── achats.tsx            # Module Achats
│   │   ├── stock.tsx             # Produits & Stock
│   │   ├── sales.tsx             # Caisse POS
│   │   ├── boutique.tsx          # Boutique en ligne (admin)
│   │   ├── payments.tsx          # Paiements en ligne
│   │   ├── settings.tsx          # Parametres
│   │   ├── admin.tsx             # Administration
│   │   └── ...
│   └── shop/                     # Vitrine publique (sans auth)
│       ├── _layout.tsx
│       └── [slug].tsx
│
├── components/                   # Composants UI reutilisables
│   ├── Sidebar.tsx               # Navigation desktop (collapsible)
│   ├── BottomTabBar.tsx          # Navigation mobile
│   ├── shared/                   # Composants partages generiques
│   └── ...
│
├── config/
│   └── plans.ts                  # Plans d'abonnement (Solo, Pro, Business)
│
├── constants/                    # Configuration et constantes
│   ├── colors.ts                 # Palettes theme clair / sombre
│   ├── modules.ts                # Modules SaaS et restrictions par plan
│   ├── permissions.ts            # Matrice permissions par role (RBAC)
│   └── ...
│
├── contexts/                     # Contextes React (state management)
│   ├── AuthContext.tsx            # Authentification Supabase
│   ├── DataContext.tsx            # Donnees metier (CRUD complet)
│   ├── SubscriptionContext.tsx    # Abonnements et licences
│   ├── RoleContext.tsx            # Roles et permissions
│   ├── ThemeContext.tsx           # Theme clair / sombre
│   ├── I18nContext.tsx            # Internationalisation
│   ├── OfflineContext.tsx         # Mode hors-ligne et sync
│   └── ...
│
├── services/                     # Services externes et logique metier
│   ├── supabase.ts               # Client Supabase singleton
│   ├── supabaseData.ts           # CRUD Supabase complet
│   ├── superAdminService.ts      # Service super admin (licences, users, stats)
│   ├── paymentService.ts         # Paiements Stripe / CinetPay
│   └── ...
│
├── types/
│   └── index.ts                  # Types TypeScript centralises
│
├── supabase-schema.sql           # Schema SQL unique et consolide
│
└── utils/                        # Utilitaires (format, calculs, export CSV)

backend/
├── supabase/
│   ├── schema.sql                # (obsolete — voir expo/supabase-schema.sql)
│   └── functions/                # Supabase Edge Functions
│       ├── create-cinetpay-payment/
│       ├── cinetpay-webhook/
│       ├── create-stripe-payment/
│       ├── stripe-webhook/
│       └── get-payment-status/
│
└── types/
    └── payment.ts                # Types partages backend/frontend
```

## Base de donnees

Le schema complet est dans **`expo/supabase-schema.sql`**. Ce fichier unique remplace
tous les anciens fichiers de migration et schemas partiels.

### Tables principales

| Table | Description |
|-------|-------------|
| `companies` | Entreprise (1 par utilisateur auth) |
| `profiles` | Profil utilisateur (super admin, email unique) |
| `clients` | Clients de l'entreprise |
| `suppliers` | Fournisseurs |
| `products` | Catalogue produits |
| `product_variants` | Variantes (taille, couleur...) |
| `invoices` | Factures emises |
| `quotes` | Devis |
| `sales` | Ventes caisse (POS) |
| `cash_movements` | Tresorerie |
| `purchase_orders` | Commandes fournisseur |
| `supplier_invoices` | Factures fournisseur |
| `stock_movements` | Mouvements de stock |
| `shops` | Configuration boutique en ligne |
| `shop_orders` | Commandes boutique |
| `payments` | Paiements (Stripe + CinetPay) |
| `subscriptions` | Abonnements |
| `licenses` | Licences a usage unique |
| `license_users` | Utilisateurs rattaches a une licence |
| `audit_logs` | Journal d'audit |
| `admin_logs` | Journal admin (super admin) |

### Fonctions RPC

| Fonction | Description |
|----------|-------------|
| `check_is_super_admin()` | Verifie si l'utilisateur courant est super admin |
| `get_my_company_id()` | Retourne l'ID entreprise de l'utilisateur |
| `delete_user_account()` | Supprime le compte (auth + profil + cascade) |

## Lancer le projet

```bash
cd frontend
bun install
npx expo start

```

## Configuration

Variables d'environnement (gerees via Rork) :
- `EXPO_PUBLIC_SUPABASE_URL` — URL du projet Supabase
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Cle anonyme Supabase

## Conventions de code

- **TypeScript strict** — Typage explicite pour tous les useState, props, et retours de fonctions
- **React.memo** — Composants memoises pour eviter les re-renders inutiles
- **useCallback / useMemo** — Optimisations manuelles (pas de React Compiler)
- **createContextHook** — Tous les contextes utilisent `@nkzw/create-context-hook`
- **React Query** — Object API (`useQuery({ queryKey, queryFn })`)
- **StyleSheet.create** — Styles natifs, pas de CSS-in-JS externe
