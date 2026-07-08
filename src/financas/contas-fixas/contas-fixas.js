// ============================================================
// contas-fixas.js — Lógica de cadastro das contas fixas
// Finança Fácil | src/financas/contas-fixas/contas-fixas.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  collection, query, getDocs, doc, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentUser = null;
const fixasGrid = $("fixasGrid");

// Tipos requeridos e seus ícones
const TIPOS_FIXAS = [
  { tipo: "Aluguel",     iconClass: "icon-aluguel", svg: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>` },
  { tipo: "Água",        iconClass: "icon-agua",    svg: `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>` },
  { tipo: "Luz",         iconClass: "icon-luz",     svg: `<line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>` },
  { tipo: "Internet",    iconClass: "icon-internet",svg: `<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>` },
  { tipo: "Plano de Saúde", iconClass: "icon-saude",svg: `<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>` },
  { tipo: "Telefone",    iconClass: "icon-telefone",svg: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>` }
];

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

async function carregarFixas() {
  const q = query(collection(db, `users/${currentUser.uid}/contasFixas`));
  const snapshot = await getDocs(q);

  // Mapeia do firestore
  const DB_FIXAS = {};
  snapshot.forEach(docSnap => {
    DB_FIXAS[docSnap.data().tipo] = {
      id: docSnap.id,
      valor: docSnap.data().valor,
      diaVencimento: docSnap.data().diaVencimento,
      ativo: docSnap.data().ativo
    };
  });

  fixasGrid.innerHTML = "";
  const template = $("tplFixa");
  let sumAtivas = 0;

  TIPOS_FIXAS.forEach(f => {
    const dataBD = DB_FIXAS[f.tipo] || { valor: "", diaVencimento: "", ativo: false };
    
    if (dataBD.ativo) {
      sumAtivas += Number(dataBD.valor || 0);
    }

    const node = template.content.cloneNode(true);
    const card = node.querySelector(".fixa-card");
    
    node.querySelector(".lbl-tipo").textContent = f.tipo;
    const icn = node.querySelector(".fixa-icon");
    icn.className = `fixa-icon ${f.iconClass}`;
    icn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2">${f.svg}</svg>`;
    
    const inpChk = node.querySelector(".chk-ativo");
    const inpVal = node.querySelector(".inp-valor");
    const inpDia = node.querySelector(".inp-dia");
    const btnSalvar = node.querySelector(".save-btn");

    inpChk.checked = dataBD.ativo;
    inpVal.value = dataBD.valor;
    inpDia.value = dataBD.diaVencimento;

    if (!dataBD.ativo) card.classList.add("inativo");

    inpChk.addEventListener("change", () => {
      if (inpChk.checked) card.classList.remove("inativo");
      else card.classList.add("inativo");
    });

    btnSalvar.addEventListener("click", async () => {
      const v = Number(inpVal.value) || 0;
      const d = Number(inpDia.value) || 1;
      const a = inpChk.checked;

      if (a && v <= 0) {
        alert("Informe o valor estimado da conta.");
        return;
      }

      btnSalvar.disabled = true;
      btnSalvar.textContent = "Salvando...";

      // Usa um slug do tipo como ID para evitar duplicatas, ou apenas um doc set com ID == slug
      const idStr = f.tipo.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");

      try {
        await setDoc(doc(db, `users/${currentUser.uid}/contasFixas`, idStr), {
          tipo: f.tipo,
          valor: v,
          diaVencimento: d,
          ativo: a,
          ultimaAtualizacao: serverTimestamp()
        }, { merge: true });

        // Feedback suave
        btnSalvar.textContent = "Salvo!";
        setTimeout(() => { btnSalvar.textContent = "Salvar"; btnSalvar.disabled = false; }, 1000);
        
        // Recalcular total sem precisar recarregar toda a page
        recalcularSum();

      } catch (err) {
        console.error("Erro", err);
        alert("Erro ao salvar.");
        btnSalvar.textContent = "Salvar";
        btnSalvar.disabled = false;
      }
    });

    fixasGrid.appendChild(node);
  });

  $("totalFixas").textContent = formatBRL(sumAtivas);
}

function recalcularSum() {
  let s = 0;
  const cards = document.querySelectorAll(".fixa-card");
  cards.forEach(c => {
    const isAtivo = c.querySelector(".chk-ativo").checked;
    const val = Number(c.querySelector(".inp-valor").value) || 0;
    if (isAtivo) s += val;
  });
  $("totalFixas").textContent = formatBRL(s);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../../auth/login.html");
    return;
  }
  currentUser = user;
  carregarFixas();
});
