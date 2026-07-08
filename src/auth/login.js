// ============================================================
// login.js — Lógica de login de usuário
// Finança Fácil | src/auth/login.js
// ============================================================

import { auth } from "../firebase/firebase-config.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ── Mapeamento de erros Firebase → Português ──────────────────
const ERROS_FIREBASE = {
  "auth/invalid-email":           "Formato de e-mail inválido.",
  "auth/user-not-found":          "Usuário não encontrado. Verifique o e-mail.",
  "auth/wrong-password":          "Senha incorreta. Tente novamente.",
  "auth/invalid-credential":      "E-mail ou senha inválidos.",
  "auth/user-disabled":           "Esta conta foi desativada.",
  "auth/too-many-requests":       "Muitas tentativas. Aguarde alguns minutos.",
  "auth/network-request-failed":  "Sem conexão com a internet. Tente novamente.",
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
  ["email", "senha"].forEach(f => setFieldError(f, ""));
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
  const btn = $("btnEntrar");
  btn.disabled = isLoading;
  btn.classList.toggle("loading", isLoading);
}

// ── Validação client-side ──────────────────────────────────────
function validarFormulario(email, senha) {
  let valido = true;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    setFieldError("email", "Informe seu e-mail.");
    valido = false;
  } else if (!emailRegex.test(email)) {
    setFieldError("email", "Formato de e-mail inválido.");
    valido = false;
  }

  if (!senha) {
    setFieldError("senha", "Informe sua senha.");
    valido = false;
  } else if (senha.length < 6) {
    setFieldError("senha", "A senha deve ter mínimo 6 caracteres.");
    valido = false;
  }

  return valido;
}

// ── Lógica de login ────────────────────────────────────────────
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();
  hideAlert();

  const email = $("email").value.trim();
  const senha = $("senha").value;

  if (!validarFormulario(email, senha)) return;

  setLoading(true);

  try {
    await signInWithEmailAndPassword(auth, email, senha);

    showAlert("Login realizado! Redirecionando…", "success");

    setTimeout(() => {
      window.location.href = "../dashboard/dashboard.html";
    }, 1000);

  } catch (error) {
    console.error("Erro no login:", error);
    showAlert(traduzirErro(error.code));
    setLoading(false);
  }
});

// ── Toggle visibilidade de senha ───────────────────────────────
$("toggleSenha").addEventListener("click", () => {
  const input = $("senha");
  const isText = input.type === "text";
  input.type = isText ? "password" : "text";
  const icon = $("eyeIconSenha");
  icon.innerHTML = isText
    ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`
    : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
});
