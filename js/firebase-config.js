import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA2CgPEz8lsg3_TgssH5KXAlor2E9AlSSc",
    authDomain: "task-manager-app-75370.firebaseapp.com",
    projectId: "task-manager-app-75370",
    storageBucket: "task-manager-app-75370.firebasestorage.app",
    messagingSenderId: "717045816947",
    appId: "1:717045816947:web:3f7c922979f0796621d406",
    measurementId: "G-E69LC4CXGN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);