// ============================================================
// bancos.js — Lógica de cadastro e leitura de bancos
// Finança Fácil | src/emprestimos/bancos/bancos.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  collection, query, orderBy, onSnapshot, getDocs, where,
  addDoc, serverTimestamp, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let unsubscribeBancos = null;

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function maskPix(chave, tipo) {
  if (!chave) return "Nenhuma chave cadastrada";
  // CPF: xxx.xxx.xxx-00 -> ***.***.***-00
  if (tipo === "cpf" && chave.length >= 11) return "***.***.***-" + chave.slice(-2);
  // Email: foo@bar.com -> f***@bar.com
  if (tipo === "email" && chave.includes("@")) { 
    return chave[0] + "***" + chave.substring(chave.indexOf("@")); 
  }
  // Telefone: (00) 90000-0000 -> (**) *****-**00
  if (tipo === "telefone" && chave.length >= 8) return "***" + chave.slice(-4);
  // Aleatoria mascara o início
  if (tipo === "aleatoria" && chave.length >= 10) return "***" + chave.slice(-6);
  
  // Genérico
  return "***" + chave.slice(-4);
}

// Global functions for inline html onclick
window.toggleBancoAtivo = async function(id, valAtual) {
  try {
    await updateDoc(doc(db, `users/${currentUser.uid}/bancos`, id), { ativo: !valAtual });
  } catch(e) { alert("Erro ao mudar status."); }
}

window.deletarBanco = async function(id) {
  // Check if debtors exist
  const qDev = query(collection(db, `users/${currentUser.uid}/devedores`), where("bancoId", "==", id));
  const snap = await getDocs(qDev);

  if (!snap.empty) {
    alert("Operação bloqueada! Você não pode excluir este banco pois ele possui devedores vinculados (histórico ou pagamentos em aberto).");
    return;
  }

  if (confirm("Você quer mesmo excluir este banco?")) {
    await deleteDoc(doc(db, `users/${currentUser.uid}/bancos`, id));
  }
}

function loadBancos() {
  if (!currentUser) return;
  if (unsubscribeBancos) unsubscribeBancos();

  const q = query(collection(db, `users/${currentUser.uid}/bancos`), orderBy("dataCriacao", "desc"));
  
  unsubscribeBancos = onSnapshot(q, (snapshot) => {
    let totGeral = 0;
    let totUsado = 0;
    
    const grid = $("bancosGrid");
    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML = `<div class="empty-state">⚠️ Você não tem nenhum banco cadastrado. Crie o primeiro!</div>`;
    } else {
      snapshot.forEach(docSnap => {
        const b = docSnap.data();
        const id = docSnap.id;
        
        // Limite disponivel
        const disp = b.limiteTotal - b.limiteUsado;
        
        if (b.ativo) {
          totGeral += b.limiteTotal;
          totUsado += b.limiteUsado;
        }

        const bgClass = b.ativo ? "ativo" : "inativo";
        const txtClass = b.ativo ? "Ativo" : "Inativo";
        const opcClass = b.ativo ? "" : "inativo";

        let htmlPix = "";
        if (b.chavePix) {
           htmlPix = `<div class="b-pix"><strong>Pix. </strong>${maskPix(b.chavePix, b.tipoChavePix)}</div>`;
        }

        const card = document.createElement("div");
        card.className = `banco-card ${opcClass}`;
        card.innerHTML = `
          <div class="b-header">
            <div>
              <div class="b-banco">${b.nomeBanco}</div>
              <div class="b-cartao">${b.nomeCartao}</div>
            </div>
            <span class="b-badge ${bgClass}">${txtClass}</span>
          </div>

          <div class="b-stats">
            <div class="b-stat-row">
              <span class="b-stat-lbl">Limite Total</span>
              <span class="b-stat-val">${formatBRL(b.limiteTotal)}</span>
            </div>
            <div class="b-stat-row" style="color:var(--red-500)">
              <span class="b-stat-lbl" style="color:var(--red-500)">Limite Usado</span>
              <span class="b-stat-val">${formatBRL(b.limiteUsado)}</span>
            </div>
            <div class="b-stat-row" style="color:var(--green-600)">
              <span class="b-stat-lbl" style="color:var(--green-600)">Limite Disponível</span>
              <span class="b-stat-val">${formatBRL(disp)}</span>
            </div>
          </div>
          
          ${htmlPix}

          <div class="b-actions">
            <button class="btn-action" onclick="toggleBancoAtivo('${id}', ${b.ativo})">${b.ativo ? 'Desativar' : 'Reativar'}</button>
            <button class="btn-action danger" onclick="deletarBanco('${id}')">Excluir</button>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    $("resumoTotal").textContent = formatBRL(totGeral);
    $("resumoUsado").textContent = formatBRL(totUsado);
    $("resumoDisponivel").textContent = formatBRL(totGeral - totUsado);
  });
}

$("formBanco").addEventListener("submit", async(e) => {
  e.preventDefault();
  $("btnSalvar").disabled = true;

  const nomeBanco = $("bancoNome").value.trim();
  const nomeCartao = $("cartaoNome").value.trim();
  const limiteTotal = Number($("bancoLimiteTotal").value);
  const limiteUsado = Number($("bancoLimiteUsado").value);
  const chavePix = $("bancoPix").value.trim();
  const tipoChavePix = $("bancoTipoPix").value;
  const ativo = $("bancoAtivo").checked;

  if (limiteUsado > limiteTotal) {
    alert("O limite usado não pode ser maior que o limite total!");
    $("btnSalvar").disabled = false;
    return;
  }

  try {
    await addDoc(collection(db, `users/${currentUser.uid}/bancos`), {
      nomeBanco, nomeCartao,
      limiteTotal, limiteUsado,
       // limiteDisponivel is virtualized,
      chavePix, tipoChavePix,
      ativo,
      dataCriacao: serverTimestamp()
    });
    
    $("formBanco").reset();
    $("bancoAtivo").checked = true;
  } catch (error) {
    console.error("Erro ao salvar", error);
    alert("Erro ao adicionar.");
  }
  $("btnSalvar").disabled = false;
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../../auth/login.html");
    return;
  }
  currentUser = user;
  loadBancos();
});
