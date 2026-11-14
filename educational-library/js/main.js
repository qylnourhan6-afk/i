import { auth, db, configured } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const num = n => Number(n || 0).toLocaleString("ar-EG");
export const fmtDate = t => t?.toDate ? t.toDate().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : "—";
export const norm = s => String(s ?? "").toLowerCase().replace(/[\u064B-\u065F\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M20 17v4H6.5A2.5 2.5 0 0 1 4 18.5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h6"/>',
  code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
  grad: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5z"/><path d="m2 13 10 5 10-5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
};
export const ICONS = ["book", "file", "clipboard", "code", "grad", "layers"];
export const icon = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.book}</svg>`;

export function toast(msg, type = "info") {
  const box = $("#toasts"); if (!box) return;
  const t = document.createElement("div");
  t.className = "toast " + type; t.setAttribute("role", "status"); t.textContent = msg;
  box.append(t); setTimeout(() => t.remove(), 4200);
}

export const skeletons = (n = 4) => Array.from({ length: n }, () => '<div class="skeleton"></div>').join("");
export const emptyState = (title, text = "", action = "") => `<div class="state"><b>${esc(title)}</b>${esc(text)}${action}</div>`;
export const errorState = (text = "تعذر تحميل البيانات. تحقق من الاتصال ثم حاول مرة أخرى.") => emptyState("حدث خطأ", text, '<br><button class="btn" data-retry>إعادة المحاولة</button>');

let catCache;
export async function loadCategories(force = false) {
  if (catCache && !force) return catCache;
  const s = await getDocs(collection(db, "categories"));
  catCache = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  return catCache;
}

export function bookCard(b, cats = []) {
  const c = cats.find(x => x.id === b.categoryId);
  return `<a class="book" href="book.html?id=${encodeURIComponent(b.id)}">
    <div class="cover">${b.coverUrl ? `<img src="${esc(b.coverUrl)}" alt="غلاف ${esc(b.title)}" loading="lazy">` : icon(c?.icon || "book", 40)}</div>
    <div class="info"><h3>${esc(b.title)}</h3>
    <span class="muted" style="font-size:.88rem">${esc([b.subject, b.grade].filter(Boolean).join(" - ") || c?.name || "")}</span>
    <div class="meta"><span>${icon("eye", 15)} ${num(b.views)}</span><span>${fmtDate(b.createdAt)}</span></div></div></a>`;
}

const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.setItem("theme", t); };

function renderNav(user, profile) {
  const here = location.pathname.split("/").pop() || "index.html";
  const on = f => (here === f ? "on" : "");
  const dark = document.documentElement.dataset.theme !== "light";
  const auth = user
    ? `${profile?.role === "admin" ? '<a class="btn sm hide-m" href="admin.html">لوحة التحكم</a>' : ""}
       <span class="muted hide-m">${esc(profile?.displayName || user.displayName || "")}</span>
       <button class="btn sm" id="logout">تسجيل الخروج</button>`
    : `<a class="btn sm hide-m" href="login.html">تسجيل الدخول</a><a class="btn sm primary" href="register.html">إنشاء حساب</a>`;
  $("#nav").innerHTML = `<nav class="nav" aria-label="التنقل الرئيسي"><div class="container">
    <a class="logo" href="index.html"><i>${icon("book", 20)}</i>المكتبة التعليمية</a>
    <div class="links" id="links"><a class="${on("index.html")}" href="index.html">الرئيسية</a><a class="${on("library.html")}" href="library.html">المكتبة</a>
    ${user ? "" : '<a class="" href="login.html">تسجيل الدخول</a>'}${profile?.role === "admin" ? '<a href="admin.html">لوحة التحكم</a>' : ""}</div>
    <div class="actions"><button class="btn icon" id="theme" aria-label="تبديل المظهر">${icon(dark ? "sun" : "moon", 18)}</button>${auth}
    <button class="btn icon menu-btn" id="menu" aria-label="القائمة">${icon("menu", 18)}</button></div></div></nav>`;
  $("#theme").onclick = () => { setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"); renderNav(user, profile); };
  $("#menu").onclick = () => $("#links").classList.toggle("open");
  const lo = $("#logout");
  if (lo) lo.onclick = async () => { await signOut(auth); location.href = "index.html"; };
}

function renderFooter() {
  const f = $("#foot"); if (!f) return;
  f.innerHTML = `<footer><div class="container"><div class="cols">
    <div><a class="logo" href="index.html" style="margin-bottom:8px">المكتبة التعليمية</a><p>مكتبة عربية مفتوحة للطلاب: كتب ومذكرات وملخصات وامتحانات في مكان واحد.</p></div>
    <div><h4>التصفح</h4><a href="library.html">كل المحتوى</a><a href="library.html?sort=views">الأكثر مشاهدة</a><a href="library.html?sort=new">الأحدث</a></div>
    <div><h4>حسابي</h4><a href="login.html">تسجيل الدخول</a><a href="register.html">إنشاء حساب</a></div></div>
    <div class="copy">© ${new Date().getFullYear()} المكتبة التعليمية. جميع الحقوق محفوظة.</div></div></footer>`;
}

export function watchUser(cb) {
  renderFooter();
  if (!configured) {
    renderNav(null, null);
    const m = $("main"); if (m) m.insertAdjacentHTML("afterbegin", '<div class="container"><div class="alert error" style="margin-top:16px">لم يتم ضبط Firebase بعد. افتح js/firebase-config.js وأدخل بيانات مشروعك.</div></div>');
  }
  onAuthStateChanged(auth, async u => {
    let p = null;
    if (u) {
      try { const s = await getDoc(doc(db, "users", u.uid)); p = s.exists() ? s.data() : null; } catch { }
      if (p?.status === "blocked") { await signOut(auth); toast("تم إيقاف هذا الحساب. تواصل مع الإدارة.", "error"); u = null; p = null; }
    }
    renderNav(u, p); cb?.(u, p);
  });
}
