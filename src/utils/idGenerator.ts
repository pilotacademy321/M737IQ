/**
 * M737IQ Standard Identifier Utilities
 * Ensures immutable, standard, and secure IDs across all healthcare entities.
 */

export const generatePatientMedicalId = (uid: string): string => {
  if (!uid) {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `M737-PAT-${randomHex}`;
  }
  // Deterministic 6-character identifier based on patient UID
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  const padded = clean.padEnd(6, 'X');
  return `M737-PAT-${padded}`;
};

export const generateDocumentId = (prefix: 'med' | 'pord' | 'word' | 'apt' | 'lbook' | 'rbook' | 'mrec' | 'notif' | 'cat'): string => {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}_${rand}`;
};

export const isValidMedicalId = (id: string): boolean => {
  return /^M737-PAT-[A-Z0-9]{6}$/.test(id);
};
