import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { $, $$, watchUser } from "./main.js";

const ERR = {
  "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "auth/user-not-found": "لا يوجد حساب بهذا البريد.",
  "auth/wrong-password": "كلمة المرور غير صحيحة.",
  "auth/email-already-in-use": "هذا البريد مسجل مسبقًا. جرّب تسجيل الدخول.",
  "auth/weak-password": "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.",
  "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
  "auth/too-many-requests": "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.",
  "auth/network-request-failed": "تعذر الاتصال بالإنترنت."
};
const page = document.body.dataset.page;
const nextUrl = () => { const n = new URLSearchParams(location.search).get("next"); return n && /^[\w.-]+\.html(\?[\w=&%.-]*)?$/.test(n) ? n : "library.html"; };
const show = (el, text, type = "error") => { el.innerHTML = text ? `<div class="alert ${type}" role="alert">${text}</div>` : ""; };
const fieldErr = (input, text) => { input.parentElement.querySelector(".err").textContent = text || ""; input.setAttribute("aria-invalid", text ? "true" : "false"); return !text; };
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const busy = (btn, on, label) => { btn.disabled = on; if (label) btn.textContent = on ? "جارٍ المعالجة..." : label; };
let submitting = false;

watchUser(u => { if (u && !submitting) location.replace(nextUrl()); });

if (page === "login") {
  const form = $("#loginForm"), msg = $("#msg");
  form.onsubmit = async e => {
    e.preventDefault(); show(msg, "");
    const em = $("#email").value.trim(), pw = $("#password").value;
    const ok = [fieldErr($("#email"), emailOk(em) ? "" : "أدخل بريدًا صحيحًا"), fieldErr($("#password"), pw ? "" : "أدخل كلمة المرور")].every(Boolean);
    if (!ok) return;
    const btn = form.querySelector("button"); busy(btn, true, "دخول"); submitting = true;
    try { await signInWithEmailAndPassword(auth, em, pw); location.replace(nextUrl()); }
    catch (err) { submitting = false; show(msg, ERR[err.code] || "تعذر تسجيل الدخول. حاول مرة أخرى."); busy(btn, false, "دخول"); }
  };
  const swap = r => { $("#loginBox").hidden = r; $("#resetBox").hidden = !r; };
  $("#showReset").onclick = e => { e.preventDefault(); swap(true); };
  $("#backLogin").onclick = e => { e.preventDefault(); swap(false); };
  $("#resetForm").onsubmit = async e => {
    e.preventDefault(); const em = $("#remail").value.trim(), box = $("#rmsg");
    if (!fieldErr($("#remail"), emailOk(em) ? "" : "أدخل بريدًا صحيحًا")) return;
    const btn = e.target.querySelector("button"); busy(btn, true, "إرسال الرابط");
    try { await sendPasswordResetEmail(auth, em); show(box, "إذا كان البريد مسجلًا فسيصلك رابط إعادة التعيين خلال دقائق.", "ok"); }
    catch (err) { show(box, ERR[err.code] || "تعذر إرسال الرابط. حاول لاحقًا."); }
    busy(btn, false, "إرسال الرابط");
  };
}

if (page === "register") {
  const form = $("#regForm"), msg = $("#msg");
  form.onsubmit = async e => {
    e.preventDefault(); show(msg, "");
    const name = $("#name").value.trim(), em = $("#email").value.trim(), pw = $("#password").value, cf = $("#confirm").value;
    const ok = [
      fieldErr($("#name"), name.length >= 2 ? "" : "أدخل اسمك (حرفان على الأقل)"),
      fieldErr($("#email"), emailOk(em) ? "" : "أدخل بريدًا صحيحًا"),
      fieldErr($("#password"), pw.length >= 8 ? "" : "كلمة المرور أقل من 8 أحرف"),
      fieldErr($("#confirm"), pw === cf ? "" : "كلمتا المرور غير متطابقتين")
    ].every(Boolean);
    if (!ok) return;
    const btn = form.querySelector("button"); busy(btn, true, "إنشاء الحساب"); submitting = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, em, pw);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), { displayName: name, email: em, role: "student", status: "active", createdAt: serverTimestamp() });
      location.replace(nextUrl());
    } catch (err) { submitting = false; show(msg, ERR[err.code] || "تعذر إنشاء الحساب. حاول مرة أخرى."); busy(btn, false, "إنشاء الحساب"); }
  };
}
