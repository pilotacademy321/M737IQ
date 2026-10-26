# M737IQ Android Wrapper (Trusted Web Activity)

هذا المجلد يحتوي على مشروع تطبيق الأندرويد الرسمي لمنصة **M737IQ الطبية** مبنياً بتقنية **Trusted Web Activity (TWA)** الرسمية من Google.

## 🎯 المواصفات والخصائص
- **رابط الموقع الحي**: `https://m737iq.netlify.app/`
- **معرف الحزمة (Package ID)**: `com.m737iq.app`
- **المكتبة الأساسية**: `com.google.androidbrowserhelper:androidbrowserhelper:2.5.0`
- **ألوان الهوية**: `#003366` (Navy Primary)، `#e11d48` (Medical Red Accent)
- **شاشة الإقلاع (Splash Screen)**: مدمجة مع شعار M737IQ
- **تحديثات فورية**: أي تعديل يتم نشره على الموقع عبر Netlify ينعكس مباشرة داخل التطبيق عند فتحه دون الحاجة لتحديث الـ APK.
- **التوافق التلقائي (Fallback)**: يعمل على أي هاتف أندرويد (إصدار Android 5.0 Lollipop / API 21 فما فوق).

---

## 🚀 كيفية بناء ملف الـ APK ونشره تلقائياً

### الطريقة الأولى: من خلال GitHub Actions (موصى بها)
1. افتح مستودع المشروع على GitHub: `https://github.com/pilotacademy321/M737IQ`
2. اذهب إلى تبويب **Actions**.
3. اختر سير العمل: **"Build and Release M737IQ Android APK"**.
4. اضغط على زر **Run workflow**.
5. سيقوم الـ Action بالبناء وتوقيع الـ APK ونشره مباشرة كـ **GitHub Release** مع رابط تحميل مباشر.

### الطريقة الثانية: التوقيع باستخدام مفتاح خاص بك (اختياري)
إذا كنت ترغب في استخدام مفتاح توقيع مخصص (Custom Keystore) بدلاً من المفتاح الآمن التلقائي:
1. اذهب إلى **Settings > Secrets and variables > Actions** في مستودع GitHub.
2. أضف الأسرار التالية:
   - `KEYSTORE_BASE64`: محتوى ملف keystore مشفراً بـ base64 (`base64 -w 0 my-release-key.keystore`)
   - `KEYSTORE_PASSWORD`: كلمة مرور الـ keystore
   - `KEY_ALIAS`: اسم المفتاح (Alias)
   - `KEY_PASSWORD`: كلمة مرور المفتاح الخاص
