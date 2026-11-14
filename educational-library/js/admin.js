import { db, storage, auth } from "./firebase-config.js";
import { collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, getCountFromServer, getAggregateFromServer, sum, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { $, esc, num, fmtDate, icon, ICONS, toast, watchUser, skeletons, emptyState, errorState } from "./main.js";

const app = $("#app"), dlg = $("#dlg");
const S = { tab: "overview", books: [], cats: [], users: [], me: null };
const TABS = [["overview", "نظرة عامة"], ["books", "الكتب والملفات"], ["cats", "الأقسام"], ["users", "المستخدمون"], ["settings", "إعدادات الموقع"]];
const ICON_NAMES = { book: "كتاب", file: "ملف", clipboard: "امتحان", code: "برمجة", grad: "كورس", layers: "ملخص" };
const DEFAULT_CATS = [["books", "الكتب التعليمية", "book", "كتب المناهج والمراجع الدراسية."], ["notes", "المذكرات", "file", "مذكرات الشرح والمراجعة."], ["summaries", "الملخصات", "layers", "ملخصات مركزة للمراجعة السريعة."], ["exams", "الامتحانات", "clipboard", "نماذج امتحانات وأسئلة سابقة."], ["programming", "البرمجة", "code", "مصادر تعلم البرمجة وعلوم الحاسب."], ["courses", "الكورسات", "grad", "كورسات ومسارات تعليمية."], ["files", "الملفات التعليمية", "file", "ملفات ومرفقات دراسية متنوعة."]];

watchUser((u, p) => {
  if (!u) return location.replace("login.html?next=admin.html");
  if (p?.role !== "admin") return app.innerHTML = emptyState("غير مصرح لك بالدخول", "هذه الصفحة مخصصة لمديري المنصة فقط.", '<br><a class="btn" href="index.html">العودة للرئيسية</a>');
  S.me = u; shell(); go(S.tab);
});

function shell() {
  app.innerHTML = `<h1>لوحة التحكم</h1><div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}">${l}</button>`).join("")}</div><div id="panel"></div>`;
  app.onclick = onClick;
}
async function go(tab) {
  S.tab = tab; app.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  const panel = $("#panel"); panel.innerHTML = `<div class="grid">${skeletons(3)}</div>`;
  try { await views[tab](panel); } catch (e) { console.error(e); panel.innerHTML = errorState("تعذر تحميل البيانات. تأكد من نشر قواعد الأمان وصلاحياتك.").replace("data-retry", 'data-act="retry"'); }
}
const getAll = async n => (await getDocs(collection(db, n))).docs.map(d => ({ id: d.id, ...d.data() }));
const catName = id => S.cats.find(c => c.id === id)?.name || "—";
const confirmBox = m => confirm(m);

const views = {
  async overview(el) {
    const cnt = async (n) => (await getCountFromServer(collection(db, n))).data().count;
    const [b, c, u, a] = await Promise.all([cnt("books"), cnt("categories"), cnt("users"), getAggregateFromServer(collection(db, "books"), { v: sum("views"), d: sum("downloads") })]);
    const r = a.data();
    el.innerHTML = `<div class="stats">${[[b, "ملف"], [c, "قسم"], [u, "مستخدم"], [r.v, "مشاهدة"], [r.d, "تحميل"]].map(([v, l]) => `<div><b>${num(v)}</b>${l}</div>`).join("")}</div>
    <p class="muted" style="margin-top:16px">ابدأ بإضافة الأقسام ثم ارفع الملفات من تبويب «الكتب والملفات».</p>`;
  },
  async books(el) {
    [S.books, S.cats] = await Promise.all([getAll("books"), getAll("categories")]);
    S.cats.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)); S.books.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    el.innerHTML = `<div class="bar"><input id="bq" placeholder="بحث في الملفات" style="max-width:320px" aria-label="بحث"><button class="btn primary" data-act="book-new">${icon("file", 18)} إضافة ملف</button></div><div class="tw"><table id="bt"></table></div>`;
    const draw = () => {
      const q = $("#bq").value.trim().toLowerCase(), r = S.books.filter(b => !q || (b.title + b.subject + b.author).toLowerCase().includes(q));
      $("#bt").innerHTML = `<thead><tr><th></th><th>العنوان</th><th>القسم</th><th>مشاهدات</th><th>الحالة</th><th></th></tr></thead><tbody>${r.length ? r.map(b => `<tr><td>${b.coverUrl ? `<img class="thumb" src="${esc(b.coverUrl)}" alt="">` : '<div class="thumb"></div>'}</td>
      <td><b>${esc(b.title)}</b><br><small class="muted">${esc([b.subject, b.grade].filter(Boolean).join(" - "))}</small></td><td>${esc(catName(b.categoryId))}</td><td>${num(b.views)}</td>
      <td><span class="tag ${b.published ? "ok" : "off"}">${b.published ? "منشور" : "مخفي"}</span></td>
      <td><div class="row"><button class="btn sm" data-act="book-pub" data-id="${b.id}">${b.published ? "إخفاء" : "نشر"}</button><button class="btn sm" data-act="book-edit" data-id="${b.id}">تعديل</button><button class="btn sm danger" data-act="book-del" data-id="${b.id}">حذف</button></div></td></tr>`).join("") : `<tr><td colspan="6">${emptyState("لا توجد ملفات", "اضغط «إضافة ملف» لرفع أول كتاب.")}</td></tr>`}</tbody>`;
    };
    $("#bq").oninput = draw; draw();
  },
  async cats(el) {
    [S.cats, S.books] = await Promise.all([getAll("categories"), getAll("books")]); S.cats.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    el.innerHTML = `<div class="bar"><span class="muted">${num(S.cats.length)} قسم</span><div class="row">${S.cats.length ? "" : '<button class="btn" data-act="cat-seed">إضافة الأقسام الافتراضية</button>'}<button class="btn primary" data-act="cat-new">إضافة قسم</button></div></div>
    <div class="tw"><table><thead><tr><th>القسم</th><th>الأيقونة</th><th>الترتيب</th><th>الملفات</th><th></th></tr></thead><tbody>${S.cats.length ? S.cats.map(c => `<tr><td><b>${esc(c.name)}</b><br><small class="muted">${esc(c.description || "")}</small></td><td>${icon(c.icon)}</td><td>${num(c.order)}</td><td>${num(S.books.filter(b => b.categoryId === c.id).length)}</td>
    <td><div class="row"><button class="btn sm" data-act="cat-edit" data-id="${c.id}">تعديل</button><button class="btn sm danger" data-act="cat-del" data-id="${c.id}">حذف</button></div></td></tr>`).join("") : `<tr><td colspan="5">${emptyState("لا توجد أقسام", "أضف قسمًا أو استخدم الأقسام الافتراضية.")}</td></tr>`}</tbody></table></div>`;
  },
  async users(el) {
    S.users = await getAll("users"); S.users.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    el.innerHTML = `<div class="tw"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>التسجيل</th><th></th></tr></thead><tbody>${S.users.map(u => { const me = u.id === S.me.uid; return `<tr><td>${esc(u.displayName)}</td><td dir="ltr" style="text-align:right">${esc(u.email)}</td><td>${u.role === "admin" ? "مدير" : "طالب"}</td>
    <td><span class="tag ${u.status === "blocked" ? "off" : "ok"}">${u.status === "blocked" ? "موقوف" : "نشط"}</span></td><td>${fmtDate(u.createdAt)}</td>
    <td>${me ? '<span class="muted">حسابك</span>' : `<div class="row"><button class="btn sm" data-act="user-block" data-id="${u.id}">${u.status === "blocked" ? "تفعيل" : "إيقاف"}</button><button class="btn sm" data-act="user-role" data-id="${u.id}">${u.role === "admin" ? "إلغاء الإدارة" : "ترقية لمدير"}</button></div>`}</td></tr>`; }).join("")}</tbody></table></div>`;
  },
  async settings(el) {
    const s = (await getDoc(doc(db, "settings", "site"))).data() || {};
    el.innerHTML = `<form id="sf" style="max-width:640px"><div class="field"><label for="ht">عنوان الصفحة الرئيسية</label><input id="ht" maxlength="90" value="${esc(s.heroTitle || "")}"></div>
    <div class="field"><label for="hx">النص التعريفي أسفل العنوان</label><textarea id="hx" maxlength="240">${esc(s.heroText || "")}</textarea></div>
    <div class="field"><label for="ab">نص «عن المكتبة»</label><textarea id="ab" maxlength="500">${esc(s.aboutText || "")}</textarea></div><button class="btn primary">حفظ الإعدادات</button></form>`;
    $("#sf").onsubmit = async e => { e.preventDefault(); await act(e.submitter, () => setDoc(doc(db, "settings", "site"), { heroTitle: $("#ht").value.trim(), heroText: $("#hx").value.trim(), aboutText: $("#ab").value.trim() }, { merge: true }), "تم حفظ الإعدادات"); };
  }
};

async function act(btn, fn, ok) {
  const t = btn?.textContent; if (btn) btn.disabled = true;
  try { await fn(); if (ok) toast(ok, "success"); return true; }
  catch (e) { console.error(e); toast(e.code === "permission-denied" ? "لا تملك صلاحية تنفيذ هذا الإجراء." : "تعذر تنفيذ العملية. حاول مرة أخرى.", "error"); return false; }
  finally { if (btn) { btn.disabled = false; btn.textContent = t; } }
}

async function onClick(e) {
  const t = e.target.closest("[data-tab],[data-act]"); if (!t) return;
  if (t.dataset.tab) return go(t.dataset.tab);
  const { act: a, id } = t.dataset, book = S.books.find(b => b.id === id), cat = S.cats.find(c => c.id === id), user = S.users.find(u => u.id === id);
  if (a === "retry") return go(S.tab);
  if (a === "book-new") return bookForm();
  if (a === "book-edit") return bookForm(book);
  if (a === "book-pub" && await act(t, () => updateDoc(doc(db, "books", id), { published: !book.published, updatedAt: serverTimestamp() }), book.published ? "تم إخفاء الملف" : "تم نشر الملف")) go("books");
  if (a === "book-del" && confirmBox(`حذف «${book.title}» نهائيًا مع ملفاته؟`)) {
    if (await act(t, async () => { await deleteDoc(doc(db, "books", id)); for (const p of [book.filePath, book.coverPath]) if (p) await deleteObject(ref(storage, p)).catch(() => { }); }, "تم حذف الملف")) go("books");
  }
  if (a === "cat-new") return catForm();
  if (a === "cat-edit") return catForm(cat);
  if (a === "cat-seed" && await act(t, () => Promise.all(DEFAULT_CATS.map(([cid, name, ic, description], i) => setDoc(doc(db, "categories", cid), { name, icon: ic, description, order: i + 1 }))), "تمت إضافة الأقسام")) go("cats");
  if (a === "cat-del") {
    const n = S.books.filter(b => b.categoryId === id).length;
    if (n) return toast(`لا يمكن حذف قسم يحتوي على ${num(n)} ملف. انقل الملفات أولًا.`, "error");
    if (confirmBox(`حذف قسم «${cat.name}»؟`) && await act(t, () => deleteDoc(doc(db, "categories", id)), "تم حذف القسم")) go("cats");
  }
  if (a === "user-block" && await act(t, () => updateDoc(doc(db, "users", id), { status: user.status === "blocked" ? "active" : "blocked" }), "تم تحديث الحساب")) go("users");
  if (a === "user-role" && confirmBox(user.role === "admin" ? "سحب صلاحية الإدارة من هذا المستخدم؟" : "منح هذا المستخدم صلاحيات المدير الكاملة؟") && await act(t, () => updateDoc(doc(db, "users", id), { role: user.role === "admin" ? "student" : "admin" }), "تم تحديث الصلاحية")) go("users");
}

const close = () => dlg.close();
dlg.addEventListener("click", e => { if (e.target === dlg || e.target.dataset.close !== undefined) close(); });

function catForm(c) {
  dlg.innerHTML = `<h3>${c ? "تعديل القسم" : "إضافة قسم"}</h3><form id="cf"><div class="field"><label>اسم القسم</label><input name="name" required maxlength="40" value="${esc(c?.name || "")}"></div>
  <div class="field"><label>وصف مختصر</label><input name="description" maxlength="120" value="${esc(c?.description || "")}"></div>
  <div class="two"><div class="field"><label>الأيقونة</label><select name="icon">${ICONS.map(i => `<option value="${i}" ${c?.icon === i ? "selected" : ""}>${ICON_NAMES[i]}</option>`).join("")}</select></div>
  <div class="field"><label>الترتيب</label><input name="order" type="number" min="1" value="${c?.order ?? S.cats.length + 1}"></div></div>
  <div class="row"><button class="btn primary">حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`;
  dlg.showModal();
  $("#cf").onsubmit = async e => {
    e.preventDefault(); const f = e.target, d = { name: f.name.value.trim(), description: f.description.value.trim(), icon: f.icon.value, order: Number(f.order.value) || 1 };
    if (!d.name) return toast("أدخل اسم القسم", "error");
    if (await act(e.submitter, () => c ? updateDoc(doc(db, "categories", c.id), d) : addDoc(collection(db, "categories"), d), "تم حفظ القسم")) { close(); go("cats"); }
  };
}

function bookForm(b) {
  if (!S.cats.length) return toast("أضف قسمًا واحدًا على الأقل قبل رفع الملفات.", "error");
  dlg.innerHTML = `<h3>${b ? "تعديل الملف" : "إضافة ملف"}</h3><form id="bf">
  <div class="field"><label>العنوان</label><input name="title" required maxlength="140" value="${esc(b?.title || "")}"></div>
  <div class="two"><div class="field"><label>القسم</label><select name="categoryId">${S.cats.map(c => `<option value="${c.id}" ${b?.categoryId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
  <div class="field"><label>المادة</label><input name="subject" maxlength="60" value="${esc(b?.subject || "")}"></div></div>
  <div class="two"><div class="field"><label>الصف الدراسي</label><input name="grade" maxlength="60" value="${esc(b?.grade || "")}"></div>
  <div class="field"><label>المؤلف (اختياري)</label><input name="author" maxlength="80" value="${esc(b?.author || "")}"></div></div>
  <div class="field"><label>الوصف</label><textarea name="description" maxlength="1000">${esc(b?.description || "")}</textarea></div>
  <div class="field"><label>ملف PDF ${b ? "(اتركه فارغًا للإبقاء على الحالي)" : ""}</label><input name="pdf" type="file" accept="application/pdf"></div>
  <div class="field"><label>صورة الغلاف (JPG أو PNG أو WebP)</label><input name="cover" type="file" accept="image/jpeg,image/png,image/webp"></div>
  <label class="check"><input type="checkbox" name="published" ${!b || b.published ? "checked" : ""}> نشر الملف للزوار</label>
  <label class="check" style="margin-bottom:14px"><input type="checkbox" name="featured" ${b?.featured ? "checked" : ""}> عرضه ضمن المصادر المميزة</label>
  <progress id="pg" max="100" value="0" hidden></progress>
  <div class="row"><button class="btn primary">حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`;
  dlg.showModal();
  $("#bf").onsubmit = async e => {
    e.preventDefault(); const f = e.target, pdf = f.pdf.files[0], img = f.cover.files[0], pg = $("#pg");
    const title = f.title.value.trim();
    if (!title) return toast("أدخل عنوان الملف", "error");
    if (!b && !pdf) return toast("اختر ملف PDF للرفع", "error");
    if (pdf && (pdf.type !== "application/pdf" || pdf.size > 50 * 1024 * 1024)) return toast("الملف يجب أن يكون PDF وبحجم أقل من 50 ميجابايت", "error");
    if (img && (!/^image\/(jpeg|png|webp)$/.test(img.type) || img.size > 5 * 1024 * 1024)) return toast("الغلاف يجب أن يكون صورة بحجم أقل من 5 ميجابايت", "error");
    const d = { title, categoryId: f.categoryId.value, subject: f.subject.value.trim(), grade: f.grade.value.trim(), author: f.author.value.trim(), description: f.description.value.trim(), published: f.published.checked, featured: f.featured.checked, updatedAt: serverTimestamp() };
    const r = b ? doc(db, "books", b.id) : doc(collection(db, "books")), old = [];
    const up = (file, path) => new Promise((res, rej) => {
      pg.hidden = false; const t = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
      t.on("state_changed", s => pg.value = (s.bytesTransferred / s.totalBytes) * 100, rej, async () => res(await getDownloadURL(t.snapshot.ref)));
    });
    const ok = await act(e.submitter, async () => {
      if (pdf) { d.filePath = `books/${r.id}/${Date.now()}.pdf`; d.fileUrl = await up(pdf, d.filePath); if (b?.filePath) old.push(b.filePath); }
      if (img) { const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[img.type]; d.coverPath = `books/${r.id}/cover-${Date.now()}.${ext}`; d.coverUrl = await up(img, d.coverPath); if (b?.coverPath) old.push(b.coverPath); }
      if (b) await updateDoc(r, d); else await setDoc(r, { ...d, views: 0, downloads: 0, createdAt: serverTimestamp() });
      for (const p of old) await deleteObject(ref(storage, p)).catch(() => { });
    }, "تم حفظ الملف");
    pg.hidden = true; if (ok) { close(); go("books"); }
  };
}
