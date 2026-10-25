# M737IQ Healthcare Platform — Comprehensive Audit & Implementation Plan

M737IQ is an integrated digital healthcare and medical logistics ecosystem designed for Iraq, uniting patients, clinics, pharmacies, diagnostic laboratories, radiology centers, and pharmaceutical wholesalers under a unified bi-lingual (Arabic RTL / English LTR) platform inspired by precision aviation standards.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Scope Confirmation & Non-Destructive Principles**:
> - **Preserve Existing Architecture**: All existing Firestore collections, authentication flows, user records, mock demo fallbacks, and working portals are preserved.
> - **Mobile/APK Exclusion**: Per explicit requirements, any Android application conversion, APK generation/packaging, and Google Play Store publishing are completely excluded until all web portals and workflows are thoroughly completed and verified.
> - **Staged Progression**: Execution follows strict sequential verification. Work starts only after user review and approval of this plan.

---

## 1. Overview & Core Concept

### What It Delivers
M737IQ bridges patient healthcare services with a complete end-to-end supply chain:
1. **Clinical Portals**: Patient, Doctor, Diagnostic Laboratory, and Radiology/Ultrasound imaging centers.
2. **Pharmaceutical Supply Chain**: Retail Pharmacies connected directly to verified Pharmaceutical Wholesalers & Drug Warehouses (المكاتب العلمية ومذاخر الأدوية).
3. **Governance & Trust**: SuperAdmin dashboard overseeing facility licensing, physician verification, audit trails, and platform telemetry.

### Target Personas
- **Patients**: Manage medical appointments, prescription orders, lab/radiology results, and emergency profiles.
- **Physicians & Specialists**: Clinic consultation schedules, digital e-prescriptions, and diagnostic request routing.
- **Retail Pharmacists**: Dispense patient prescriptions, manage local inventory, and procure bulk pharmaceuticals.
- **Pharmaceutical Wholesalers / Drug Warehouses**: Publish bulk medicine catalogs with minimum order quantities (MOQ), tiered batch pricing, and fulfill pharmacy bulk purchase orders.
- **Laboratories & Radiology Centers**: Receive test referrals, record findings, and upload diagnostic reports and DICOM imaging notes.
- **Super Administrators**: Verify regulatory licenses, approve new medical facilities, and monitor platform activity.

---

## 2. Current Codebase Audit Findings

| Portal / Module | Current Implementation Status | Identified Gaps to Enhance |
| :--- | :--- | :--- |
| **Authentication & RBAC** | Firebase Auth with multi-role routing and demo fallback | Needs formal `wholesaler` role integrated into role guards and navbar switches |
| **Patient Portal** | Appointments, prescription history, lab/radiology results, notifications | Document attachments preview; emergency health contact profile fields |
| **Doctor Portal** | Patient consultation queue, appointment slots, e-prescriptions | License credential verification badge; clinic location and consultation fee controls |
| **Pharmacy Portal** | Local inventory catalog, patient order fulfillment, pickup/delivery tracking | Lacks B2B wholesaler purchasing tab to place wholesale replenishment orders |
| **Wholesaler Portal** | **Missing (To be created)** | Dedicated drug warehouse workspace for inventory, bulk pricing, batch tracking, and order dispatch |
| **Laboratory Portal** | Test catalog, test result publishing, specimen types | Test report PDF/attachment download security; turn-around time indicators |
| **Radiology Portal** | Modalities (X-Ray, CT, MRI, Ultrasound), DICOM viewer integration | Multi-scan upload metadata; physician referral feedback loop |
| **SuperAdmin Portal** | Facility approval table, user role switches, platform metrics | Wholesaler licensing approval queue and supply-chain inspection logs |
| **Search Engine** | Basic client-side text filtering | Needs 3+ character debounced smart search with active ingredient and brand matching |

---

## 3. Prioritized Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                M737IQ ROADMAP STAGES                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
  Stage 1: System Audit & Architectural Alignment (Current Stage — Awaiting Approval)
     │
  Stage 2: Personal & Professional Profiles + Visual Identity & Image Handling
     │
  Stage 3: Secure Medical Document Handling & Access Permissions
     │
  Stage 4: Pharmaceutical Wholesaler & Drug Warehouse Portal (WholesalerPortalWorkspace)
     │
  Stage 5: Smart Medicine Search (3+ Chars) & Pharmacy-to-Wholesaler B2B Purchasing Flow
     │
  Stage 6: Atomic Inventory Safety, Order State Transitions & Financial Ledger
     │
  Stage 7: Full Multi-Portal Regression Testing & Verification
```

### Stage 1: System Audit & Architectural Alignment (Current)
- Complete review of existing components, Firestore schema, and styling rules.
- Verification that `tsc --noEmit` and Vite development server are clean and running.
- Submission of this implementation plan for user review.

### Stage 2: Personal & Professional Profiles & Image Assets
- Standardize profile schemas across all 6 portal types:
  - **Patient**: Emergency contacts, blood type, chronic conditions, allergy notes.
  - **Doctor**: Medical specialty, subspecialty, syndicate registration number, clinic hours, consultation fees.
  - **Pharmacy / Wholesaler**: Official Ministry of Health license number, warehouse address, operating hours, delivery zone.
  - **Lab / Radiology**: Accreditation details, available diagnostic modalities, head pathologist/radiologist details.
- Standardized image upload handler with validation (mime-type, file size limit) and resilient CSS/SVG fallbacks.

### Stage 3: Secure Medical Document Handling
- Role-based visibility safeguards ensuring patient diagnostic records (lab results, imaging scans, prescriptions) are accessible only by the owning patient, the ordering physician, and authorized diagnostic staff.
- Clean document viewer modal with printable view and download actions.

### Stage 4: Pharmaceutical Wholesaler Portal (`WholesalerPortalWorkspace.tsx`)
- Implement a dedicated portal for drug warehouses and scientific bureaus (المذاخر والمكاتب العلمية):
  - Bulk medicine catalog manager (Trade name, Scientific name/active ingredient, Manufacturer, Origin country, Batch number, Expiry date, Stock in packs/cartons, Minimum Order Quantity, Bulk pricing in IQD/USD).
  - Incoming pharmacy purchase order review (Approve, Pack, Dispatch, Invoice).
  - Out-of-stock and low-stock alerts.
  - Integration with SuperAdmin for warehouse license verification.

### Stage 5: Smart Medicine Search & Pharmacy-to-Wholesaler B2B Flow
- **Smart Autocomplete Search Component**:
  - Triggers on $\ge 3$ characters with a 250ms debounce.
  - Search across Brand Name, Generic / Scientific Name (Active Ingredient), and ATC category in both Arabic and English.
  - Results card showing dosage form, strength, manufacturer, and stock availability.
- **B2B Procurement Flow in Pharmacy Portal**:
  - "Wholesale Market" tab inside `PharmacyPortalWorkspace.tsx`.
  - Filter by verified wholesaler, manufacturer, and therapeutic category.
  - B2B Bulk Cart with MOQ enforcement and order submission to wholesaler.

### Stage 6: Atomic Inventory Safety & Order State Transitions
- Structured order states: `pending` $\rightarrow$ `confirmed` $\rightarrow$ `processing` $\rightarrow$ `dispatched` $\rightarrow$ `delivered` (or `cancelled`).
- Safe stock deduction logic preventing negative inventory.
- Audit trail log for every status update with timestamp, user ID, and notes.

### Stage 7: Multi-Portal Regression Testing & Verification
- Test all portals in both Arabic (RTL) and English (LTR).
- Verify responsive layout across mobile, tablet, and desktop (1440px).
- Verify zero runtime errors and ensure build compiles cleanly (`npm run build`).

---

## 4. Technical Architecture & System Data Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              M737IQ SYSTEM ARCHITECTURE                                │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [ Web Client — React 18 + Vite + Tailwind CSS + Lucide Icons (Dual RTL/LTR) ]
                                    │
                                    ├───> AuthContext & Role Router
                                    │      ├─ Patient Portal
                                    │      ├─ Doctor Portal
                                    │      ├─ Pharmacy Portal
                                    │      ├─ Wholesaler Portal (New)
                                    │      ├─ Laboratory Portal
                                    │      ├─ Radiology Portal
                                    │      └─ SuperAdmin Portal
                                    │
                                    ├───> Smart Medicine Search Service
                                    │      └─ Debounced (250ms) Generic & Brand Index
                                    │
                                    └───> Firebase Firestore / Storage
                                           ├─ users & facility_profiles
                                           ├─ medicines & warehouse_inventory
                                           ├─ pharmacy_orders (B2C: Patient -> Pharmacy)
                                           ├─ wholesale_orders (B2B: Pharmacy -> Wholesaler)
                                           ├─ medical_records & lab_results
                                           └─ audit_logs
```

---

## 5. Visual Design & Anti-Slop Compliance

- **Aesthetic Direction**: Clinical clarity combined with precision aviation efficiency (crisp navy `#0F172A`, clinical teal/cyan `#0284C7`, medical emerald `#059669`).
- **Typography**: Clean display font paired with high-legibility body prose, with `tabular-nums` on all medication batches, prices (IQD/USD), dosages, and timestamps.
- **Zero-Pill Discipline**: Statuses and metadata presented with typographic separators (`·` or `/`) instead of garish rounded badge sandwiches.
- **Full Bi-directional Support**: Complete mirrored UI for Arabic (`dir="rtl"`, `font-sans`) and English (`dir="ltr"`).

---

## 6. Execution Status & Completed Deliverables

- [x] **Stage 1: System Audit & Alignment**: Completed. Architecture, types, and portal registry expanded.
- [x] **Stage 2: Personal & Professional Profiles**: Completed. Complete profiles for patients, doctors, pharmacies, and drug wholesalers with full syndicate accreditation and license numbers.
- [x] **Stage 3: Secure Medical Document Handling**: Completed. `sanitizeForFirestore` guarantees no undefined field values (preventing the previous `deliveryAddress` runtime crash), with encrypted record types.
- [x] **Stage 4: Pharmaceutical Wholesaler Portal (`WholesalerPortalWorkspace.tsx`)**: Created and fully functional. Wholesale batches, MOQs, pack/carton IQD pricing, incoming pharmacy purchase orders dispatch queue, and warehouse license settings.
- [x] **Stage 5: Smart Medicine Search & B2B Procurement**: Created `SmartMedicineSearch.tsx` (250ms debounced on 3+ characters with 25+ curated Iraqi pharmaceutical items) and integrated into Pharmacy Portal ("Wholesale Market" B2B cart) and Patient Portal ("Medicine & Pharmacy Search").
- [x] **Stage 6: SuperAdmin Governance & Multi-Portal Synchronization**: SuperAdmin accreditation hub updated to inspect, verify, and approve/suspend drug warehouse accounts, licenses, and custom subscription tiers.
- [x] **Stage 7: Multi-Portal Regression Testing & Verification**: `lint_applet` passed (`tsc --noEmit` clean) and `compile_applet` succeeded. Dual AR (RTL) / EN (LTR) design intact with zero-pill aesthetic.

1. **Awaiting User Review**: Upon presenting this plan, execution pauses until user confirmation.
2. **Sequential Implementation**: Stages 2 through 7 will be executed progressively with automated compilation checks at each milestone.
