// ============ إعدادات الموقع ============
// 1) افتحي console.firebase.google.com واعملي Project جديد (ببلاش).
// 2) Build ← Firestore Database ← Create database (Production mode).
// 3) Build ← Authentication ← Get started ← فعّلي Email/Password، وأضيفي إيميلك كمستخدم (Users ← Add user).
// 4) Project settings ← Your apps ← Web (</>) ← انسخي firebaseConfig وحطيه هنا.
// 5) Firestore ← Rules ← الصقي محتوى ملف firestore.rules (وغيري الإيميلات اللي جواه).
// طول ما apiKey لسه "PASTE_HERE" الموقع بيشتغل ببيانات تجريبية ومن غير لوحة إدارة.

export const firebaseConfig = {
  apiKey: "AIzaSyBXOFvppgyfBKwkpb0Pq_IukSuDQQmroJE",
  authDomain: "damanhour-library.firebaseapp.com",
  projectId: "damanhour-library",
  appId: "1:130987985607:web:78c4984f914cc32a7a4ce2"
};

export const SITE_NAME = "مكتبة هندسة دمنهور";

// أقسام كلية هندسة دمنهور: الاعدادي + 5 أقسام.
// years = الفرق المتاحة في القسم (لو مش مكتوبة يبقوا الأربعة)
export const DEPTS = [
  { id: "prep",  name: "اعدادي هندسة",  icon: "📐", years: ["1"] },
  { id: "comm",  name: "اتصالات",        icon: "📡" },
  { id: "power", name: "قوى كهربية",     icon: "⚡" },
  { id: "mech",  name: "ميكانيكا باور",  icon: "⚙️" },
  { id: "civil", name: "مدني",           icon: "🏗️" },
  { id: "arch",  name: "عمارة",          icon: "🏛️" }
];

export const YEARS = [
  { id: "1", name: "الأولى / 100" },
  { id: "2", name: "الثانية / 200" },
  { id: "3", name: "الثالثة / 300" },
  { id: "4", name: "الرابعة / 400" }
];

export const TERMS = [
  { id: "1", name: "الترم الأول" },
  { id: "2", name: "الترم الثاني" }
];

// السكاشن اللي بتتعمل أوتوماتيك مع كل مادة جديدة
export const DEFAULT_SECTIONS = ["محاضرات", "سكاشن", "شيتات", "حلول الشيتات", "ملخصات", "امتحانات سابقة", "عملي"];
