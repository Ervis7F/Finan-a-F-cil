// ============================================================
// contas.js — Lógica de cadastro e listagem de contas
// Finança Fácil | src/financas/contas/contas.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let unsubscribeContas = null;

// Meses
const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function initFiltros() {
  const d = new Date();
  const options = meses.map((m, i) => `<option value="${i+1}">${m}</option>`).join("");
  
  $("filterMes").innerHTML = options;
  $("contaMes").innerHTML = options;

  $("filterMes").value = d.getMonth() + 1;
  $("contaMes").value = d.getMonth() + 1;

  $("filterAno").value = d.getFullYear();
  $("contaAno").value = d.getFullYear();

  $("filterMes").addEventListener("change", loadContas);
  $("filterAno").addEventListener("change", loadContas);
}

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function loadContas() {
  if (!currentUser) return;
  if (unsubscribeContas) unsubscribeContas();

  const mesInfo = Number($("filterMes").value);
  const anoInfo = Number($("filterAno").value);
  $("lblMesAtual").textContent = `(${meses[mesInfo-1]} ${anoInfo})`;

  const q = query(
    collection(db, `users/${currentUser.uid}/contas`),
    where("mes", "==", mesInfo),
    where("ano", "==", anoInfo),
    orderBy("dataCriacao", "desc")
  );

  unsubscribeContas = onSnapshot(q, (snapshot) => {
    let totalPendente = 0;
    const lista = $("listaContas");
    lista.innerHTML = "";

    if (snapshot.empty) {
      lista.innerHTML = `<div class="empty-state">Nenhuma conta cadastrada neste mês.</div>`;
    } else {
      snapshot.forEach(docSnap => {
        const conta = docSnap.data();
        const id = docSnap.id;
        
        if (conta.status === "pendente") totalPendente += conta.valor;

        const isPago = conta.status === "pago";
        const badgeClass = isPago ? "pago" : "pendente";
        const toggleText = isPago ? "Desmarcar Pago" : "Marcar como Pago";
        const toggleAction = isPago ? "pendente" : "pago";

        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML = `
          <div class="list-item-left">
            <span class="list-item-title">${conta.nome}</span>
            <div class="item-actions">
              <button class="btn-action toggle-status" data-id="${id}" data-status="${toggleAction}">${toggleText}</button>
              <button class="btn-action danger delete-conta" data-id="${id}">Excluir</button>
            </div>
          </div>
          <div class="list-item-right">
            <span class="list-item-value">${formatBRL(conta.valor)}</span>
            <span class="badge ${badgeClass}">${conta.status}</span>
          </div>
        `;
        lista.appendChild(item);
      });

      // Actions
      document.querySelectorAll(".toggle-status").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.getAttribute("data-id");
          const novoStatus = e.target.getAttribute("data-status");
          await updateDoc(doc(db, `users/${currentUser.uid}/contas`, id), { status: novoStatus });
        });
      });
      document.querySelectorAll(".delete-conta").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          if (confirm("Tem certeza que deseja excluir esta conta?")) {
            await deleteDoc(doc(db, `users/${currentUser.uid}/contas`, e.target.getAttribute("data-id")));
          }
        });
      });
    }
    
    $("totalPendente").textContent = formatBRL(totalPendente);
  });
}

$("formConta").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("btnSalvar").disabled = true;

  const nome = $("contaNome").value.trim();
  const valor = Number($("contaValor").value);
  const mes = Number($("contaMes").value);
  const ano = Number($("contaAno").value);

  try {
    await addDoc(collection(db, `users/${currentUser.uid}/contas`), {
      nome, valor, mes, ano, status: "pendente", dataCriacao: serverTimestamp()
    });
    
    $("contaNome").value = "";
    $("contaValor").value = "";
    
    // Switch filter to show created bill
    $("filterMes").value = mes;
    $("filterAno").value = ano;
    loadContas();
  } catch (error) {
    console.error("Erro ao salvar conta", error);
    alert("Erro ao salvar a conta.");
  }

  $("btnSalvar").disabled = false;
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../../auth/login.html");
    return;
  }
  currentUser = user;
  initFiltros();
  loadContas();
});
