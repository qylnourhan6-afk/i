import { db, auth } from "./firebase-config.js";
import { collection, getDocs, getDoc, doc, query, where, limit, updateDoc, addDoc, increment, serverTimestamp, getAggregateFromServer, count, sum } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { $, $$, esc, num, fmtDate, norm, icon, toast, watchUser, loadCategories, bookCard, skeletons, emptyState, errorState } from "./main.js";

const page = document.body.dataset.page;
const published = () => query(collection(db, "books"), where("published", "==", true));
const ms = b => b.createdAt?.toMillis?.() || 0;
const fetchBooks = async () => (await getDocs(query(published(), limit(300)))).docs.map(d => ({ id: d.id, ...d.data() }));
const retry = fn => document.addEventListener("click", e => { if (e.target.closest("[data-retry]")) fn(); });

async function home() {
  const [latest, popular, featured, catsEl, stats] = ["#latest", "#popular", "#featured", "#cats", "#stats"].map($);
  [latest, popular].forEach(el => el.innerHTML = skeletons(4));
  catsEl.innerHTML = skeletons(3).replace(/skeleton/g, "skeleton\" style=\"aspect-ratio:auto;height:82px");
  try {
    const s = await getDoc(doc(db, "settings", "site")).catch(() => null);
    const st = s?.exists() ? s.data() : {};
    if (st.heroTitle) $("#heroTitle").textContent = st.heroTitle;
    if (st.heroText) $("#heroText").textContent = st.heroText;
    if (st.aboutText) $("#aboutText").textContent = st.aboutText;
  } catch { }
  try {
    const [cats, books] = await Promise.all([loadCategories(), fetchBooks()]);
    const n = id => books.filter(b => b.categoryId === id).length;
    $("#heroChips").innerHTML = cats.slice(0, 7).map(c => `<a class="chip" href="library.html?cat=${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join("");
    catsEl.innerHTML = cats.length ? cats.map(c => `<a class="cat" href="library.html?cat=${encodeURIComponent(c.id)}"><i>${icon(c.icon)}</i><span><b>${esc(c.name)}</b><small>${num(n(c.id))} ملف</small></span></a>`).join("")
      : emptyState("لا توجد أقسام بعد", "ستظهر الأقسام هنا بعد إضافتها من لوحة التحكم.");
    const list = (el, arr, msg) => el.innerHTML = arr.length ? arr.map(b => bookCard(b, cats)).join("") : emptyState(msg, "سيظهر المحتوى هنا فور نشره.");
    list(latest, [...books].sort((a, b) => ms(b) - ms(a)).slice(0, 8), "لم تتم إضافة محتوى بعد");
    list(popular, [...books].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8), "لا توجد مشاهدات بعد");
    const f = books.filter(b => b.featured).slice(0, 4);
    if (f.length) { $("#featuredSec").hidden = false; featured.innerHTML = f.map(b => bookCard(b, cats)).join(""); }
    const a = await getAggregateFromServer(published(), { n: count(), v: sum("views"), d: sum("downloads") }).then(r => r.data()).catch(() => ({ n: books.length, v: 0, d: 0 }));
    stats.innerHTML = [[a.n, "ملف منشور"], [cats.length, "قسم"], [a.v, "مشاهدة"], [a.d, "تحميل"]].map(([v, l]) => `<div><b>${num(v)}</b>${l}</div>`).join("");
  } catch (e) { console.error(e); [latest, popular, catsEl].forEach(el => el.innerHTML = errorState()); }
  $("#heroSearch").onsubmit = e => { e.preventDefault(); const q = e.target.q.value.trim(); location.href = "library.html" + (q ? "?q=" + encodeURIComponent(q) : ""); };
}

async function library() {
  const p = new URLSearchParams(location.search);
  const S = { q: p.get("q") || "", cat: p.get("cat") || "", grade: p.get("grade") || "", subject: p.get("subject") || "", sort: p.get("sort") === "views" ? "views" : p.get("sort") === "title" ? "title" : "new" };
  const res = $("#results"); let books = [], cats = [];
  const load = async () => {
    res.innerHTML = skeletons(8); $("#count").textContent = "";
    try { [cats, books] = await Promise.all([loadCategories(), fetchBooks()]); }
    catch (e) { console.error(e); res.innerHTML = errorState(); return; }
    const uniq = k => [...new Set(books.map(b => b[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
    const fill = (sel, arr, all, v) => { $(sel).innerHTML = `<option value="">${all}</option>` + arr.map(x => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join(""); };
    fill("#fgrade", uniq("grade"), "كل الصفوف", S.grade); fill("#fsubject", uniq("subject"), "كل المواد", S.subject);
    $("#fq").value = S.q; $("#fsort").value = S.sort; draw();
  };
  const draw = () => {
    $("#catChips").innerHTML = [`<button class="chip ${S.cat ? "" : "on"}" data-cat="">الكل</button>`, ...cats.map(c => `<button class="chip ${S.cat === c.id ? "on" : ""}" data-cat="${esc(c.id)}">${esc(c.name)}</button>`)].join("");
    const cur = cats.find(c => c.id === S.cat);
    $("#libTitle").textContent = cur ? cur.name : "المكتبة"; $("#libDesc").textContent = cur?.description || "تصفح كل الكتب والمذكرات والملخصات.";
    document.title = (cur ? cur.name : "المكتبة") + " | المكتبة التعليمية";
    const q = norm(S.q.trim());
    let r = books.filter(b => (!S.cat || b.categoryId === S.cat) && (!S.grade || b.grade === S.grade) && (!S.subject || b.subject === S.subject)
      && (!q || norm([b.title, b.subject, b.author, b.description, b.grade].join(" ")).includes(q)));
    r.sort(S.sort === "views" ? (a, b) => (b.views || 0) - (a.views || 0) : S.sort === "title" ? (a, b) => (a.title || "").localeCompare(b.title || "", "ar") : (a, b) => ms(b) - ms(a));
    $("#count").textContent = `${num(r.length)} نتيجة`;
    res.innerHTML = r.length ? r.map(b => bookCard(b, cats)).join("")
      : emptyState(books.length ? "لا توجد نتائج مطابقة" : "لا يوجد محتوى منشور بعد", books.length ? "جرّب كلمات بحث أخرى أو أزل بعض عوامل التصفية." : "تابعنا قريبًا، ستتم إضافة المحتوى.", books.length ? '<br><button class="btn" id="reset">مسح التصفية</button>' : "");
    const u = new URLSearchParams(Object.entries(S).filter(([k, v]) => v && !(k === "sort" && v === "new")));
    history.replaceState(null, "", u.toString() ? "?" + u : location.pathname);
  };
  let t; $("#fq").oninput = e => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value; draw(); }, 200); };
  $("#filters").onsubmit = e => e.preventDefault();
  $("#fgrade").onchange = e => { S.grade = e.target.value; draw(); };
  $("#fsubject").onchange = e => { S.subject = e.target.value; draw(); };
  $("#fsort").onchange = e => { S.sort = e.target.value; draw(); };
  document.addEventListener("click", e => {
    const c = e.target.closest("[data-cat]"); if (c) { S.cat = c.dataset.cat; draw(); }
    if (e.target.id === "reset") { Object.assign(S, { q: "", cat: "", grade: "", subject: "" }); $("#fq").value = ""; $("#fgrade").value = ""; $("#fsubject").value = ""; draw(); }
  });
  retry(load); load();
}

async function book() {
  const box = $("#book"), id = new URLSearchParams(location.search).get("id");
  const fail = (t, d) => box.innerHTML = emptyState(t, d, '<br><a class="btn" href="library.html">العودة إلى المكتبة</a>');
  if (!id) return fail("الرابط غير صحيح", "لم يتم تحديد الكتاب.");
  let b, cats = [], user = null;
  try {
    const [s, c] = await Promise.all([getDoc(doc(db, "books", id)), loadCategories()]); cats = c;
    if (!s.exists()) return fail("الكتاب غير موجود", "ربما تم حذفه أو نقله.");
    b = { id: s.id, ...s.data() };
  } catch (e) { console.error(e); return fail("تعذر فتح الكتاب", "قد لا يكون منشورًا أو توجد مشكلة في الاتصال."); }
  const cat = cats.find(c => c.id === b.categoryId);
  document.title = b.title + " | المكتبة التعليمية";
  const seen = JSON.parse(sessionStorage.getItem("seen") || "[]");
  if (b.published && !seen.includes(id)) {
    sessionStorage.setItem("seen", JSON.stringify([...seen, id]));
    updateDoc(doc(db, "books", id), { views: increment(1) }).then(() => { b.views = (b.views || 0) + 1; $("#vc").textContent = num(b.views); }).catch(() => { });
  }
  box.innerHTML = `<div class="detail"><div class="cover">${b.coverUrl ? `<img src="${esc(b.coverUrl)}" alt="غلاف ${esc(b.title)}">` : icon(cat?.icon || "book", 64)}</div>
  <div><a class="muted" href="library.html${cat ? "?cat=" + encodeURIComponent(cat.id) : ""}">${esc(cat?.name || "المكتبة")}</a><h1>${esc(b.title)}</h1>
  <p class="muted" style="white-space:pre-line">${esc(b.description || "لا يوجد وصف لهذا الملف.")}</p>
  <div class="facts"><div><small>المادة</small>${esc(b.subject || "—")}</div><div><small>الصف</small>${esc(b.grade || "—")}</div><div><small>المؤلف</small>${esc(b.author || "—")}</div>
  <div><small>تاريخ الإضافة</small>${fmtDate(b.createdAt)}</div><div><small>المشاهدات</small><span id="vc">${num(b.views)}</span></div><div><small>التحميلات</small><span id="dc">${num(b.downloads)}</span></div></div>
  <div class="row"><button class="btn primary" id="view">${icon("eye", 18)} عرض الملف</button><a class="btn" id="dl" href="${esc(b.fileUrl)}" target="_blank" rel="noopener" download>${icon("download", 18)} تحميل</a></div></div></div>
  <div id="viewerBox" style="padding-bottom:24px"></div>`;
  $("#view").onclick = () => {
    const v = $("#viewerBox");
    v.innerHTML = v.innerHTML ? "" : `<iframe class="viewer" src="${esc(b.fileUrl)}" title="${esc(b.title)}"></iframe>`;
    $("#view").lastChild.textContent = v.innerHTML ? " إخفاء الملف" : " عرض الملف";
    if (v.innerHTML) v.scrollIntoView({ behavior: "smooth" });
  };
  $("#dl").onclick = () => {
    addDoc(collection(db, "downloads"), { bookId: id, uid: auth.currentUser?.uid || null, createdAt: serverTimestamp() }).catch(() => { });
    updateDoc(doc(db, "books", id), { downloads: increment(1) }).then(() => { b.downloads = (b.downloads || 0) + 1; $("#dc").textContent = num(b.downloads); }).catch(() => { });
  };
}

watchUser();
({ home, library, book })[page]?.();
