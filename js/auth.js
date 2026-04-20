import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const nameGroup = document.getElementById("nameGroup");
const submitBtn = document.getElementById("submitBtn");
const authError = document.getElementById("authError");
const authForm = document.getElementById("authForm");

let isLogin = true;

function setMode(login) {
  isLogin = login;
  loginTab.classList.toggle("active", login);
  registerTab.classList.toggle("active", !login);
  nameGroup.style.display = login ? "none" : "block";
  submitBtn.textContent = login ? "Войти" : "Создать аккаунт";
  authError.textContent = "";
}

loginTab.addEventListener("click", () => setMode(true));
registerTab.addEventListener("click", () => setMode(false));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const username = document.getElementById("username").value.trim();

  try {
    if (isLogin) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      if (!username) {
        authError.textContent = "Введите имя пользователя";
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: username });

      await setDoc(doc(db, "users", cred.user.uid, "profile", "data"), {
        username,
        email,
        level: 1,
        xp: 0,
        streak: 0,
        lastCompletedDate: null,
        createdAt: serverTimestamp()
      });
    }

    window.location.href = "app.html";
  } catch (err) {
    authError.textContent = "Ошибка: " + (err.code || "unknown");
  }
});
loginTab.addEventListener("click", () => {
    console.log("login");
    setMode(true);
  });
  
  registerTab.addEventListener("click", () => {
    console.log("register");
    setMode(false);
  });
