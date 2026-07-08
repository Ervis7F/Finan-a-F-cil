// ============================================================
// devedores.js — Lógica de cadastro e leitura de devedores
// Finança Fácil | src/emprestimos/devedores/devedores.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  collection, query, orderBy, onSnapshot, getDocs, where,
  addDoc, serverTimestamp, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let unsubscribeDevedores = null;
const BANCOS_CACHE = {}; // Map of bancoId -> { nomeBanco, nomeCartao }

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Calculo em tempo real da projeção de juros simples: Total = Emprestado + (Emprestado * juros * parcelas)
// Ou juros compostos? Vamos fazer um cálculo de juros simples para facilitar.
function calcularTotalProjetado() {
  const v = Number($("devValorEmprestado").value) || 0;
  const j = Number($("devJuros").value) || 0;
  const p = Number($("devParcelas").value) || 1;
  
  if (v > 0) {
    const tot = v * (1 + (j / 100) * p);
    $("prevTotal").textContent = "Total a receber: " + formatBRL(tot);
    $("prevCalculo").style.display = "block";
  } else {
    $("prevCalculo").style.display = "none";
  }
}

["devValorEmprestado", "devJuros", "devParcelas"].forEach(id => {
  $(id).addEventListener("input", calcularTotalProjetado);
});

// Carregar Lista de Bancos Ativos no Select
async function populateBancosSelect() {
  const sel = $("devBancoSelect");
  const q = query(collection(db, `users/${currentUser.uid}/bancos`), where("ativo", "==", true));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    sel.innerHTML = `<option value="" disabled selected>Nenhum banco/cartão ativo encontrado. Cadastre um!</option>`;
    return;
  }
  
  sel.innerHTML = `<option value="" disabled selected>Selecione um Cartão/Banco...</option>`;
  
  snap.forEach(docSnap => {
    const b = docSnap.data();
    BANCOS_CACHE[docSnap.id] = { nomeBanco: b.nomeBanco, nomeCartao: b.nomeCartao };
    sel.innerHTML += `<option value="${docSnap.id}">${b.nomeBanco} - ${b.nomeCartao} (L. Total: ${formatBRL(b.limiteTotal)})</option>`;
  });
}

window.deletarDevedor = async function(id) {
  if (confirm("Você quer mesmo excluir este Devedor Permanentemente?")) {
    await deleteDoc(doc(db, `users/${currentUser.uid}/devedores`, id));
  }
}

window.alterarStatus = async function(id, msg) {
  // O prompt fala que teremos um botão "Ver Detalhes" para o andamento do emprestimo
  // A implementacao do andamento (parcelas, pagamentos do devedor) eh fase de controle! 
  // No prompt diz "Criar a base do módulo" apenas. "Ver detalhes" não foi exigido de fazer TELA nesse momento, 
  // mas o layout pede o botao.
  alert(msg);
}

function loadDevedores() {
  if (!currentUser) return;
  if (unsubscribeDevedores) unsubscribeDevedores();

  const q = query(collection(db, `users/${currentUser.uid}/devedores`), orderBy("dataCriacao", "desc"));
  
  unsubscribeDevedores = onSnapshot(q, (snapshot) => {
    let totEmprestado = 0;
    let totReceber = 0;
    
    const grid = $("devedoresGrid");
    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML = `<div class="empty-state">Nenhum devedor cadastrado.</div>`;
    } else {
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const id = docSnap.id;
        
        if (d.status === "ativo" || d.status === "atrasado") {
          totEmprestado += d.valorEmprestado;
          totReceber += d.valorTotal; // O que realmente vamos receber (com juros)
        }

        let bgClass = "ativo";
        let txtClass = "ATIVO";
        if (d.status === "quitado") { bgClass = "quitado"; txtClass = "QUITADO"; }
        if (d.status === "atrasado") { bgClass = "atrasado"; txtClass = "ATRASADO"; }
        
        let wppHtml = "";
        if (d.whatsapp) {
          const san = d.whatsapp.replace(/\D/g, "");
          wppHtml = `<a href="https://wa.me/55${san}" target="_blank" class="dev-whatsapp">📱 ${d.whatsapp}</a>`;
        }

        const card = document.createElement("div");
        card.className = "devedor-card";
        card.innerHTML = `
          <div class="dev-header">
            <div>
              <div class="dev-name">${d.nome}</div>
              ${wppHtml}
            </div>
            <span class="dev-badge ${bgClass}">${txtClass}</span>
          </div>

          <div style="font-size: .85rem; color: var(--gray-600); margin: .5rem 0;">
            <div class="val-row">
              <span class="val-lbl">Valor Emprestado</span>
              <span class="val-num" style="color:var(--gray-900)">${formatBRL(d.valorEmprestado)}</span>
            </div>
            <div class="val-row" style="border:none;">
              <span class="val-lbl" style="color:var(--blue-600); font-weight:600;">Total a Receber</span>
              <span class="val-num" style="color:var(--blue-600)">${formatBRL(d.valorTotal)}</span>
            </div>
            <div class="juros-row">${d.numeroParcelas} parcela(s) • ${d.jurosMensais}% juros a.m</div>
          </div>
          
          <div class="dev-bank-tag">💳 Vinculado: ${d.nomeBanco} ${d.nomeCartao}</div>
          
          ${d.observacao ? `<div style="font-size:.7rem; color:var(--gray-400); margin-top:.4rem;">${d.observacao}</div>` : ''}

          <!-- Progresso Fake (Fase Base) -->
          <div class="dev-progress-bg">
            <div class="dev-progress-fill" style="width: 10%;"></div>
          </div>
          
          <div class="b-actions" style="margin-top:0.75rem;">
            <button class="btn-action" style="color:var(--blue-600)" onclick="alterarStatus('${id}', 'Funcionalidade de Controle/Recebimento será adicionada na próxima fase!')">Exibir Detalhes</button>
            <button class="btn-action danger" onclick="deletarDevedor('${id}')">Excluir Base</button>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    $("resumoEmprestado").textContent = formatBRL(totEmprestado);
    $("resumoReceber").textContent = formatBRL(totReceber);
  });
}

$("formDevedor").addEventListener("submit", async(e) => {
  e.preventDefault();
  
  const bId = $("devBancoSelect").value;
  if (!bId) {
     alert("Selecione um banco ou cadastre um na aba apropriada!"); return;
  }

  $("btnSalvar").disabled = true;

  const nome = $("devNome").value.trim();
  let whats = $("devWhats").value.trim();
  const valE = Number($("devValorEmprestado").value);
  const juros = Number($("devJuros").value) || 0;
  const parc = Number($("devParcelas").value) || 1;
  const obs = $("devObs").value.trim();

  const totalCalculado = valE * (1 + (juros / 100) * parc);

  // Bank snapshot metadata
  const bMeta = BANCOS_CACHE[bId];

  try {
    await addDoc(collection(db, `users/${currentUser.uid}/devedores`), {
      nome,
      whatsapp: whats || null,
      valorEmprestado: valE,
      valorTotal: totalCalculado,
      numeroParcelas: parc,
      jurosMensais: juros,
      bancoId: bId,
      nomeBanco: bMeta.nomeBanco,
      nomeCartao: bMeta.nomeCartao,
      status: "ativo",
      observacao: obs,
      dataCriacao: serverTimestamp()
    });
    
    $("formDevedor").reset();
    $("prevCalculo").style.display = "none";
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
  populateBancosSelect();
  loadDevedores();
});
