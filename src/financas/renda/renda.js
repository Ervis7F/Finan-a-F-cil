// ============================================================
// renda.js — Lógica de cadastro e resumo de rendas e contas
// Finança Fácil | src/financas/renda/renda.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let unsubscribeRendas = null;
let unsubscribeContas = null;

const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function initFiltros() {
  const d = new Date();
  const options = meses.map((m, i) => `<option value="${i+1}">${m}</option>`).join("");
  
  $("filterMes").innerHTML = options;
  $("rendaMes").innerHTML = options;

  $("filterMes").value = d.getMonth() + 1;
  $("rendaMes").value = d.getMonth() + 1;

  $("filterAno").value = d.getFullYear();
  $("rendaAno").value = d.getFullYear();

  $("filterMes").addEventListener("change", loadDados);
  $("filterAno").addEventListener("change", loadDados);
}

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function loadDados() {
  if (!currentUser) return;
  if (unsubscribeRendas) unsubscribeRendas();
  if (unsubscribeContas) unsubscribeContas();

  const mesInfo = Number($("filterMes").value);
  const anoInfo = Number($("filterAno").value);
  $("lblMesAtual").textContent = `(${meses[mesInfo-1]} ${anoInfo})`;

  let totalRenda = 0;
  let totalPendente = 0;

  function updateOverview() {
    $("totalRenda").textContent = formatBRL(totalRenda);
    $("totalPendente").textContent = formatBRL(totalPendente);
    
    const saldo = totalRenda - totalPendente;
    const sSaldo = $("saldoMes");
    sSaldo.textContent = formatBRL(saldo);
    if (saldo >= 0) {
      sSaldo.className = "summary-value positive";
    } else {
      sSaldo.className = "summary-value negative";
    }
  }

  // Listener para Rendas
  const qRendas = query(
    collection(db, `users/${currentUser.uid}/rendas`),
    where("mes", "==", mesInfo),
    where("ano", "==", anoInfo),
    orderBy("dataCriacao", "desc")
  );

  unsubscribeRendas = onSnapshot(qRendas, (snapshot) => {
    totalRenda = 0;
    const lista = $("listaRendas");
    lista.innerHTML = "";

    if (snapshot.empty) {
      lista.innerHTML = `<div class="empty-state">Nenhuma renda cadastrada neste mês.</div>`;
    } else {
      snapshot.forEach(docSnap => {
        const r = docSnap.data();
        totalRenda += r.valor;

        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML = `
          <div class="list-item-left">
            <span class="list-item-title">${r.descricao || "Renda Adicional"}</span>
            <div class="item-actions">
              <button class="btn-action danger delete-renda" data-id="${docSnap.id}">Excluir</button>
            </div>
          </div>
          <div class="list-item-right">
            <span class="list-item-value">${formatBRL(r.valor)}</span>
          </div>
        `;
        lista.appendChild(item);
      });

      document.querySelectorAll(".delete-renda").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          if (confirm("Tem certeza que deseja excluir esta renda?")) {
            await deleteDoc(doc(db, `users/${currentUser.uid}/rendas`, e.target.getAttribute("data-id")));
          }
        });
      });
    }
    updateOverview();
  });

  // Listener para Contas Pendentes
  const qContas = query(
    collection(db, `users/${currentUser.uid}/contas`),
    where("mes", "==", mesInfo),
    where("ano", "==", anoInfo),
    where("status", "==", "pendente")
  );

  unsubscribeContas = onSnapshot(qContas, (snapshot) => {
    totalPendente = 0;
    snapshot.forEach(docSnap => {
      totalPendente += docSnap.data().valor;
    });
    updateOverview();
  });
}

$("formRenda").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("btnSalvar").disabled = true;

  const valor = Number($("rendaValor").value);
  const descricao = $("rendaDescricao").value.trim();
  const mes = Number($("rendaMes").value);
  const ano = Number($("rendaAno").value);

  try {
    await addDoc(collection(db, `users/${currentUser.uid}/rendas`), {
      valor, descricao, mes, ano, dataCriacao: serverTimestamp()
    });
    
    $("rendaValor").value = "";
    $("rendaDescricao").value = "";
    
    // Altera o filtro para o mes da nova renda
    $("filterMes").value = mes;
    $("filterAno").value = ano;
    loadDados();
  } catch (error) {
    console.error("Erro ao salvar renda", error);
    alert("Erro ao salvar a renda.");
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
  loadDados();
});
