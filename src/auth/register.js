// ============================================================
// register.js — Lógica de cadastro de usuário
// Finança Fácil | src/auth/register.js
// ============================================================

import { auth, db } from "../firebase/firebase-config.js";
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Mapeamento de erros Firebase → Português ──────────────────
const ERROS_FIREBASE = {
  "auth/email-already-in-use":    "Este e-mail já está cadastrado.",
  "auth/invalid-email":           "Formato de e-mail inválido.",
  "auth/weak-password":           "A senha deve ter pelo menos 6 caracteres.",
  "auth/network-request-failed":  "Sem conexão com a internet. Tente novamente.",
  "auth/too-many-requests":       "Muitas tentativas. Aguarde alguns minutos.",
};

function traduzirErro(code) {
  return ERROS_FIREBASE[code] || "Ocorreu um erro inesperado. Tente novamente.";
}

// ── Utilitários de UI ──────────────────────────────────────────
const $ = id => document.getElementById(id);

function setFieldError(fieldId, msg) {
  const input = $(fieldId);
  const err   = $(`${fieldId}Error`);
  if (msg) {
    input.classList.add("error");
    err.textContent = msg;
  } else {
    input.classList.remove("error");
    err.textContent = "";
  }
}

function clearErrors() {
  ["nome", "email", "senha", "confirmarSenha"].forEach(f => setFieldError(f, ""));
}

function showAlert(msg, type = "error") {
  const box = $("alertBox");
  $("alertMsg").textContent = msg;
  box.className = `alert show ${type}`;
}

function hideAlert() {
  $("alertBox").className = "alert";
}

function setLoading(isLoading) {
  const btn = $("btnCadastrar");
  btn.disabled = isLoading;
  btn.classList.toggle("loading", isLoading);
}

// ── Validação client-side ──────────────────────────────────────
function validarFormulario(nome, email, senha, confirmar) {
  let valido = true;

  if (!nome.trim()) {
    setFieldError("nome", "Informe seu nome completo.");
    valido = false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.trim()) {
    setFieldError("email", "Informe seu e-mail.");
    valido = false;
  } else if (!emailRegex.test(email.trim())) {
    setFieldError("email", "Formato de e-mail inválido.");
    valido = false;
  }

  if (!senha) {
    setFieldError("senha", "Informe uma senha.");
    valido = false;
  } else if (senha.length < 6) {
    setFieldError("senha", "A senha deve ter mínimo 6 caracteres.");
    valido = false;
  }

  if (!confirmar) {
    setFieldError("confirmarSenha", "Confirme sua senha.");
    valido = false;
  } else if (senha !== confirmar) {
    setFieldError("confirmarSenha", "As senhas não coincidem.");
    valido = false;
  }

  return valido;
}

// ── Lógica de cadastro ─────────────────────────────────────────
$("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();
  hideAlert();

  const nome      = $("nome").value;
  const email     = $("email").value.trim();
  const senha     = $("senha").value;
  const confirmar = $("confirmarSenha").value;

  if (!validarFormulario(nome, email, senha, confirmar)) return;

  setLoading(true);

  try {
    // 1. Cria o usuário no Firebase Auth
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    const user = cred.user;

    // 2. Atualiza o displayName
    await updateProfile(user, { displayName: nome.trim() });

    // 3. Cria o documento do usuário no Firestore
    await setDoc(doc(db, "users", user.uid), {
      nome:        nome.trim(),
      email:       email,
      dataCriacao: serverTimestamp(),
    });

    showAlert("Conta criada com sucesso! Redirecionando…", "success");

    // 4. Redireciona para o dashboard
    setTimeout(() => {
      window.location.href = "../dashboard/dashboard.html";
    }, 1500);

  } catch (error) {
    console.error("Erro no cadastro:", error);
    showAlert(traduzirErro(error.code));
    setLoading(false);
  }
});

// ── Toggle visibilidade de senha ───────────────────────────────
function initTogglePassword(btnId, inputId, iconId) {
  $(btnId).addEventListener("click", () => {
    const input = $(inputId);
    const isText = input.type === "text";
    input.type = isText ? "password" : "text";
    const eyeIcon = $(iconId);
    eyeIcon.innerHTML = isText
      ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`
      : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  });
}

initTogglePassword("toggleSenha",    "senha",         "eyeIconSenha");
initTogglePassword("toggleConfirmar", "confirmarSenha", "eyeIconConfirmar");
