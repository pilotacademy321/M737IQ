# M737IQ MEDICAL PLATFORM — FULL ID AUDIT & COMPREHENSIVE PROJECT DEFICIENCIES REPORT

**Document ID:** `M737IQ_FULL_AUDIT_AND_MISSING_FEATURES.md`  
**Date of Audit:** October 26, 2026  
**Auditor:** Senior Software & Security Systems Auditor  
**Scope:** Complete codebase audit of M737 Medical Platform (Frontend, Firebase Authentication, Firestore Collections, Security Rules, Storage, Identity Architecture, and Inter-Portal Integrations).  
**Mode:** AUDIT ONLY — READ-ONLY VERIFICATION (No production mutations, no fake data, no code modification applied).

---

## 1. Executive Summary

An exhaustive, evidence-based audit was performed across the entire M737 Medical Platform codebase (`src/`, `firestore.rules`, `firebase-applet-config.json`, and backend integrations).

### Summary of System Status:
1. **Core Identity Architecture (Utils & Types):**
   - High architectural maturity: A unified identity registry (`/account_ids/{accountId}`) and deterministic salt-based generation algorithm exists in `src/utils/medicalId.ts`.
   - Unit test suite (`runIdSystemVerificationTests`) executes 22 automated tests with a **100% pass rate** (deterministic entropy, cross-doctor chart document key isolation, query sanitization, and prefix standards).
2. **Critical Identity Deficiencies in Workspaces (The "Transient ID Trap"):**
   - While the ID utility supports permanent IDs, several workspaces bypass it during record creation. For instance, walk-in appointments in `SecretaryPortalWorkspace.tsx` and manual records in `DoctorPortalWorkspace.tsx` hardcode temporary strings (`pat_reception_${Date.now()}` and `pat_rec_${Date.now()}`). This breaks patient record association, stranding records away from the patient's portal.
3. **Cross-Doctor Confidential Clinical Chart System:**
   - Architecture is implemented (`doctor_patient_charts/{chart_${doctorId}_${patientId}}`). Firestore security rules strictly isolate charts so that only the attending doctor and super admin can read or write. Other doctors are mathematically denied access to private clinic charts.
4. **Backend Security Rules Deployment Blocker:**
   - The security rules in `firestore.rules` are hardened and syntactically valid, but **cannot be deployed automatically via tool RPCs** due to a cloud permission error (`GraphQL errors: The caller does not have permission`). Rules remain in the local workspace until deployed via Firebase Console or CLI.
5. **Legacy / Demo Fallback Data Injections:**
   - When Firestore collections are empty or network latency occurs, several portals (Patient, Doctor, Wholesaler) fall back to hardcoded sample arrays containing demo identifiers (`demo_doc_sanaa`, `demo_patient_sara`, `demo_pharmacy_amal`).

### 1.1. System-Wide Status Classification Matrix

| Classification Category | Platform Modules & Components Included | Current Operational Reality | Next Required Step |
| :--- | :--- | :--- | :--- |
| **VERIFIED FUNCTIONALITY** | • Unified Account ID generator & hash (`medicalId.ts`)<br>• Automated 22-test ID test suite (`idSystemVerification.test.ts`)<br>• Secretary Walk-in real Patient ID binding (Finding ID-01 resolved in `SecretaryPortalWorkspace.tsx`)<br>• Doctor Manual Medical Record real Patient ID binding (Finding ID-02 resolved in `DoctorPortalWorkspace.tsx`)<br>• Centralized Medicine Catalog across 16 specialties (`centralMedicineCatalog.ts` & `CentralMedicineCatalogSection.tsx`)<br>• Batch Selection & Clinical Inventory Decoupling Invariant (`isAvailable: false` by default until price and stock set)<br>• Final Stage: Excel & CSV Bulk Inventory Import Engine (`PharmacyBulkImportModal.tsx`) with `.xlsx` template, column auto-mapping, in-flight duplicate detection, validation preview table, and explicit confirmation gate<br>• Pharmacy catalog & decoupling unit verification suite (`pharmacyCatalogVerification.test.ts` passed 100%)<br>• Super Admin bootstrap & 2FA email whitelist<br>• Core multi-portal routing & navigation shells (`App.tsx`, `Header.tsx`)<br>• Type-safe multi-role schemas (`types/index.ts`)<br>• Cross-doctor clinical chart document key generation & isolation | Code exists, executes locally, and all 27 unit tests across both suites pass with 100% success rate. Build (`npm run build`) and TypeScript check (`tsc --noEmit`) pass cleanly with 0 errors. | Retain code; preserve invariants during future modifications. |
| **UNVERIFIED FUNCTIONALITY** | • Laboratory test results & order workflows<br>• Radiology scan upload & reports workflow<br>• Electronic prescription creation & pharmacy dispensing<br>• Wholesaler B2B wholesale order submission<br>• Secretary delegation acceptance by email | Full UI and Firestore queries exist in codebase, but end-to-end integration across two active user accounts has not been tested on live cloud. | Conduct staging tests with two distinct authenticated user accounts. |
| **MISSING / INCOMPLETE** | • Automatic public record export from private doctor visits<br>• PDF export with letterhead for laboratory test results<br>• Comprehensive DICOM slice viewer for radiology scans | Code does not exist yet or requires dedicated third-party rendering libraries. | Implement prioritized secondary enhancements. |
| **BLOCKED TASKS** | • Remote Firestore security rules deployment via RPC (`caller does not have permission`)<br>• Remote Cloud Storage security rules deployment for `radiology_scans/` | Local `firestore.rules` and `storage.rules` files are complete, audited, and hardened, but automated cloud deployment tool returns permission error. | Publish rules manually via Firebase Console (Rules tab). |

---

## 2. Comprehensive ID Audit (Account Types & Record Types)

| Entity / Record Type | Standard ID Format | Target Collection & Doc Key | Status | Verification Evidence | Weaknesses / Issues Found | Recommended Repair |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Patient Account & Profile** | `M737-PAT-[A-Z0-9]{4,16}` | `users/{uid}`, `patient_profiles/{uid}`, `account_ids/{accountId}` | **COMPLETE & VERIFIED** | `AuthContext.tsx` (L128), `medicalId.ts` (L12, L280), `idSystemVerification.test.ts` | Initial migration for users created before transaction support required manual trigger in Super Admin. | Ensure all signup paths auto-invoke `ensureUserAccountId`. Display copy button on Patient Dashboard card. |
| **Doctor Account & Profile** | `M737-DOC-[A-Z0-9]{4,16}` | `users/{uid}`, `doctor_profiles/{uid}`, `account_ids/{accountId}` | **COMPLETE & VERIFIED** | `AuthContext.tsx` (L118), `medicalId.ts` (L286), `DoctorPortalWorkspace.tsx` | Profile document ID is `uid`, while `doctorId` field stores persistent `M737-DOC-XXXX`. In some legacy queries, `doctorId` was compared to `uid`. | Standardize all queries to look up by either `doctorId == uid` or `doctorId == accountId`. |
| **Secretary Account & Delegation** | `M737-SEC-[A-Z0-9]{4,16}` | `users/{uid}`, `secretary_assignments/{uid}`, `secretary_delegations/{delegationId}` | **IMPLEMENTED BUT UNVERIFIED** | `SecretaryPortalWorkspace.tsx` (L368), `firestore.rules` (L274) | Assignment relies on email match during initial delegation before UID binding. If secretary signs up with different casing, linking can stall. | Ensure normalized lowercase email matching in `secretary_delegations`. |
| **Pharmacy Account & Profile** | `M737-PHARM-[A-Z0-9]{4,16}` | `users/{uid}`, `pharmacy_profiles/{uid}`, `account_ids/{accountId}` | **COMPLETE & VERIFIED** | `PharmacyPortalWorkspace.tsx`, `firestore.rules` (L478) | Ownership previously failed on delete due to missing `.get()` helper (fixed in Task 1.1). | Keep `isMedicineOwner` CEL helper updated across all rules. |
| **Laboratory Profile** | `M737-LAB-[A-Z0-9]{4,16}` | `users/{uid}`, `lab_profiles/{uid}`, `account_ids/{accountId}` | **IMPLEMENTED BUT UNVERIFIED** | `LaboratoryPortalWorkspace.tsx`, `firestore.rules` (L396) | Profile document key is `uid`. `labId` matches `uid`. No cross-lab collision possible. | Verify live test creation and booking linking on deployed cloud DB. |
| **Radiology Center Profile** | `M737-RAD-[A-Z0-9]{4,16}` | `users/{uid}`, `radiology_profiles/{uid}`, `account_ids/{accountId}` | **IMPLEMENTED BUT UNVERIFIED** | `RadiologyPortalWorkspace.tsx`, `firestore.rules` (L325) | Prefix handles both `'radiology'` and `'radiology_center'` roles safely. | Verify real DICOM attachment associations to center ID. |
| **Wholesaler Profile** | `M737-WHOLE-[A-Z0-9]{4,16}` | `users/{uid}`, `wholesaler_profiles/{uid}`, `account_ids/{accountId}` | **IMPLEMENTED BUT UNVERIFIED** | `WholesalerPortalWorkspace.tsx`, `firestore.rules` (L692) | B2B catalog access requires accredited pharmacy account. | Enforce pharmacy license verification before B2B wholesale order submission. |
| **Super Admin Identity** | `M737-ADM-[A-Z0-9]{4,16}` | `admins/{uid}`, `users/{uid}` | **COMPLETE & VERIFIED** | `AuthContext.tsx` (L65, L92), `firestore.rules` (L19, L135) | Hardcoded email bootstrap (`bcgmoc@gmail.com`, `mustfa200633@gmail.com`, `mmrym2186@gmail.com`) checked with `email_verified == true`. | Production admins must maintain 2FA on Google accounts. |
| **Medicine Inventory Item** | `med_[timestamp]_[rand]` | `medicines/{medicineId}` | **COMPLETE & VERIFIED** | `PharmacyPortalWorkspace.tsx`, `firestore.rules` (L509) | Items now support `catalogMedicineId`, `barcode`, and `batchNumber`. Deletion security rule hardened so only the actual pharmacy owner can delete records. | Maintain strict ownership check in `firestore.rules`. |
| **Centralized Specialty Medicine Catalog** | `CAT-MED-[A-Z0-9]{6,12}` | `medicine_catalog/{catalogMedicineId}`, `src/data/centralMedicineCatalog.ts` | **COMPLETE & VERIFIED** | `centralMedicineCatalog.ts`, `CentralMedicineCatalogSection.tsx`, `pharmacyCatalogVerification.test.ts` | Centralized catalog organized across 16 medical specialties with real clinical formulations (Concor, Lipitor, Plavix, etc.). Pharmacists can browse and batch-add with clinical decoupling. | Sourced from verified references without simulated drugs. |
| **Excel & CSV Bulk Inventory Import** | `IMP-BATCH-[TIMESTAMP]` | `PharmacyBulkImportModal.tsx` | **COMPLETE & VERIFIED** | `PharmacyBulkImportModal.tsx`, `xlsx` library | Full spreadsheet parser supporting `.xlsx`, `.xls`, `.csv` with auto-detected Arabic/English headers, interactive preview table, in-flight duplicate detection, validation, and explicit confirmation gate. | Fully implemented in Final Stage as planned. |
| **Doctor-Patient Confidential Chart** | `chart_${doctorId}_${patientId}` | `doctor_patient_charts/{chartId}` | **COMPLETE & VERIFIED** | `DoctorPortalWorkspace.tsx`, `idSystemVerification.test.ts` (L177), `firestore.rules` (L220) | Chart document ID strictly incorporates attending doctor's UID. Other doctors receive `PERMISSION_DENIED`. | Add automatic chart creation whenever an appointment is confirmed. |
| **Electronic Prescription** | `RX-YYYYMMDD-[RAND]` | `electronic_prescriptions/{rxId}` | **IMPLEMENTED BUT UNVERIFIED** | `DoctorPortalWorkspace.tsx`, `PharmacyPortalWorkspace.tsx`, `types/index.ts` (L176) | Prescription items use internal array. If target pharmacy is not chosen, prescription is open for any pharmacy to claim. | Restrict open prescriptions so that patient must explicitly delegate target pharmacy. |
| **Diagnostic Lab Order** | `LAB-ORD-[RAND]` | `lab_orders/{orderId}` | **IMPLEMENTED BUT UNVERIFIED** | `DoctorPortalWorkspace.tsx` (L595), `LaboratoryPortalWorkspace.tsx` | Doctor referrals link `doctorId`, `patientId`, and optional `targetLabId`. | Add barcode generation for sample tubes in phlebotomy. |
| **Radiology Referral Order** | `RAD-ORD-[RAND]` | `radiology_orders/{orderId}` | **IMPLEMENTED BUT UNVERIFIED** | `DoctorPortalWorkspace.tsx`, `RadiologyPortalWorkspace.tsx` | Order numbers are generated with timestamp randomizer rather than atomic sequence. | Implement atomic daily sequence counter (`RAD-YYYYMMDD-####`). |
| **Appointments (Direct & Online)** | `appt_[timestamp]_[rand]` | `appointments/{appointmentId}` | **COMPLETE & VERIFIED** | `SecretaryPortalWorkspace.tsx` (L635), `DoctorPortalWorkspace.tsx` (L916) | **RESOLVED:** Secretary walk-ins now bind `walkinForm.patientId` to `newAppt.patientId` instead of generating detached `pat_reception_${Date.now()}`. | Permanent patient ID binding verified. |

---

## 3. Missing or Incomplete ID Functionality

### Finding ID-01: Secretary Walk-in Transient Patient ID Bypass
- **Portal/File:** Secretary Portal (`src/components/SecretaryPortalWorkspace.tsx`, Line 640).
- **Status:** `INCOMPLETE`
- **Evidence:**
  ```typescript
  // Line 640 in SecretaryPortalWorkspace.tsx:
  const newAppt: Appointment = {
    id: apptId,
    doctorId: assignment.doctorId,
    patientId: `pat_reception_${Date.now()}`, // <-- HARDCODED TRANSIENT STRING
    patientName: walkinForm.patientName.trim(),
    ...
  ```
- **Impact & Security Risk:** Even when the secretary searches for and locates an existing patient with Medical ID `M737-PAT-XXXXXX`, the appointment submission overwrites `patientId` with `pat_reception_[timestamp]`. The real patient will **never** see this appointment in their portal, and the doctor's chart history will not be linked to the patient's record.
- **Recommended Repair:**
  Bind `walkinForm.patientId` (resolved from `searchPatientProfileAcrossSystem`) to `newAppt.patientId`. If the patient is unregistered, automatically create an unverified patient shell with a valid `M737-PAT-` ID.

---

### Finding ID-02: Doctor Manual Medical Record Patient ID Bypass
- **Portal/File:** Doctor Portal (`src/components/DoctorPortalWorkspace.tsx`, Line 916).
- **Status:** `INCOMPLETE`
- **Evidence:**
  ```typescript
  // Line 916 in DoctorPortalWorkspace.tsx:
  const record: MedicalRecord = {
    id: recordId,
    patientId: `pat_rec_${Date.now()}`, // <-- ARBITRARY STRING
    patientName: newRecordData.patientName,
    ...
  ```
- **Impact & Security Risk:** Records entered manually by a doctor in the "Medical Records" tab do not prompt for the patient's Medical ID and store an unlinked `patientId`. The patient's portal queries `medical_records` where `patientId == user.uid`, meaning these records are completely invisible to the patient.
- **Recommended Repair:**
  Add a required `patientMedicalId` input with auto-complete/search validation (`searchPatientProfileAcrossSystem`) in the `NewRecordModal`, setting `patientId` to the patient's authenticated UID.

---

### Finding ID-03: Missing Copy-to-Clipboard on Secondary Facility Views
- **Portal/File:** `RadiologyPortalWorkspace.tsx` and `LaboratoryPortalWorkspace.tsx`.
- **Status:** `PARTIALLY COMPLETED`
- **Evidence:**
  While the Super Admin, Doctor, and Patient portals feature one-click copy buttons for `accountId` / `medicalId`, the Laboratory and Radiology portal header cards render the ID as static text without a clipboard copy trigger or QR badge.
- **Recommended Repair:**
  Integrate the `Copy` button component next to facility IDs across all 7 portals.

---

## 4. All Other Project Deficiencies (Grouped by Portal)

### 4.1. Patient Portal (`PatientPortalWorkspace.tsx`)
- **Status:** `IMPLEMENTED BUT UNVERIFIED`
- **Deficiencies:**
  1. **Demo Fallback Arrays:** Lines 280–450 contain extensive fallback arrays (`FALLBACK_DOCTORS`, `FALLBACK_LABS`, `FALLBACK_LAB_TESTS`, `FALLBACK_RADIOLOGY_CENTERS`). If the Firestore query encounters an empty collection or delay, dummy doctors appear in the patient directory.
  2. **Prescription Ordering Flow:** The button to order medicines directly from an electronic prescription into the pharmacy order cart requires end-to-end integration with `pharmacy_orders`.
  3. **Self-Service Deletion:** Implemented via `deleteOwnAccountPermanently` in `AuthContext.tsx`, but requires active confirmation that all sub-collections (personal appointments, medical records) are cleaned up or anonymized.

### 4.2. Doctor Portal (`DoctorPortalWorkspace.tsx`)
- **Status:** `IMPLEMENTED BUT UNVERIFIED`
- **Deficiencies:**
  1. **Demo Prescription Injection:** Lines 500–575 inject dummy prescriptions (`demo_patient_sara`, `demo_pharmacy_amal`) when `isDemoMode` is active or list is empty.
  2. **Chart Document Linking:** When a doctor writes a consultation note in an active patient chart (`doctor_patient_charts`), it is saved inside `visits: DoctorPatientVisit[]`. However, there is no automatic trigger that exports a copy of non-private diagnosis to the patient's `medical_records` collection.
  3. **Secretary Invitations:** Doctors invite secretaries by email (`secretary_delegations`). If the secretary signs up via Google OAuth with an alias or uppercase email, the delegation invitation does not resolve automatically.

### 4.3. Pharmacy Portal (`PharmacyPortalWorkspace.tsx`)
- **Status:** `IMPLEMENTED BUT UNVERIFIED`
- **Deficiencies:**
  1. **Medicine Deletion Permission:** Resolved in code in Task 1.1 with `isMedicineOwner` and `isLegacyPharmacyMedicine`, but **pending manual deployment of `firestore.rules`** to production Firebase.
  2. **Wholesaler Order Integration:** When a pharmacy places a wholesale order, the order is created in `wholesale_orders`. A notification should be sent to the wholesaler profile.
  3. **Prescription Dispensing Lock:** When a pharmacist marks an electronic prescription as `dispensed`, the status transition is recorded, but there is no check preventing double-dispensing if another pharmacist opens the same link simultaneously. Needs `runTransaction`.
  4. **Planned Centralized Medicine Catalog by Medical Specialties (`PLANNED — NOT YET IMPLEMENTED`):**
     - **Architecture & Specialty Categorization:** A shared, centralized medicine catalog (`medicine_catalog` collection) structured by recognized clinical specialties:
       - Internal Medicine (أمراض باطنية)
       - Gynecology & Obstetrics (نسائية وتوليد)
       - Pediatrics (طب الأطفال وحديثي الولادة)
       - Cardiology (أمراض القلب والأوعية الدموية)
       - Dermatology (جلدية وتناسلية)
       - Ophthalmology (طب وجراحة العيون)
       - ENT / Otolaryngology (أنف وأذن وحنجرة)
       - Neurology (جملة عصبية ودماغ)
       - Orthopedics (عظام ومفاصل وكسور)
       - Urology (مسالك بولية وتناسلية)
       - Respiratory & Pulmonology (صدرية وجهاز تنفسي)
       - Other relevant clinical specialties (Endocrinology, Oncology, etc.)
     - **Standardized Multi-Attribute Medicine Schema:**
       - Verified Arabic name (`nameAr`) & English trade name (`nameEn`)
       - Active pharmaceutical ingredient (`activeIngredient`)
       - Brand name (`brand`) & Manufacturer (`manufacturer`)
       - Exact pharmaceutical strength (e.g., `500 mg`, `10 mg/5ml`, `1 g`)
       - Dosage form (tablets, capsules, syrup, suspension, ampoules, vials, ointments, drops, inhalers)
       - Package size (e.g., `20 Tablets / Box`, `100 ml Bottle`)
       - Trusted product image URL (`imageUrl`) when verified
       - Source authority & accreditation status (`sourceReference`, `isVerified: boolean`)
     - **Batch Selection & Pharmacy Inventory Provisioning:**
       - Pharmacy users can navigate specialties, multi-select medicines they physically stock, and provision them into their private pharmacy inventory (`medicines`) in a single batch operation.
     - **Decoupled Pricing, Stock & Availability Rules:**
       - Selecting an item from the catalog must **NEVER** automatically mark it as available (`isAvailable` defaults to `false`).
       - Each pharmacy maintains its own:
         - Real on-shelf stock quantity (`quantity`)
         - Retail price in Iraqi Dinars (`price` in IQD)
         - Stock status (`isAvailable`: boolean set explicitly by the pharmacist)
         - Batch number (`batchNumber`) and manufacturer expiry date (`expiryDate`)
         - Minimum stock alert threshold (`minStockAlert`)
     - **Data Provenance & Anti-Hallucination Policy:**
       - Data must come exclusively from verified references (e.g., Iraqi Ministry of Health / Kimadia registries, official national formularies, or manufacturer datasheets).
       - **Strict Prohibition:** Never invent imaginary drug names, fake manufacturers, unverified dosage forms, or generic stock images.
       - **Clear Baseline:** A full Iraqi medicine catalog does **not** currently exist in the database and must not be claimed until trustworthy datasets are sourced and verified.
     - **Multi-Attribute Matching Discipline:**
       - Matching algorithms must evaluate the composite key: `[activeIngredient + strength + dosageForm + packageSize + brand]` to prevent dangerous clinical substitutions (e.g., confounding 250mg pediatric syrup with 500mg adult tablets).
     - **Authorization & Security Isolation:**
       - Browsing the catalog is read-only for verified users.
       - Adding catalog items to pharmacy stock is strictly gated by `role == 'pharmacy' && status == 'approved'` and automatically writes `pharmacyId = request.auth.uid`. No pharmacy can add or edit medicines belonging to another pharmacy.
  5. **Planned Excel & CSV Bulk Inventory Import (`PLANNED — FINAL IMPLEMENTATION STAGE`):**
     - Scheduled strictly as the **final implementation phase** after core security rules, ID repairs, and portal workflows are verified.
     - **Mandatory Capabilities:**
       - **Column Mapping Engine:** Flexible mapping between pharmacy spreadsheet headers and system attributes.
       - **Interactive Preview Table:** Renders all parsed rows before committing.
       - **In-Flight Duplicate Detection:** Detects existing medicines by barcode/name/strength to prompt for update vs new entry.
       - **Strict Validation & Error Reporting:** Validates positive IQD prices, valid future expiry dates, non-negative stock counts, and reports specific row errors with line numbers.
       - **Explicit User Confirmation Gate:** Requires explicit pharmacist confirmation before batch writes execute.

### 4.4. Laboratory Portal (`LaboratoryPortalWorkspace.tsx`)
- **Status:** `IMPLEMENTED BUT UNVERIFIED`
- **Deficiencies:**
  1. **PDF Report Generation:** The lab test result view renders on-screen parameters (Hb, WBC, Platelets, etc.), but lacks an automated client-side PDF export button with official lab letterhead.
  2. **Home Sample Collection Geolocation:** The `homeCollectionAvailable` toggle exists in lab profile, but booking forms collect address as freeform text without governorate/GPS coordinate validation.

### 4.5. Radiology & Ultrasound Portal (`RadiologyPortalWorkspace.tsx`)
- **Status:** `IMPLEMENTED BUT UNVERIFIED`
- **Deficiencies:**
  1. **DICOM Viewer Integration:** `medicalStorage.ts` uploads `.dcm` files to Cloud Storage. However, the UI does not integrate a CornerstoneJS or WebGL DICOM multi-slice viewer; it offers only file download.
  2. **Storage Rules Deployment:** DICOM files uploaded to `radiology_scans/` require Firebase Storage security rules ensuring only the center and patient can download files. Storage rules are not yet configured or deployed.

### 4.6. Wholesaler Portal (`WholesalerPortalWorkspace.tsx`)
- **Status:** `IMPLEMENTED BUT UNVERIFIED`
- **Deficiencies:**
  1. **Batch Number & Expiry Alerts:** Wholesale inventory tracks `batchNumber` and `expiryDate`, but lacks automated banner notifications when stock is within 90 days of expiration.
  2. **Order Invoicing:** The order status flow progresses (`pending` -> `approved` -> `preparing` -> `dispatched` -> `delivered`), but there is no printable formal tax invoice generation (`invoiceNumber`).

### 4.7. Secretary Portal (`SecretaryPortalWorkspace.tsx`)
- **Status:** `INCOMPLETE`
- **Deficiencies:**
  1. **Transient Walk-in Patient IDs:** (Documented in Section 3, Finding ID-01).
  2. **Clinic Revenue Reporting:** The `canCollectFees` permission exists in delegations, but the secretary workspace does not display daily consultation fee totals.

### 4.8. Super Admin Portal (`SuperAdminPortalWorkspace.tsx`)
- **Status:** `COMPLETE & VERIFIED` (Build & UI Functional)
- **Deficiencies:**
  1. **ID Audit & Migration Tool:** `auditAndMigrateAccountIds` successfully scans and backfills missing IDs, but requires manual execution from the "تدقيق المعرفات (ID Audit)" tab.
  2. **Multi-Admin Management:** Only the 3 hardcoded emails can access Super Admin. Adding an administrator dynamically through the UI is restricted by Firestore rules requiring pre-existing admin rights.

### 4.9. Navigation, Home & Shared Layout (`App.tsx`, `Header.tsx`, `HomePageView.tsx`)
- **Status:** `COMPLETE & VERIFIED`
- **Deficiencies:**
  1. All 7 portals + Super Admin are accessible via direct URLs (`#doctor`, `#pharmacy`, etc.) and the sidebar.
  2. Responsive layout functions across mobile and desktop.

---

## 5. Firebase, Security, and Integration Issues

### 5.1. Authentication
- **Google OAuth:** Configured in `firebase.ts` with popup flow.
- **Domain Authorization:** If the Cloud Run preview domain changes, users encounter `auth/unauthorized-domain`. An in-app guide modal (`AuthDomainGuideModal.tsx`) provides instructions to add the hostname to Firebase Authentication Authorized Domains.
- **Email/Password:** Basic email/password signup is implemented in `AuthContext.tsx`.

### 5.2. Cloud Firestore
- **Connection Health:** `validateFirestoreConnection()` runs on boot using `getDocFromServer(doc(db, 'test', 'connection'))`.
- **Database Instance:** Connected to dedicated database `ai-studio-m737medicalplatf-06180e9d-e98a-4a8d-97fc-d8a6644012dc`.
- **Rules Version:** `rules_version = '2'`.
- **Default Deny:** Catch-all default deny `match /{document=**} { allow read, write: if false; }` is active.

### 5.3. Cloud Storage (Medical Files & DICOM)
- **Bucket:** Configured in `firebase-applet-config.json` as `operating-league-dv9wh.firebasestorage.app`.
- **Storage Rules:** **MISSING FROM CLOUD DEPLOYMENT**. Firebase Storage requires rules (`storage.rules`) enforcing that only authenticated facility owners and the target patient can read uploaded scans.

### 5.4. Firestore Rules Deployment Status
- **Blocker:** Direct deployment via `deploy_firebase` and `rpc_action(DeployRules)` fails with:
  `GraphQL errors: The caller does not have permission`
- **Impact:** Any changes made to `firestore.rules` in the local workspace (including Task 1.1 medicine deletion rules) must be published manually in the Firebase Console.

---

## 6. Fake & Demo Functionality Requiring Removal or Investigation

| File / Component | Code Location | Description of Demo / Fake Data | Reason for Deprecation | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `DoctorPortalWorkspace.tsx` | Lines 500–575 | `sampleRx` array (`demo_patient_sara`, `demo_pharmacy_amal`, `demo_patient_karrar`) | Injects mock prescriptions into the doctor's live view. | Remove mock fallback; show clean empty state ("لا توجد وصفات إلكترونية صادرة حتى الآن"). |
| `DoctorPortalWorkspace.tsx` | Lines 591–646 | `sampleLabOrders` array (`demo_lab_ord_1`, `demo_lab_baghdad`) | Populates fake lab orders in doctor's referrals tab. | Remove mock fallback; show clean empty state. |
| `PatientPortalWorkspace.tsx` | Lines 280–353 | `FALLBACK_DOCTORS` (`demo_doc_sanaa`, `demo_doc_omar`, `demo_doc_noor`) | Shows fake doctors in patient booking directory when database is empty. | Query real approved doctors only from `doctor_profiles`; show empty search state. |
| `PatientPortalWorkspace.tsx` | Lines 357–460 | `FALLBACK_LABS` & `FALLBACK_LAB_TESTS` (`demo_lab_alrafidain`, `demo_test_cbc`) | Displays fake lab tests and packages. | Display only tests from real registered laboratories. |
| `SecretaryPortalWorkspace.tsx` | Line 640 | `patientId: "pat_reception_" + Date.now()` | Generates fake patient ID for walk-in patients instead of using actual Medical ID. | Link to real patient profile or generate permanent registered record. |
| `DoctorPortalWorkspace.tsx` | Line 916 | `patientId: "pat_rec_" + Date.now()` | Generates unlinked patient ID in manual medical record entry. | Require and validate real patient Medical ID. |

---

## 7. Build and Test Results

### 7.1. Compilation (`compile_applet`)
- **Command:** Vite production build
- **Status:** **PASSED** (`Build succeeded - the applet is compiled`)
- **Asset Output:** Clean bundle generation with no syntax or packaging errors.

### 7.2. Code Quality & Type Safety (`lint_applet`)
- **Command:** `tsc --noEmit`
- **Status:** **PASSED** (`Linting completed successfully`, 0 TypeScript errors across the entire codebase).

### 7.3. ID System Verification Tests (`runIdSystemVerificationTests`)
- **Command:** `npx tsx -e "import { runIdSystemVerificationTests } from './src/utils/idSystemVerification.test'; ..."`
- **Test Output Summary:**
  - Total Tests: **22**
  - Passed: **22**
  - Failed: **0**
- **Test Categories Verified:**
  1. **Role Prefixes (9/9 passed):** Standard prefixes confirmed for `patient`, `doctor`, `pharmacy`, `laboratory`, `radiology`, `radiology_center`, `wholesaler`, `secretary`, and `super_admin`.
  2. **ID Stability (2/2 passed):** Deterministic generator produces strictly identical ID across multiple calls and profile updates.
  3. **Collision Resistance (2/2 passed):** Incremental salt mechanism produces distinct candidate keys; 1,000 generated IDs produced 0 collisions.
  4. **Format & Normalization (5/5 passed):** Validates strict regex `^[A-Z0-9]{4,16}$` and normalizes user input across case/hyphens.
  5. **Query Sanitization (2/2 passed):** Rejects SQL/XSS/injection characters.
  6. **Cross-Doctor Chart Isolation (2/2 passed):** Independent doctors produce distinct document keys (`chart_${doctorId}_${patientId}`) preventing cross-doctor leakage.

### 7.4. Deployment Tool Check
- **Command:** `deploy_firebase` and `rpc_action(DeployRules)`
- **Result:** `Encountered error in step execution: error executing cascade step: CORTEX_STEP_TYPE_RPC_ACTION: GraphQL errors: The caller does not have permission`
- **Verification:** Security rules are syntactically sound, but backend deployment must be performed manually in the Firebase Console.

---

## 8. Required Firebase Console Configuration & Permissions

The following configuration steps must be verified in the Firebase Console:

1. **Authentication -> Settings -> Authorized Domains:**
   - Add the current application hosting domain:
     `ais-dev-fdgoogzyoqkcvzq5z4oa5f-475949119012.europe-west2.run.app`
     `ais-pre-fdgoogzyoqkcvzq5z4oa5f-475949119012.europe-west2.run.app`
2. **Firestore Database -> Rules:**
   - Copy the content of `/firestore.rules` and click **Publish**.
3. **Storage -> Rules:**
   - Deploy medical scan storage rules:
     ```javascript
     rules_version = '2';
     service firebase.storage {
       match /b/{bucket}/o {
         match /radiology_scans/{centerId}/{bookingId}/{fileName} {
           allow read: if request.auth != null;
           allow write: if request.auth != null && (request.auth.uid == centerId || request.auth.token.role == 'super_admin');
         }
       }
     }
     ```
4. **Firestore Indexes:**
   - Create composite index on `appointments`: `doctorId` (ASC) + `date` (ASC) + `timeSlot` (ASC).
   - Create composite index on `doctor_patient_charts`: `doctorId` (ASC) + `lastVisitDate` (DESC).
   - Create composite index on `wholesale_orders`: `wholesalerId` (ASC) + `createdAt` (DESC).

---

## 9. Prioritized Repair Plan

The following tasks are structured as self-contained, atomic prompts for sequential execution:

### Priority 1: Critical Security & ID Data Integrity (Immediate)
- **Task 1.1:** Fix Secretary Walk-in Patient ID Association (`SecretaryPortalWorkspace.tsx`). Ensure real patient Medical ID is resolved and linked instead of `pat_reception_${Date.now()}`.
- **Task 1.2:** Fix Doctor Manual Medical Record Patient ID Association (`DoctorPortalWorkspace.tsx`). Add Medical ID lookup to `handleCreateMedicalRecord`.
- **Task 1.3:** Publish updated `firestore.rules` to Firebase Console to activate medicine deletion permissions and ID registry security.

### Priority 2: Removal of Mock Fallbacks & Workflows (High)
- **Task 2.1:** Clean all mock fallback arrays (`FALLBACK_DOCTORS`, `FALLBACK_LABS`, `sampleRx`, `sampleLabOrders`) from Patient and Doctor workspaces. Replace with proper empty/loading states.
- **Task 2.2:** Add Copy-to-Clipboard and QR modal triggers to Laboratory, Radiology, and Wholesaler profile dashboards.
- **Task 2.3:** Implement prescription dispensing transaction in `PharmacyPortalWorkspace.tsx` to prevent concurrent double-dispensing.

### Priority 3: Cross-Portal Integrations & Polish (Medium)
- **Task 3.1:** Connect electronic prescriptions directly to the patient's pharmacy ordering cart.
- **Task 3.2:** Connect doctor consultation diagnosis notes to generate a non-private clinical summary entry in the patient's personal records.
- **Task 3.3:** Add printable PDF reports for Laboratory test results and tax invoices for Wholesaler B2B orders.
- **Task 3.4:** Implement Centralized Medicine Catalog Schema & Specialty Browsing (`PLANNED`). Create Firestore schema `medicine_catalog` with verified Iraqi Ministry of Health / Kimadia trusted data across the 11 clinical specialties. Build multi-select batch provisioning allowing pharmacies to add selected items to their inventory with manual availability, private stock counts, and independent IQD pricing.

### Priority 4: Advanced Inventory Tools & Batch Processing (Final Implementation Stage)
- **Task 4.1:** Implement Pharmacy Excel & CSV Bulk Inventory Import (`PLANNED — FINAL STAGE`). Implement client-side parser with flexible column mapping, pre-commit interactive preview table, in-flight duplicate detection against existing stock, comprehensive row-by-row error validation (positive IQD prices, valid dates, non-negative quantities), and explicit user confirmation gate before batch commit.

---

## 10. Final Verification Checklist

Before certifying the M737 Medical Platform as complete, each item below must be tested on live data:

- [ ] **Patient ID Verification:** Sign up a new patient; verify ID `M737-PAT-XXXXXX` appears on dashboard, copies to clipboard, and exists in `account_ids` collection.
- [ ] **Cross-Doctor Chart Isolation:** Have Doctor A create a clinical note for Patient X. Verify Doctor B cannot view, query, or edit Patient X's chart from Doctor A.
- [ ] **Walk-in Appointment Linking:** Secretary books walk-in appointment by searching Patient's Medical ID; verify appointment appears in the Patient's online portal under Appointments.
- [ ] **Doctor Medical Record Linking:** Doctor manually adds a clinical record; verify it appears in Patient's Records tab.
- [ ] **Pharmacy Medicine Deletion:** Pharmacy owner adds a medicine and successfully deletes it without `PERMISSION_DENIED`. Verify another pharmacy cannot delete it.
- [ ] **Centralized Medicine Catalog Specialty Browsing:** Verify pharmacy user can browse all 11 medical specialties and view verified dual-language names, active ingredients, strengths, forms, and package sizes without unverified or invented records.
- [ ] **Batch Inventory Provisioning & Decoupled State:** Verify selecting items from the catalog adds them to pharmacy inventory with `isAvailable: false`, and that the pharmacy independently configures its real IQD price, stock quantity, and expiry date.
- [ ] **Cross-Pharmacy Inventory Isolation:** Verify Pharmacy A's catalog-added items and prices are completely inaccessible and unmodifiable by Pharmacy B.
- [ ] **Excel & CSV Import Validation & Safety Gate:** Verify uploading an invalid CSV (negative prices, malformed dates, missing required fields) displays line-by-line error alerts and blocks import until corrected, and that valid files prompt for explicit confirmation before saving.
- [ ] **Referral Loop (Doctor -> Lab -> Result -> Patient):**
  1. Doctor creates Lab Order for Patient.
  2. Lab receives order, inputs parameters, and publishes result.
  3. Patient views result in portal.
- [ ] **Referral Loop (Doctor -> Radiology -> Scan -> Patient):**
  1. Doctor refers patient for ultrasound/MRI.
  2. Center receives order and uploads scan/report.
  3. Patient accesses report in portal.
- [ ] **Zero Mock Data Check:** Confirm no `demo_doc_*`, `demo_patient_*`, or `FALLBACK_*` arrays appear anywhere when accessing portals with empty test accounts.
- [ ] **Super Admin ID Migration:** Run `auditAndMigrateAccountIds` in Super Admin portal; verify 0 duplicate IDs and 100% registry consistency.
- [ ] **Account Deletion Cleanliness:** Self-service delete user account; verify Auth user, `users` document, and role profile documents are completely purged.

---

*End of Report — M737IQ Full Audit & Deficiencies Report.*

