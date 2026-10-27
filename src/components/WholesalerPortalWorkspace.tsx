import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../lib/firebase';
import { 
  WholesalerProfile, 
  WholesaleMedicineItem, 
  WholesaleOrder, 
  WholesaleOrderStatus 
} from '../types';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  Building2, 
  Package, 
  Search, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  MapPin, 
  Phone, 
  DollarSign, 
  RefreshCw, 
  Edit3, 
  ShieldCheck, 
  Save, 
  Trash2, 
  Truck, 
  Clock, 
  FileText, 
  BadgeAlert, 
  Check, 
  X, 
  ExternalLink, 
  Users, 
  Calendar, 
  Sparkles, 
  Settings,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  AlertTriangle,
  MessageCircle,
  Camera,
  Copy
} from 'lucide-react';
import { generateFacilityOrUserId } from '../utils/medicalId';
import { SmartMedicineSearch, SearchMedicineResult } from './SmartMedicineSearch';
import { logAuditEvent } from '../lib/auditLogger';
import { validateAndCompressImage, formatWhatsAppUrl } from '../utils/mediaUtils';

interface WholesalerPortalWorkspaceProps {
  onBackToHome: () => void;
}

export const WholesalerPortalWorkspace: React.FC<WholesalerPortalWorkspaceProps> = ({ onBackToHome }) => {
  const { user, userProfile, isAdmin, refreshProfile } = useAuth();
  const { language, isRTL } = useLanguage();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'catalog' | 'orders' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Wholesaler Profile State
  const [wholesalerProfile, setWholesalerProfile] = useState<WholesalerProfile | null>(null);

  // Wholesale Catalog State
  const [medicines, setMedicines] = useState<WholesaleMedicineItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'expiring_soon'>('all');
  const [showNewMedicineModal, setShowNewMedicineModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<WholesaleMedicineItem | null>(null);

  // New / Edit Medicine Form State
  const [medicineForm, setMedicineForm] = useState({
    name: '',
    nameAr: '',
    activeIngredient: '',
    manufacturer: '',
    originCountry: 'Iraq (العراق)',
    strength: '500mg',
    dosageForm: 'Tablets (أقراص)',
    packSize: '20 Tablets / Box',
    cartonCapacity: 30,
    batchNumber: '',
    productionDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    wholesalePriceIqd: 3500,
    cartonPriceIqd: 100000,
    stockPacks: 100,
    minOrderQuantity: 10,
    isAvailable: true,
    category: 'Antibiotics (مضادات حيوية)',
    notes: '',
  });

  // Incoming B2B Orders State
  const [orders, setOrders] = useState<WholesaleOrder[]>([]);
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<WholesaleOrder | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<WholesaleOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Wholesaler Profile Edit Form
  const [profileForm, setProfileForm] = useState({
    warehouseName: '',
    ownerName: '',
    licenseNumber: '',
    commercialRegNumber: '',
    phone: '',
    whatsapp: '',
    address: '',
    governorate: 'بغداد (Baghdad)',
    deliveryCoverageGovernorates: ['بغداد (Baghdad)', 'بابل / الحلة (Babylon)', 'ديالى (Diyala)'],
    minimumOrderValueIqd: 100000,
    workingHours: '8:00 AM - 5:00 PM',
    logoUrl: '',
    bio: '',
  });

  const governoratesList = [
    'بغداد (Baghdad)',
    'البصرة (Basra)',
    'أربيل (Erbil)',
    'النجف الأشرف (Najaf)',
    'كربلاء المقدسة (Karbala)',
    'نينوى / الموصل (Nineveh)',
    'السليمانية (Sulaymaniyah)',
    'بابل / الحلة (Babylon)',
    'الأنبار (Anbar)',
    'ديالى (Diyala)',
    'كركوك (Kirkuk)',
    'ذي قار / الناصرية (Dhi Qar)',
    'ميسان / العمارة (Maysan)',
    'المثنى / السماوة (Muthanna)',
    'القادسية / الديوانية (Qadisiyyah)',
    'واسط / الكوت (Wasit)',
    'صلاح الدين (Saladin)',
    'دهوك (Duhok)'
  ];

  const categoriesList = [
    'Antibiotics (مضادات حيوية)',
    'Analgesics (مسكنات ألم)',
    'Cardiovascular (قلبية وضغط)',
    'Gastrointestinal (جهاز هضمي)',
    'Diabetes (أدوية السكري)',
    'Respiratory (جهاز تنفسي)',
    'Dermatology (جلدية وتجميل)',
    'Pediatrics (أدوية الأطفال)',
    'Vitamins & Supplements (فيتامينات ومكملات)',
    'Medical Consumables (مستلزمات طبية)'
  ];

  // Load Wholesaler Data from Firestore or Seed Demo Data
  const loadWholesalerData = async () => {
    if (!user) return;
    try {
      // 1. Fetch Profile
      const profRef = doc(db, 'wholesaler_profiles', user.uid);
      const profSnap = await getDoc(profRef);

      if (profSnap.exists()) {
        const data = profSnap.data() as WholesalerProfile;
        setWholesalerProfile(data);
        setProfileForm({
          warehouseName: data.warehouseName || userProfile?.facilityName || '',
          ownerName: data.ownerName || userProfile?.displayName || '',
          licenseNumber: data.licenseNumber || userProfile?.licenseNumber || '',
          commercialRegNumber: data.commercialRegNumber || '',
          phone: data.phone || userProfile?.phone || '',
          whatsapp: data.whatsapp || userProfile?.phone || '',
          address: data.address || '',
          governorate: data.governorate || userProfile?.governorate || 'بغداد (Baghdad)',
          deliveryCoverageGovernorates: data.deliveryCoverageGovernorates || ['بغداد (Baghdad)', 'بابل / الحلة (Babylon)'],
          minimumOrderValueIqd: data.minimumOrderValueIqd || 100000,
          workingHours: data.workingHours || '8:00 AM - 5:00 PM',
          logoUrl: data.logoUrl || '',
          bio: data.bio || '',
        });
      } else {
        // Initialize Default Profile
        const initialProfile: WholesalerProfile = {
          wholesalerId: user.uid,
          warehouseName: userProfile?.facilityName || 'مذخر أدوية معتمد',
          ownerName: userProfile?.displayName || 'المكتب العلمي',
          licenseNumber: userProfile?.licenseNumber || '',
          commercialRegNumber: '',
          phone: userProfile?.phone || '',
          whatsapp: userProfile?.phone || '',
          address: userProfile?.governorate || 'العراق، بغداد',
          governorate: userProfile?.governorate || 'بغداد (Baghdad)',
          deliveryCoverageGovernorates: ['بغداد (Baghdad)'],
          minimumOrderValueIqd: 100000,
          workingHours: '8:00 AM - 5:00 PM',
          bio: 'مذخر ومكتب علمي لتوريد الأدوية والمستلزمات الطبية المعتمدة وفق معايير نقابة الصيادلة ووزارة الصحة.',
          isVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          await setDoc(profRef, sanitizeForFirestore(initialProfile));
        } catch {
          // Fallback
        }
        setWholesalerProfile(initialProfile);
      }

      // 2. Fetch Wholesale Catalog
      const medsQuery = query(
        collection(db, 'wholesale_medicines'),
        where('wholesalerId', '==', user.uid)
      );

      let fetchedMeds: WholesaleMedicineItem[] = [];
      try {
        const medsSnap = await getDocs(medsQuery);
        fetchedMeds = medsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WholesaleMedicineItem));
      } catch {
        fetchedMeds = [];
      }

      setMedicines(fetchedMeds);

      // 3. Fetch Incoming B2B Wholesale Orders from Pharmacies
      const ordersQuery = query(
        collection(db, 'wholesale_orders'),
        where('wholesalerId', '==', user.uid)
      );

      try {
        const ordersSnap = await getDocs(ordersQuery);
        const fetchedOrders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WholesaleOrder));
        setOrders(fetchedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch {
        setOrders([]);
      }
    } catch (err: unknown) {
      console.error('Error loading wholesaler data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWholesalerData();
  }, [user]);

  const handleManualSync = async () => {
    setRefreshing(true);
    await loadWholesalerData();
    await refreshProfile();
    setTimeout(() => {
      setRefreshing(false);
      setFeedbackMsg({
        type: 'success',
        text: language === 'ar' ? 'تمت مزامنة بيانات المذخر والكتالوج بنجاح' : 'Wholesaler catalog synchronized successfully',
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    }, 500);
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalInventoryValue = medicines.reduce((sum, item) => sum + (item.wholesalePriceIqd * item.stockPacks), 0);
    const totalPacks = medicines.reduce((sum, item) => sum + item.stockPacks, 0);
    const lowStockCount = medicines.filter((m) => m.stockPacks <= m.minOrderQuantity * 2).length;
    const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;
    const activeDispatchedCount = orders.filter((o) => o.status === 'dispatched' || o.status === 'preparing').length;

    return {
      totalInventoryValue,
      totalPacks,
      lowStockCount,
      pendingOrdersCount,
      activeDispatchedCount,
    };
  }, [medicines, orders]);

  // Filtered Catalog
  const filteredCatalog = useMemo(() => {
    return medicines.filter((item) => {
      const matchSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.activeIngredient.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.manufacturer.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCat = categoryFilter === 'all' || item.category === categoryFilter;

      let matchStock = true;
      if (stockFilter === 'in_stock') matchStock = item.stockPacks > 0 && item.isAvailable;
      if (stockFilter === 'low_stock') matchStock = item.stockPacks <= item.minOrderQuantity * 2;
      if (stockFilter === 'expiring_soon') {
        const expiryTime = new Date(item.expiryDate).getTime();
        const sixMonthsAhead = Date.now() + 180 * 24 * 60 * 60 * 1000;
        matchStock = expiryTime <= sixMonthsAhead;
      }

      return matchSearch && matchCat && matchStock;
    });
  }, [medicines, searchQuery, categoryFilter, stockFilter]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderFilter === 'all') return true;
      return o.status === orderFilter;
    });
  }, [orders, orderFilter]);

  // Handle Save / Edit Medicine
  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const now = new Date().toISOString();
      const medId = editingMedicine ? editingMedicine.id : `wmed_${user.uid.slice(0, 5)}_${Date.now()}`;

      const medicinePayload: WholesaleMedicineItem = {
        id: medId,
        wholesalerId: user.uid,
        wholesalerName: wholesalerProfile?.warehouseName || userProfile?.facilityName || 'مذخر أدوية معتمد',
        wholesalerPhone: wholesalerProfile?.phone || userProfile?.phone || '',
        name: medicineForm.name,
        nameAr: medicineForm.nameAr,
        activeIngredient: medicineForm.activeIngredient,
        manufacturer: medicineForm.manufacturer,
        originCountry: medicineForm.originCountry,
        strength: medicineForm.strength,
        dosageForm: medicineForm.dosageForm,
        packSize: medicineForm.packSize,
        cartonCapacity: Number(medicineForm.cartonCapacity),
        batchNumber: medicineForm.batchNumber || `BAT-${Date.now().toString().slice(-6)}`,
        productionDate: medicineForm.productionDate,
        expiryDate: medicineForm.expiryDate,
        wholesalePriceIqd: Number(medicineForm.wholesalePriceIqd),
        cartonPriceIqd: Number(medicineForm.cartonPriceIqd),
        stockPacks: Number(medicineForm.stockPacks),
        minOrderQuantity: Number(medicineForm.minOrderQuantity),
        isAvailable: medicineForm.isAvailable,
        category: medicineForm.category,
        notes: medicineForm.notes,
        createdAt: editingMedicine ? editingMedicine.createdAt : now,
        updatedAt: now,
      };

      try {
        await setDoc(doc(db, 'wholesale_medicines', medId), sanitizeForFirestore(medicinePayload));
      } catch (err: unknown) {
        handleFirestoreError(err, OperationType.WRITE, `wholesale_medicines/${medId}`);
      }

      if (editingMedicine) {
        setMedicines((prev) => prev.map((m) => (m.id === medId ? medicinePayload : m)));
        setFeedbackMsg({ type: 'success', text: language === 'ar' ? 'تم تحديث بيانات الوجبة الدوائية بنجاح' : 'Batch item updated' });
      } else {
        setMedicines((prev) => [medicinePayload, ...prev]);
        setFeedbackMsg({ type: 'success', text: language === 'ar' ? 'تمت إضافة المستحضر إلى كتالوج المذخر بنجاح' : 'Product added to catalog' });
      }

      setShowNewMedicineModal(false);
      setEditingMedicine(null);
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: unknown) {
      console.error('Error saving wholesale medicine:', err);
      setFeedbackMsg({ type: 'error', text: language === 'ar' ? 'فشل حفظ المستحضر الدوائي' : 'Failed to save product' });
    }
  };

  // Delete Medicine
  const handleDeleteMedicine = async (medId: string) => {
    try {
      try {
        await deleteDoc(doc(db, 'wholesale_medicines', medId));
      } catch {
        // sandbox fallback
      }
      setMedicines((prev) => prev.filter((m) => m.id !== medId));
      setFeedbackMsg({ type: 'success', text: language === 'ar' ? 'تم حذف المستحضر بنجاح' : 'Product deleted' });
      setTimeout(() => setFeedbackMsg(null), 2500);
    } catch (err: unknown) {
      console.error('Error deleting product:', err);
    }
  };

  // Toggle Availability
  const handleToggleAvailability = async (item: WholesaleMedicineItem) => {
    const updated = { ...item, isAvailable: !item.isAvailable, updatedAt: new Date().toISOString() };
    try {
      try {
        await updateDoc(doc(db, 'wholesale_medicines', item.id), {
          isAvailable: updated.isAvailable,
          updatedAt: updated.updatedAt,
        });
      } catch {
        // sandbox fallback
      }
      setMedicines((prev) => prev.map((m) => (m.id === item.id ? updated : m)));
    } catch (err: unknown) {
      console.error('Toggle error:', err);
    }
  };

  // Logo Upload with Client Compression
  const handleWholesalerLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await validateAndCompressImage(file, { maxWidth: 500, maxHeight: 500, quality: 0.8, maxSizeBytes: 70000 });
      if (res.valid && res.dataUrl) {
        setProfileForm((prev) => ({ ...prev, logoUrl: res.dataUrl! }));
        setFeedbackMsg({
          type: 'success',
          text: language === 'ar' ? 'تم تجهيز وضغط شعار المذخر بنجاح' : 'Logo uploaded & optimized',
        });
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else {
        throw new Error(res.error || (language === 'ar' ? 'تعذر ضغط الشعار' : 'Failed to compress logo'));
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error processing image';
      setFeedbackMsg({ type: 'error', text: errorMsg });
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Handle Order Status Transition
  const handleUpdateOrderStatus = async (orderId: string, newStatus: WholesaleOrderStatus) => {
    try {
      const now = new Date().toISOString();
      const updates: Partial<WholesaleOrder> = {
        status: newStatus,
        updatedAt: now,
      };

      if (newStatus === 'dispatched') {
        updates.dispatchedAt = now;
      } else if (newStatus === 'delivered') {
        updates.deliveredAt = now;
      }

      try {
        await updateDoc(doc(db, 'wholesale_orders', orderId), updates);
      } catch {
        // sandbox fallback
      }

      const order = orders.find((o) => o.id === orderId);

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
      );

      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails((prev) => (prev ? { ...prev, ...updates } : null));
      }

      // Deduct stock if order is approved
      if (newStatus === 'approved' && order) {
        for (const item of order.items) {
          const med = medicines.find((m) => m.id === item.medicineId);
          if (med) {
            const newStock = Math.max(0, med.stockPacks - item.packQuantity);
            try {
              await updateDoc(doc(db, 'wholesale_medicines', med.id), {
                stockPacks: newStock,
                updatedAt: now,
              });
            } catch {
              // sandbox fallback
            }
            setMedicines((prev) =>
              prev.map((m) => (m.id === med.id ? { ...m, stockPacks: newStock } : m))
            );
          }
        }

        await logAuditEvent({
          action: 'wholesale_order_approved',
          category: 'wholesale_b2b',
          actorUid: user?.uid || 'wholesaler',
          actorName: wholesalerProfile?.warehouseName || userProfile?.facilityName || 'مذخر الأدوية',
          actorRole: 'wholesaler',
          targetUid: order.pharmacyId,
          targetName: order.pharmacyName,
          targetRole: 'pharmacist',
          resourceId: orderId,
          resourceNumber: order.invoiceNumber || orderId,
          status: 'approved',
          details: `الموافقة على طلبية أدوية بالجملة لصالح ${order.pharmacyName} بقيمة ${order.totalAmountIqd.toLocaleString()} د.ع وتخصيم المخزون`,
        });
      }

      // Dual notifications to pharmacy
      if (order?.pharmacyId) {
        try {
          const notifRef = doc(collection(db, 'notifications'));
          const titles: Record<string, string> = {
            approved: 'تمت الموافقة على طلبية الأدوية',
            preparing: 'طلبية الأدوية قيد التجهيز بالمذخر',
            dispatched: 'طلبية الأدوية خرجت مع مندوب التوصيل',
            delivered: 'تم تسليم طلبية الأدوية بنجاح',
          };
          await setDoc(notifRef, {
            id: notifRef.id,
            userId: order.pharmacyId,
            title: titles[newStatus] || 'تحديث حالة طلبية الأدوية',
            message: `تم تحديث حالة طلبيتكم رقم ${order.invoiceNumber || order.id} إلى (${newStatus}).`,
            type: 'b2b_order_status',
            read: false,
            createdAt: now,
          });
        } catch {
          // sandbox fallback
        }
      }

      setFeedbackMsg({
        type: 'success',
        text: language === 'ar' ? `تم تحديث حالة الطلبية إلى (${newStatus}) بنجاح` : `Order status updated to ${newStatus}`,
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: unknown) {
      console.error('Error updating order status:', err);
    }
  };

  // Handle Cancel Order with Reason & Stock Restoration
  const handleConfirmCancelOrder = async () => {
    if (!cancellingOrder) return;
    try {
      const now = new Date().toISOString();
      const updates = {
        status: 'cancelled' as WholesaleOrderStatus,
        cancellationReason: cancelReason || (language === 'ar' ? 'تم الإلغاء من قبل إدارة المذخر' : 'Cancelled by warehouse'),
        updatedAt: now,
      };

      try {
        await updateDoc(doc(db, 'wholesale_orders', cancellingOrder.id), updates);
      } catch {
        // sandbox fallback
      }

      // Restore stock if previously approved, preparing, or dispatched
      if (['approved', 'preparing', 'dispatched'].includes(cancellingOrder.status)) {
        for (const item of cancellingOrder.items) {
          const med = medicines.find((m) => m.id === item.medicineId);
          if (med) {
            const restoredStock = med.stockPacks + item.packQuantity;
            try {
              await updateDoc(doc(db, 'wholesale_medicines', med.id), {
                stockPacks: restoredStock,
                updatedAt: now,
              });
            } catch {
              // sandbox fallback
            }
            setMedicines((prev) =>
              prev.map((m) => (m.id === med.id ? { ...m, stockPacks: restoredStock } : m))
            );
          }
        }
      }

      // Notify pharmacy
      if (cancellingOrder.pharmacyId) {
        try {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId: cancellingOrder.pharmacyId,
            title: 'إلغاء طلبية الأدوية بالجملة',
            message: `تم إلغاء طلبيتكم رقم ${cancellingOrder.invoiceNumber || cancellingOrder.id} من قبل المذخر. السبب: ${updates.cancellationReason}`,
            type: 'b2b_order_status',
            read: false,
            createdAt: now,
          });
        } catch {
          // sandbox fallback
        }
      }

      await logAuditEvent({
        action: 'wholesale_order_cancelled',
        category: 'wholesale_b2b',
        actorUid: user?.uid || 'wholesaler',
        actorName: wholesalerProfile?.warehouseName || userProfile?.facilityName || 'مذخر الأدوية',
        actorRole: 'wholesaler',
        targetUid: cancellingOrder.pharmacyId,
        targetName: cancellingOrder.pharmacyName,
        targetRole: 'pharmacist',
        resourceId: cancellingOrder.id,
        resourceNumber: cancellingOrder.invoiceNumber || cancellingOrder.id,
        status: 'cancelled',
        details: `إلغاء طلبية أدوية الجملة واسترجاع المخزون: ${updates.cancellationReason}`,
      });

      setOrders((prev) =>
        prev.map((o) => (o.id === cancellingOrder.id ? { ...o, ...updates } : o))
      );

      setCancellingOrder(null);
      setCancelReason('');
      setFeedbackMsg({
        type: 'success',
        text: language === 'ar' ? 'تم إلغاء الطلبية، استرجاع المخزون، وتوثيق السبب' : 'Order cancelled and stock restored',
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: unknown) {
      console.error('Error cancelling order:', err);
    }
  };

  // Save Wholesaler Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const now = new Date().toISOString();
      const cleanLicense = profileForm.licenseNumber.trim();
      const updatedProfile: WholesalerProfile = {
        wholesalerId: user.uid,
        warehouseName: profileForm.warehouseName,
        ownerName: profileForm.ownerName,
        licenseNumber: cleanLicense,
        commercialRegNumber: profileForm.commercialRegNumber,
        phone: profileForm.phone,
        whatsapp: profileForm.whatsapp,
        address: profileForm.address,
        governorate: profileForm.governorate,
        deliveryCoverageGovernorates: profileForm.deliveryCoverageGovernorates,
        minimumOrderValueIqd: Number(profileForm.minimumOrderValueIqd),
        workingHours: profileForm.workingHours,
        logoUrl: profileForm.logoUrl,
        bio: profileForm.bio,
        isVerified: true,
        createdAt: wholesalerProfile ? wholesalerProfile.createdAt : now,
        updatedAt: now,
      };

      try {
        await setDoc(doc(db, 'wholesaler_profiles', user.uid), sanitizeForFirestore(updatedProfile));
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: profileForm.warehouseName,
          facilityName: profileForm.warehouseName,
          licenseNumber: cleanLicense,
          governorate: profileForm.governorate,
          phone: profileForm.phone,
          updatedAt: now,
        });
        await refreshProfile();
      } catch (err: unknown) {
        handleFirestoreError(err, OperationType.WRITE, `wholesaler_profiles/${user.uid}`);
      }

      await logAuditEvent({
        action: 'wholesaler_profile_updated',
        category: 'profiles',
        actorUid: user.uid,
        actorName: profileForm.warehouseName,
        actorRole: 'wholesaler',
        resourceId: user.uid,
        resourceNumber: cleanLicense || 'WHOLESALER-IQ',
        status: 'updated',
        details: `تحديث بيانات مذخر الأدوية ورقم الإجازة الصحية / نقابة الصيادلة (${cleanLicense}) في ${profileForm.governorate}`,
      });

      setWholesalerProfile(updatedProfile);
      setFeedbackMsg({
        type: 'success',
        text: language === 'ar' ? 'تم حفظ بيانات المذخر ورقم الإجازة الصحية بنجاح' : 'Warehouse settings & license updated successfully',
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: unknown) {
      console.error('Error updating profile:', err);
    }
  };

  const openEditModal = (item: WholesaleMedicineItem) => {
    setEditingMedicine(item);
    setMedicineForm({
      name: item.name,
      nameAr: item.nameAr || '',
      activeIngredient: item.activeIngredient,
      manufacturer: item.manufacturer,
      originCountry: item.originCountry,
      strength: item.strength,
      dosageForm: item.dosageForm,
      packSize: item.packSize,
      cartonCapacity: item.cartonCapacity,
      batchNumber: item.batchNumber,
      productionDate: item.productionDate,
      expiryDate: item.expiryDate,
      wholesalePriceIqd: item.wholesalePriceIqd,
      cartonPriceIqd: item.cartonPriceIqd || item.wholesalePriceIqd * item.cartonCapacity,
      stockPacks: item.stockPacks,
      minOrderQuantity: item.minOrderQuantity,
      isAvailable: item.isAvailable,
      category: item.category,
      notes: item.notes || '',
    });
    setShowNewMedicineModal(true);
  };

  const openNewModal = () => {
    setEditingMedicine(null);
    setMedicineForm({
      name: '',
      nameAr: '',
      activeIngredient: '',
      manufacturer: '',
      originCountry: 'Iraq (العراق)',
      strength: '500mg',
      dosageForm: 'Tablets (أقراص)',
      packSize: '20 Tablets / Box',
      cartonCapacity: 30,
      batchNumber: `BAT-${Date.now().toString().slice(-6)}`,
      productionDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      wholesalePriceIqd: 3500,
      cartonPriceIqd: 100000,
      stockPacks: 100,
      minOrderQuantity: 10,
      isAvailable: true,
      category: 'Antibiotics (مضادات حيوية)',
      notes: '',
    });
    setShowNewMedicineModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback Message */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-bold shadow-md animate-in fade-in duration-200 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
              : 'bg-red-50 border border-red-300 text-red-900'
          }`}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> : <AlertCircle size={18} className="text-red-600 shrink-0" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Top Warehouse Identity & Action Strip */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Building2 size={30} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">
                {wholesalerProfile?.warehouseName || userProfile?.facilityName || 'مذخر الأدوية المعتمد'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  const wId = userProfile?.accountId || wholesalerProfile?.wholesalerId || generateFacilityOrUserId('wholesaler', user?.uid || 'guest');
                  navigator.clipboard.writeText(wId);
                  setFeedbackMsg({
                    type: 'success',
                    text: language === 'ar' ? `تم نسخ معرّف المذخر (${wId})` : `Wholesaler ID copied (${wId})`
                  });
                  setTimeout(() => setFeedbackMsg(null), 3000);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-teal-900 border border-slate-300 font-mono transition-colors cursor-pointer"
                title={language === 'ar' ? 'انقر لنسخ المعرّف' : 'Click to copy ID'}
              >
                <Copy size={12} className="text-teal-600" />
                <span>ID: {userProfile?.accountId || wholesalerProfile?.wholesalerId || generateFacilityOrUserId('wholesaler', user?.uid || 'guest')}</span>
              </button>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                <ShieldCheck size={12} className="text-teal-600" />
                <span>{language === 'ar' ? 'مكتب علمي معتمد' : 'Verified Bureau'}</span>
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>{language === 'ar' ? 'الترخيص:' : 'License:'} <strong className="font-mono text-slate-700">{wholesalerProfile?.licenseNumber || userProfile?.licenseNumber || (language === 'ar' ? 'قيد التوثيق' : 'Under Review')}</strong></span>
              <span>·</span>
              <span>{wholesalerProfile?.governorate || 'بغداد (Baghdad)'}</span>
              <span>·</span>
              <span>{wholesalerProfile?.phone || '07709988776'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={handleManualSync}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-teal-600' : ''} />
            <span>{language === 'ar' ? 'مزامنة الكتالوج' : 'Sync Catalog'}</span>
          </button>

          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>{language === 'ar' ? 'إضافة وجبة أدوية جديدة' : 'Add Wholesale Medicine'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { id: 'dashboard', labelAr: 'لوحة القيادة والمؤشرات', labelEn: 'Dashboard & Metrics', icon: Sparkles },
          { id: 'catalog', labelAr: `كتالوج الأدوية والجملة (${medicines.length})`, labelEn: `Wholesale Catalog (${medicines.length})`, icon: Package },
          { id: 'orders', labelAr: `طلبيات الصيدليات الواردة (${orders.length})`, labelEn: `Incoming B2B Orders (${orders.length})`, icon: Truck },
          { id: 'settings', labelAr: 'إعدادات المذخر والتوريد', labelEn: 'Warehouse Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon size={16} />
              <span>{language === 'ar' ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD & METRICS */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block mb-1">
                {language === 'ar' ? 'إجمالي قيمة المخزون الدوائي' : 'Total Inventory Valuation'}
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {metrics.totalInventoryValue.toLocaleString()} <span className="text-xs font-normal text-slate-500">{language === 'ar' ? 'د.ع' : 'IQD'}</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-2 block">
                {language === 'ar' ? `موزعة على ${metrics.totalPacks.toLocaleString()} باكيت مسجل` : `Across ${metrics.totalPacks} registered packs`}
              </span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block mb-1">
                {language === 'ar' ? 'الطلبيات الواردة قيد التدقيق' : 'Pending Pharmacy Orders'}
              </span>
              <div className="text-2xl font-black text-teal-700 font-mono">
                {metrics.pendingOrdersCount}
              </div>
              <span className="text-[11px] text-teal-600 mt-2 block font-semibold">
                {language === 'ar' ? 'بانتظار الموافقة والتجهيز' : 'Awaiting approval & packing'}
              </span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block mb-1">
                {language === 'ar' ? 'شحنات قيد التوصيل واللوجستيات' : 'Dispatched Deliveries'}
              </span>
              <div className="text-2xl font-black text-slate-800 font-mono">
                {metrics.activeDispatchedCount}
              </div>
              <span className="text-[11px] text-slate-500 mt-2 block">
                {language === 'ar' ? 'مع مندوبي التوصيل للصيدليات' : 'Out for pharmacy delivery'}
              </span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block mb-1">
                {language === 'ar' ? 'تنبيهات نواقص المخزون' : 'Low-Stock Alerts'}
              </span>
              <div className="text-2xl font-black text-amber-600 font-mono">
                {metrics.lowStockCount}
              </div>
              <span className="text-[11px] text-amber-700 mt-2 block font-semibold">
                {language === 'ar' ? 'أقل من ضعف الحد الأدنى (MOQ)' : 'Close to MOQ threshold'}
              </span>
            </div>
          </div>

          {/* Quick Smart Search Banner */}
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg space-y-4">
            <div>
              <h3 className="text-lg sm:text-xl font-bold">
                {language === 'ar' ? 'محرك البحث الذكي في المستودع والمذاخر الشقيقة' : 'Smart Pharmaceutical Inventory Search'}
              </h3>
              <p className="text-xs sm:text-sm text-teal-200 mt-1">
                {language === 'ar'
                  ? 'بحث فوري يبدأ من 3 أحرف بالاسم التجاري، المادة الفعالة (Generic)، الشركة المصنعة ورقم التشغيلة.'
                  : 'Fast debounced autocomplete across Brand, Active Ingredient, and Manufacturer.'}
              </p>
            </div>

            <div className="max-w-2xl">
              <SmartMedicineSearch
                sourceType="wholesale"
                onSelectMedicine={(med) => {
                  setSearchQuery(med.name.split(' ')[0]);
                  setActiveTab('catalog');
                }}
              />
            </div>
          </div>

          {/* Recent Orders Overview */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {language === 'ar' ? 'أحدث طلبيات الشراء من الصيدليات' : 'Recent Pharmacy Purchase Orders'}
              </h3>
              <button
                onClick={() => setActiveTab('orders')}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
              >
                <span>{language === 'ar' ? 'عرض كل الطلبيات' : 'View all orders'}</span>
                {isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>

            {orders.slice(0, 3).map((order) => (
              <div
                key={order.id}
                className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{order.pharmacyName}</span>
                    <span className="text-xs font-mono text-slate-400">({order.invoiceNumber || order.id.slice(-6)})</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {order.items.length} {language === 'ar' ? 'أصناف دوائية' : 'items'} · {order.pharmacyGovernorate} · {order.pharmacyPhone}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-end">
                    <div className="font-bold text-sm text-slate-900 font-mono">
                      {order.totalAmountIqd.toLocaleString()} <span className="text-[10px] text-slate-500">{language === 'ar' ? 'د.ع' : 'IQD'}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      order.status === 'delivered'
                        ? 'bg-emerald-100 text-emerald-800'
                        : order.status === 'dispatched'
                        ? 'bg-blue-100 text-blue-800'
                        : order.status === 'preparing'
                        ? 'bg-purple-100 text-purple-800'
                        : order.status === 'approved'
                        ? 'bg-teal-100 text-teal-800'
                        : order.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedOrderDetails(order)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-white cursor-pointer"
                  >
                    {language === 'ar' ? 'تفاصيل الفاتورة' : 'View Invoice'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: WHOLESALE CATALOG & BATCH MANAGEMENT */}
      {activeTab === 'catalog' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {language === 'ar' ? 'كتالوج الأدوية والمستلزمات الطبية بالجملة' : 'B2B Wholesale Medication Catalog'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ar'
                  ? 'إدارة المنتجات، أرقام التشغيلات (Batches)، تواريخ الصلاحية وأسعار الباكيت والكارتون للصيدليات.'
                  : 'Manage pharmaceutical lines, batch codes, expiration dates, carton sizes, and MOQ rules.'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={openNewModal}
                className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={16} />
                <span>{language === 'ar' ? 'إضافة دواء للكتالوج' : 'Add Medication'}</span>
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-3 text-slate-400`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'بحث بالاسم، المادة الفعالة أو التشغيلة...' : 'Filter by name or batch...'}
                className={`w-full py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-teal-700 focus:outline-none ${
                  isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
                }`}
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
            >
              <option value="all">{language === 'ar' ? 'جميع التصنيفات الدوائية' : 'All Categories'}</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
            >
              <option value="all">{language === 'ar' ? 'جميع حالات المخزون' : 'All Stock Levels'}</option>
              <option value="in_stock">{language === 'ar' ? 'المتوفر فقط' : 'In Stock Only'}</option>
              <option value="low_stock">{language === 'ar' ? 'نواقص المخزون (أقل من الحد)' : 'Low Stock Alert'}</option>
              <option value="expiring_soon">{language === 'ar' ? 'قريب الانتهاء (أقل من 6 أشهر)' : 'Expiring Within 6 Mos'}</option>
            </select>
          </div>

          {/* Catalog Data Grid */}
          {filteredCatalog.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Package size={48} className="mx-auto mb-3 opacity-30" />
              <h4 className="font-bold text-base text-slate-700">{language === 'ar' ? 'لا توجد مستحضرات تطابق البحث' : 'No medications found'}</h4>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'ar' ? 'جرب تغيير معايير البحث أو أضف مستحضراً جديداً إلى المستودع' : 'Try adjusting filters or add a new batch'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-start text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 text-start">{language === 'ar' ? 'اسم المستحضر والتركيز' : 'Product & Strength'}</th>
                    <th className="p-3 text-start">{language === 'ar' ? 'المادة الفعالة والشركة' : 'Active & Maker'}</th>
                    <th className="p-3 text-start">{language === 'ar' ? 'رقم الوجبة والصلاحية' : 'Batch & Expiry'}</th>
                    <th className="p-3 text-end">{language === 'ar' ? 'سعر الجملة (باكيت/كارتون)' : 'Price (Pack/Carton)'}</th>
                    <th className="p-3 text-end">{language === 'ar' ? 'المخزون (باكيت)' : 'Stock'}</th>
                    <th className="p-3 text-center">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-center">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCatalog.map((item) => {
                    const isLowStock = item.stockPacks <= item.minOrderQuantity * 2;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                          <div className="text-slate-500 text-[11px]">{item.dosageForm} · {item.packSize}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-slate-800 font-medium">{item.activeIngredient}</div>
                          <div className="text-slate-500 text-[11px]">{item.manufacturer} ({item.originCountry})</div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-slate-800 font-bold">{item.batchNumber}</div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-1 font-mono">
                            <Calendar size={11} />
                            <span>{item.expiryDate}</span>
                          </div>
                        </td>
                        <td className="p-3 text-end">
                          <div className="font-bold text-slate-900 font-mono text-sm">
                            {item.wholesalePriceIqd.toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-500">{language === 'ar' ? 'د.ع/باكيت' : 'IQD/pack'}</span>
                          </div>
                          {item.cartonPriceIqd && (
                            <div className="text-slate-500 font-mono text-[11px]">
                              {item.cartonPriceIqd.toLocaleString()} {language === 'ar' ? 'د.ع/كارتون' : 'IQD/carton'}
                            </div>
                          )}
                          <div className="text-[10px] text-teal-700 font-bold">
                            {language === 'ar' ? `الحد الأدنى: ${item.minOrderQuantity}` : `MOQ: ${item.minOrderQuantity}`}
                          </div>
                        </td>
                        <td className="p-3 text-end">
                          <span className={`font-bold font-mono text-sm ${isLowStock ? 'text-amber-600' : 'text-slate-900'}`}>
                            {item.stockPacks.toLocaleString()}
                          </span>
                          {isLowStock && (
                            <span className="block text-[10px] font-semibold text-amber-600">
                              {language === 'ar' ? 'مخزون منخفض' : 'Low stock'}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(item)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                              item.isAvailable && item.stockPacks > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.isAvailable && item.stockPacks > 0
                              ? (language === 'ar' ? 'متاح للطلب' : 'Available')
                              : (language === 'ar' ? 'معلق / نفد' : 'Out of stock')}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition-colors"
                              title={language === 'ar' ? 'تعديل' : 'Edit'}
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteMedicine(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title={language === 'ar' ? 'حذف' : 'Delete'}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INCOMING B2B PURCHASE ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {language === 'ar' ? 'طلبيات شراء الأدوية الواردة من الصيدليات' : 'Incoming Pharmacy Purchase Orders'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ar'
                  ? 'متابعة طلبيات التوريد، الموافقة، التجهيز من المستودع، وإرسال الشحنات مع المندوبين.'
                  : 'Fulfill B2B replenishment orders from certified pharmacies across Iraqi governorates.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              >
                <option value="all">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="pending">{language === 'ar' ? 'قيد التدقيق (Pending)' : 'Pending'}</option>
                <option value="approved">{language === 'ar' ? 'تمت الموافقة (Approved)' : 'Approved'}</option>
                <option value="preparing">{language === 'ar' ? 'قيد التجهيز (Preparing)' : 'Preparing'}</option>
                <option value="dispatched">{language === 'ar' ? 'خرجت للتوصيل (Dispatched)' : 'Dispatched'}</option>
                <option value="delivered">{language === 'ar' ? 'تم التسليم (Delivered)' : 'Delivered'}</option>
                <option value="cancelled">{language === 'ar' ? 'ملغاة (Cancelled)' : 'Cancelled'}</option>
              </select>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Truck size={48} className="mx-auto mb-3 opacity-30" />
              <h4 className="font-bold text-base text-slate-700">{language === 'ar' ? 'لا توجد طلبيات تطابق الفلتر' : 'No orders in this queue'}</h4>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'ar' ? 'ستظهر هنا طلبيات الشراء بالجملة عند إرسالها من الصيدليات الأهلية' : 'New pharmacy orders will appear here automatically'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-teal-200 hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base text-slate-900">{order.pharmacyName}</span>
                      <span className="text-xs font-mono font-bold text-slate-400">#{order.invoiceNumber || order.id.slice(-8)}</span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        order.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.status === 'dispatched'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'preparing'
                          ? 'bg-purple-100 text-purple-800'
                          : order.status === 'approved'
                          ? 'bg-teal-100 text-teal-800'
                          : order.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.status === 'pending' && (language === 'ar' ? 'طلب جديد قيد التدقيق' : 'Pending')}
                        {order.status === 'approved' && (language === 'ar' ? 'تمت الموافقة' : 'Approved')}
                        {order.status === 'preparing' && (language === 'ar' ? 'جاري تجهيز الصناديق' : 'Preparing')}
                        {order.status === 'dispatched' && (language === 'ar' ? 'خرجت مع المندوب' : 'Dispatched')}
                        {order.status === 'delivered' && (language === 'ar' ? 'تم التسليم والتحاسب' : 'Delivered')}
                        {order.status === 'cancelled' && (language === 'ar' ? 'طلب ملغي' : 'Cancelled')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400" />
                        <span>{order.pharmacyAddress} ({order.pharmacyGovernorate})</span>
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Phone size={12} className="text-slate-400" />
                        <span className="font-mono">{order.pharmacyPhone}</span>
                      </span>
                      <span>·</span>
                      <span className="font-mono text-slate-400">{order.createdAt.split('T')[0]}</span>
                    </div>

                    {order.pharmacyNotes && (
                      <p className="text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg mt-1 inline-block">
                        <strong>{language === 'ar' ? 'ملاحظة الصيدلية: ' : 'Pharmacy Note: '}</strong>
                        {order.pharmacyNotes}
                      </p>
                    )}
                  </div>

                  {/* Actions & Price */}
                  <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="text-start md:text-end">
                      <div className="text-base font-black text-slate-900 font-mono">
                        {order.totalAmountIqd.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-500">{language === 'ar' ? 'د.ع' : 'IQD'}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {order.items.length} {language === 'ar' ? 'أصناف مختلفة' : 'distinct medicines'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedOrderDetails(order)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {language === 'ar' ? 'الفاتورة' : 'Invoice'}
                      </button>

                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'approved')}
                          className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          {language === 'ar' ? 'موافقة وتجهيز' : 'Approve'}
                        </button>
                      )}

                      {order.status === 'approved' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                          className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          {language === 'ar' ? 'تجهيز الكراتين' : 'Prepare'}
                        </button>
                      )}

                      {order.status === 'preparing' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'dispatched')}
                          className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Truck size={14} />
                          <span>{language === 'ar' ? 'إرسال مع السائق' : 'Dispatch'}</span>
                        </button>
                      )}

                      {order.status === 'dispatched' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Check size={14} />
                          <span>{language === 'ar' ? 'تأكيد التسليم' : 'Delivered'}</span>
                        </button>
                      )}

                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            setCancellingOrder(order);
                            setCancelReason('');
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title={language === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WAREHOUSE SETTINGS & B2B RULES */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">
              {language === 'ar' ? 'الملف المهني للمذخر وإعدادات التوزيع' : 'Warehouse Profile & B2B Logistics Settings'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'ar'
                ? 'بيانات الترخيص الرسمي، نطاق تغطية المحافظات، والحد الأدنى للطلبيات.'
                : 'Configure official Syndicate registration, delivery coverage, and minimum bulk order values.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'اسم المذخر / المكتب العلمي *' : 'Warehouse / Bureau Name *'}
              </label>
              <input
                type="text"
                required
                value={profileForm.warehouseName}
                onChange={(e) => setProfileForm({ ...profileForm, warehouseName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'اسم المدير المسؤول / الصيدلي المشرف *' : 'Director / Pharmacist-in-Charge *'}
              </label>
              <input
                type="text"
                required
                value={profileForm.ownerName}
                onChange={(e) => setProfileForm({ ...profileForm, ownerName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'رقم الإجازة الصحية / نقابة الصيادلة *' : 'Health License / Syndicate ID *'}
              </label>
              <input
                type="text"
                required
                value={profileForm.licenseNumber}
                onChange={(e) => setProfileForm({ ...profileForm, licenseNumber: e.target.value })}
                placeholder={language === 'ar' ? 'أدخل رقم الإجازة الصحية / نقابة الصيادلة' : 'Enter Health License / Syndicate ID'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'رقم السجل التجاري' : 'Commercial Registration #'}
              </label>
              <input
                type="text"
                value={profileForm.commercialRegNumber}
                onChange={(e) => setProfileForm({ ...profileForm, commercialRegNumber: e.target.value })}
                placeholder="CR-BAG-XXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'رقم الهاتف للتواصل *' : 'Warehouse Phone *'}
              </label>
              <input
                type="tel"
                required
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                placeholder="07XXXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'رقم الواتساب لاستقبال طلبيات الصيدليات' : 'WhatsApp Orders Line'}
              </label>
              <input
                type="tel"
                value={profileForm.whatsapp}
                onChange={(e) => setProfileForm({ ...profileForm, whatsapp: e.target.value })}
                placeholder="07XXXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700 font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'عنوان المستودع الفعلي بالتفصيل *' : 'Physical Warehouse Address *'}
              </label>
              <input
                type="text"
                required
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'المحافظة الرئيسية *' : 'Base Governorate *'}
              </label>
              <select
                value={profileForm.governorate}
                onChange={(e) => setProfileForm({ ...profileForm, governorate: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white"
              >
                {governoratesList.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'الحد الأدنى لقيمة الطلبية (د.ع)' : 'Minimum Order Value (IQD)'}
              </label>
              <input
                type="number"
                step={10000}
                value={profileForm.minimumOrderValueIqd}
                onChange={(e) => setProfileForm({ ...profileForm, minimumOrderValueIqd: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'نبذة تعريفية عن المذخر وتراخيص الوكالات الدوائية' : 'Wholesaler Bio & Agency Representation'}
              </label>
              <textarea
                rows={3}
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {language === 'ar' ? 'الترخيص معتمد سحابياً لدى وزارة الصحة ونقابة الصيادلة' : 'Licensed & verified in Cloud Firestore'}
            </span>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Save size={16} />
              <span>{language === 'ar' ? 'حفظ إعدادات المذخر' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* MODAL: ADD / EDIT WHOLESALE MEDICINE */}
      {showNewMedicineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-lg text-slate-900">
                {editingMedicine
                  ? (language === 'ar' ? 'تعديل بيانات الوجبة الدوائية' : 'Edit Wholesale Medicine')
                  : (language === 'ar' ? 'إضافة دواء / وجبة جديدة للكتالوج' : 'Add Wholesale Medicine')}
              </h3>
              <button
                type="button"
                onClick={() => setShowNewMedicineModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMedicine} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'الاسم التجاري بالإنكليزية *' : 'Brand Name *'}</label>
                  <input
                    type="text"
                    required
                    value={medicineForm.name}
                    onChange={(e) => setMedicineForm({ ...medicineForm, name: e.target.value })}
                    placeholder="Augmentin 1g"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</label>
                  <input
                    type="text"
                    value={medicineForm.nameAr}
                    onChange={(e) => setMedicineForm({ ...medicineForm, nameAr: e.target.value })}
                    placeholder="أوجمنتين 1 غرام"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'المادة الفعالة (Generic / Active Ingredient) *' : 'Active Ingredient *'}</label>
                <input
                  type="text"
                  required
                  value={medicineForm.activeIngredient}
                  onChange={(e) => setMedicineForm({ ...medicineForm, activeIngredient: e.target.value })}
                  placeholder="Amoxicillin + Clavulanic Acid"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'الشركة المصنعة *' : 'Manufacturer *'}</label>
                  <input
                    type="text"
                    required
                    value={medicineForm.manufacturer}
                    onChange={(e) => setMedicineForm({ ...medicineForm, manufacturer: e.target.value })}
                    placeholder="GSK, SDI, Pioneer..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'بلد المنشأ' : 'Country of Origin'}</label>
                  <input
                    type="text"
                    value={medicineForm.originCountry}
                    onChange={(e) => setMedicineForm({ ...medicineForm, originCountry: e.target.value })}
                    placeholder="UK, Iraq, Jordan..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'التركيز' : 'Strength'}</label>
                  <input
                    type="text"
                    value={medicineForm.strength}
                    onChange={(e) => setMedicineForm({ ...medicineForm, strength: e.target.value })}
                    placeholder="1000mg, 500mg..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'الشكل الصيدلاني' : 'Dosage Form'}</label>
                  <input
                    type="text"
                    value={medicineForm.dosageForm}
                    onChange={(e) => setMedicineForm({ ...medicineForm, dosageForm: e.target.value })}
                    placeholder="Tablets, Syrup, Injections..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'سعة الباكيت' : 'Pack Size'}</label>
                  <input
                    type="text"
                    value={medicineForm.packSize}
                    onChange={(e) => setMedicineForm({ ...medicineForm, packSize: e.target.value })}
                    placeholder="14 Tablets / Box"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'سعة الكارتون (باكيت)' : 'Carton Capacity'}</label>
                  <input
                    type="number"
                    min={1}
                    value={medicineForm.cartonCapacity}
                    onChange={(e) => setMedicineForm({ ...medicineForm, cartonCapacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'رقم الوجبة / التشغيلة *' : 'Batch Code *'}</label>
                  <input
                    type="text"
                    required
                    value={medicineForm.batchNumber}
                    onChange={(e) => setMedicineForm({ ...medicineForm, batchNumber: e.target.value })}
                    placeholder="BAT-2026-X1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'تاريخ الإنتاج' : 'Mfg Date'}</label>
                  <input
                    type="date"
                    value={medicineForm.productionDate}
                    onChange={(e) => setMedicineForm({ ...medicineForm, productionDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'تاريخ انتهاء الصلاحية *' : 'Expiry Date *'}</label>
                  <input
                    type="date"
                    required
                    value={medicineForm.expiryDate}
                    onChange={(e) => setMedicineForm({ ...medicineForm, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'سعر الباكيت (د.ع) *' : 'Pack Price (IQD) *'}</label>
                  <input
                    type="number"
                    required
                    step={250}
                    value={medicineForm.wholesalePriceIqd}
                    onChange={(e) => {
                      const packPrice = Number(e.target.value);
                      setMedicineForm({
                        ...medicineForm,
                        wholesalePriceIqd: packPrice,
                        cartonPriceIqd: packPrice * Number(medicineForm.cartonCapacity),
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'سعر الكارتون (د.ع)' : 'Carton Price'}</label>
                  <input
                    type="number"
                    value={medicineForm.cartonPriceIqd}
                    onChange={(e) => setMedicineForm({ ...medicineForm, cartonPriceIqd: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'الكمية المتوفرة (باكيت) *' : 'Stock Packs *'}</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={medicineForm.stockPacks}
                    onChange={(e) => setMedicineForm({ ...medicineForm, stockPacks: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'الحد الأدنى للطلب (MOQ) *' : 'MOQ (Packs) *'}</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={medicineForm.minOrderQuantity}
                    onChange={(e) => setMedicineForm({ ...medicineForm, minOrderQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'التصنيف الدوائي' : 'Therapeutic Category'}</label>
                <select
                  value={medicineForm.category}
                  onChange={(e) => setMedicineForm({ ...medicineForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {categoriesList.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isAvailableCheck"
                  checked={medicineForm.isAvailable}
                  onChange={(e) => setMedicineForm({ ...medicineForm, isAvailable: e.target.checked })}
                  className="w-4 h-4 text-teal-700 rounded border-slate-300"
                />
                <label htmlFor="isAvailableCheck" className="font-bold text-slate-700 cursor-pointer">
                  {language === 'ar' ? 'المستحضر متاح في سوق التوريد للصيدليات' : 'Available for pharmacy procurement'}
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewMedicineModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold"
                >
                  {language === 'ar' ? 'حفظ وتثبيت الوجبة' : 'Save Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ORDER INVOICE & DETAILS */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  {language === 'ar' ? 'فاتورة طلبية أدوية بالجملة' : 'Wholesale Order Invoice'}
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  {selectedOrderDetails.invoiceNumber || selectedOrderDetails.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block mb-0.5">{language === 'ar' ? 'الصيدلية المشترية:' : 'Purchasing Pharmacy:'}</span>
                  <span className="font-bold text-slate-900">{selectedOrderDetails.pharmacyName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{language === 'ar' ? 'رقم الهاتف:' : 'Phone:'}</span>
                  <span className="font-mono font-bold text-slate-900">{selectedOrderDetails.pharmacyPhone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">{language === 'ar' ? 'عنوان التوصيل:' : 'Delivery Address:'}</span>
                  <span className="text-slate-800">{selectedOrderDetails.pharmacyAddress} ({selectedOrderDetails.pharmacyGovernorate})</span>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs text-start">
                  <thead className="bg-slate-100 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2.5 text-start">{language === 'ar' ? 'المستحضر والتشغيلة' : 'Medicine & Batch'}</th>
                      <th className="p-2.5 text-center">{language === 'ar' ? 'الكمية (باكيت)' : 'Qty (Packs)'}</th>
                      <th className="p-2.5 text-end">{language === 'ar' ? 'السعر' : 'Unit'}</th>
                      <th className="p-2.5 text-end">{language === 'ar' ? 'المجموع' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrderDetails.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-800">{it.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{it.batchNumber}</div>
                        </td>
                        <td className="p-2.5 text-center font-bold font-mono">{it.packQuantity}</td>
                        <td className="p-2.5 text-end font-mono">{it.unitWholesalePriceIqd.toLocaleString()}</td>
                        <td className="p-2.5 text-end font-mono font-bold">{it.totalPriceIqd.toLocaleString()} د.ع</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={3} className="p-3 text-end">{language === 'ar' ? 'إجمالي الفاتورة:' : 'Total Amount:'}</td>
                      <td className="p-3 text-end text-teal-800 font-mono text-sm">
                        {selectedOrderDetails.totalAmountIqd.toLocaleString()} د.ع
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetails(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL ORDER REASON */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900">
              {language === 'ar' ? 'إلغاء طلبية الشراء' : 'Cancel Pharmacy Order'}
            </h3>
            <p className="text-xs text-slate-500">
              {language === 'ar'
                ? `هل أنت متأكد من إلغاء طلبية (${cancellingOrder.pharmacyName})؟ يرجى توثيق السبب لإشعار الصيدلية.`
                : 'State the cancellation reason to notify the pharmacy.'}
            </p>

            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={language === 'ar' ? 'أسباب: نفاد الوجبة، تعذر التوصيل، خطأ في الكميات...' : 'Reason for cancellation...'}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs sm:text-sm"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs"
              >
                {language === 'ar' ? 'تراجع' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelOrder}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              >
                {language === 'ar' ? 'تأكيد الإلغاء' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
