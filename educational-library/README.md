# المكتبة التعليمية

مشروع ثابت (HTML/CSS/JS) يعمل مع Firebase Authentication وFirestore وStorage.

## الإعداد
1. أنشئ مشروعًا في Firebase Console وأضف تطبيق ويب، ثم انسخ الإعدادات إلى `js/firebase-config.js`.
2. فعّل Authentication (Email/Password)، وأنشئ Firestore وStorage.
3. انشر القواعد: `firebase deploy --only firestore:rules,storage` (أو انسخ `firestore.rules` و`storage.rules` يدويًا).
4. سجّل حسابًا من صفحة إنشاء الحساب، ثم من Firestore افتح `users/{uid}` الخاص بك وغيّر الحقل `role` إلى `admin` (هذه الخطوة الوحيدة التي تتم يدويًا، والقواعد تمنع أي مستخدم من ترقية نفسه).
5. ادخل إلى `admin.html`، وأضف الأقسام (زر «الأقسام الافتراضية») ثم ارفع الملفات.
6. أضف نطاق موقعك في Authentication > Settings > Authorized domains، ثم انشر: `firebase deploy --only hosting`.

## الهيكل
- `index.html` الرئيسية، `library.html` المكتبة (وكل قسم يُعرض عبر `library.html?cat=ID`)، `book.html` تفاصيل الملف.
- `login.html` و`register.html` (تتضمن استعادة كلمة المرور)، و`admin.html` لوحة الإدارة.
- `js/` الوحدات، و`css/style.css` التصميم، و`*.rules` قواعد الأمان.
