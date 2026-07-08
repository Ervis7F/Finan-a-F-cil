// ============================================================
// firebase-config.js — Inicialização do Firebase
// Finança Fácil | src/firebase/firebase-config.js
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBV2OMJkYXLnPIAM8gCEzAlwPm0kWFJ1cA",
  authDomain:        "financa-facil-28cef.firebaseapp.com",
  projectId:         "financa-facil-28cef",
  storageBucket:     "financa-facil-28cef.firebasestorage.app",
  messagingSenderId: "467465835803",
  appId:             "1:467465835803:web:3eea0a666f35dc9341afbe"
};

// Inicializa o Firebase App
const app = initializeApp(firebaseConfig);

// Exporta as instâncias usadas pelos módulos
export const auth = getAuth(app);
export const db   = getFirestore(app);
