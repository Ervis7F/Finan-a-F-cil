// ============================================================
// onboarding.js — Scripts p/ Checklist do Dashboard e Help
// Finança Fácil | src/onboarding/onboarding.js
// ============================================================

import { db } from "../firebase/firebase-config.js";
import { collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── DICIONÁRIO DE AJUDA CONTEXTUAL ─────────────────────
const HELP_DATA = {
  "dashboard": {
    titulo: "🏠 Bem-vindo ao Dashboard",
    descricao: "Aqui você tem o panorama geral da sua vida financeira.",
    topicos: [
      "Veja seu saldo previsto unindo Renda e Contas pendentes.",
      "Acompanhe atalhos rápidos para funções cruciais.",
      "Siga o Checklist de Primeiros Passos para entender onde preencher seus dados vitais."
    ],
    dica: "Sempre que for registrar um novo evento na sua vida real, não esqueça de refletir ele aqui nas abas à esquerda!"
  },
  "contas": {
    titulo: "💸 Contas e Pagamentos",
    descricao: "Módulo utilizado para registrar e pagar despesas mensais.",
    topicos: [
      "Você cadastra o que deve e pra qual mês/ano pertence.",
      "As contas parceladas são divididas automaticamente mês a mês.",
      "Após o pagamento, marque no sistema para que o dashboard desconte da sua renda base."
    ],
    dica: "As contas também refletem os juros se você utilizar as Contas Fixas!"
  },
  "renda": {
    titulo: "💰 Renda",
    descricao: "Registre tudo o que entra na sua conta para aquele mês.",
    topicos: [
      "Cada mês possui uma aba independente.",
      "Ideal para salários, freelancers, bônus e décimo terceiro.",
      "Não lance sua Renda de forma acumulada caso receba em diferentes contas, divida por descrições."
    ],
    dica: "Renda total menos Contas do mês = Saldo Previsto! Registre certinho para ter uma previsão real."
  },
  "contas-fixas": {
    titulo: "🔁 Contas Fixas",
    descricao: "Esqueça de ficar registrando internet ou aluguel todos os meses.",
    topicos: [
      "Ligue a chave da conta fixa e adicione o dia de vencimento.",
      "Ao salvar as contas fixas, você vai precisar ir na aba CONTAS PENDENTES e gerar aquele mês, nós puxaremos isso preenchido ali!"
    ],
    dica: "Use emojis legais na opção customizada pra reconhecer contas secundárias super fixas como Academia ou Streaming!"
  },
  "metas": {
    titulo: "🎯 Metas de Economia",
    descricao: "Planeje os seus respiros mensais e objetivos.",
    topicos: [
      "Configure um começo e o fim do processo.",
      "Nosso algoritmo sugere perfeitamente como estressar o orçamento calculando mês a mês a sugerida fatia dependendo de suas rendas VS gastos.",
      "Grave os valores parciais nas caixinhas até completá-las."
    ],
    dica: "Jamais altere seus orçamentos normais por capricho de meta. Meta de reserva de emergência é super válida como prioridade, antes de viajar, OK?"
  },
  "bancos": {
    titulo: "🏦 Bancos e Cartões",
    descricao: "Cadastre suas fontes de crédito num só lugar.",
    topicos: [
      "Registre todo e qualquer lugar que te dê crédito.",
      "Use as chaves Pix atreladas, elas importam caso algum devedor deposite.",
      "As referências ficam salvas em caches dinâmicos e não os delete se tiver pendências de uso!"
    ],
    dica: "Esses dados são apenas virtuais - O sistema jamais vai acessar sua agência."
  },
  "devedores": {
    titulo: "🤝 Devedores e Atrasos",
    descricao: "Controle preciso de quem deve a ti. Seja o agiota legal da família.",
    topicos: [
      "Atrele amigos a cartões para saber exatamente de onde saiu o valor emprestado.",
      "Utilize juros se preferir: nós faremos todas as matemáticas automáticas de multa.",
      "Veja o progresso do recebimento a cada clique que ele pagar."
    ],
    dica: "Quando o devedor atrasar, clique em atraso para injetar a porcentagem baseada nos dias ou use juros simples diretos no modal!"
  },
  "detalhes-devedor": {
    titulo: "📋 Perfil do Devedor",
    descricao: "Ações de curto alcance para esse contato.",
    topicos: [
      "Clique em Cobrar WhatsApp pra abrir seu whats com textos mastigados e chave PIX montada.",
      "O sistema trava o status para ATRASADO apenas se você formalizar o dia através do alerta de Registrar Atraso."
    ],
    dica: "O percentual verde serve para te alegrar quando se aproxima a data final!"
  },
  "relatorios": {
    titulo: "📊 Relatórios de Empréstimos",
    descricao: "Análise fria.",
    topicos: [
      "Veja o volume do que te devem e não foque no que já recebeu caso os atrasos cheguem.",
      "Os cartões mostrados aqui referem-se ao limite esgotado em decorrência deles."
    ],
    dica: "Não misture empréstimo feito a você mesmo com Devedores de fora!"
  }
};

// ── Injetar Botão de Ajuda Contextual ─────────────────────
// Isso cria a função global para injetar o Modal de ajuda com um template string.
export function injectContextHelp(pageId, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !HELP_DATA[pageId]) return;

  const data = HELP_DATA[pageId];

  // Create Button
  const btn = document.createElement("button");
  btn.className = "btn-floating-help";
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Ajuda sobre esta página`;
  container.prepend(btn);

  // Create Modal Structure outside of specific container (attach to body)
  if (!document.getElementById("obContextHelpModal")) {
    const d = document.createElement("div");
    d.id = "obContextHelpModal";
    d.className = "ob-modal-overlay";
    document.body.appendChild(d);
  }
  const modal = document.getElementById("obContextHelpModal");

  btn.addEventListener("click", () => {
    modal.innerHTML = `
      <div class="ob-modal-box">
        <button class="ob-modal-close" onclick="document.getElementById('obContextHelpModal').classList.remove('open')">✖</button>
        <div class="ob-modal-title">${data.titulo}</div>
        <div class="ob-modal-desc">${data.descricao}</div>
        <ul class="ob-modal-list">
          ${data.topicos.map(t => `<li>${t}</li>`).join("")}
        </ul>
        <div class="ob-modal-tip"><strong>💡 Dica:</strong> ${data.dica}</div>
      </div>
    `;
    modal.classList.add("open");
  });
}


// ── Checklist do Dashboard ────────────────────────────────
export async function renderDashboardChecklist(uid, containerElement) {
  // Config check (para fechar permanentemente, caso exista)
  const configRef = doc(db, `users/${uid}/config/onboarding`);
  const configSnap = await getDoc(configRef);
  if (configSnap.exists() && configSnap.data().checklistOculta) {
    containerElement.innerHTML = "";
    containerElement.style.display = "none";
    return;
  }

  // Verifica dados reias do Firestore para cada checklist
  const checks = {
    conta: false, renda: false, meta: false, banco: false, devedor: false
  };

  const tasks = [
    getDocs(collection(db, `users/${uid}/contas`)).then(s => checks.conta = !s.empty),
    getDocs(collection(db, `users/${uid}/rendas`)).then(s => checks.renda = !s.empty),
    getDocs(collection(db, `users/${uid}/metas`)).then(s => checks.meta = !s.empty),
    getDocs(collection(db, `users/${uid}/bancos`)).then(s => checks.banco = !s.empty),
    getDocs(collection(db, `users/${uid}/devedores`)).then(s => checks.devedor = !s.empty),
  ];
  await Promise.all(tasks);

  const doneCount = Object.values(checks).filter(v => v).length;
  const pct = Math.round((doneCount / 5) * 100);

  if (doneCount === 5) {
    containerElement.innerHTML = `
      <div class="ob-checklist-container ob-concluded-state">
        <h3>✅ Configuração Inicial Concluída!</h3>
        <p>Você explorou as principais áreas do sistema. Seus recursos estão rodando ativamente.</p>
        <div style="display:flex; justify-content:center; gap:.5rem;">
          <a href="../onboarding/ajuda.html" class="ob-action-link" style="padding:.5rem 1rem;">Visitar Central de Ajuda</a>
          <button id="obHideChecklist" class="ob-action-link" style="padding:.5rem 1rem; color:var(--gray-600); border-color:var(--gray-300); background:#fff;">Esconder este card pra sempre</button>
        </div>
      </div>
    `;
    document.getElementById("obHideChecklist").addEventListener("click", async () => {
      await setDoc(configRef, { checklistOculta: true }, { merge: true });
      containerElement.style.display = "none";
    });
    return;
  }

  const itemsUI = [
    { key: "conta", icon: "🧾", title: "Cadastrar a primeira Conta", link: "../financas/contas/contas.html", state: checks.conta },
    { key: "renda", icon: "💰", title: "Registrar uma Renda", link: "../financas/renda/renda.html", state: checks.renda },
    { key: "meta",  icon: "🎯", title: "Criar uma Meta de Economia", link: "../financas/metas/metas.html", state: checks.meta },
    { key: "banco", icon: "🏦", title: "Cadastrar um Banco/Cartão", link: "../emprestimos/bancos/bancos.html", state: checks.banco },
    { key: "devedor",icon:"🤝", title: "Registrar um Devedor Teste", link: "../emprestimos/devedores/devedores.html", state: checks.devedor }
  ].map(i => `
    <li class="ob-item ${i.state ? 'done' : ''}">
      <div class="ob-item-info">
        <div class="ob-icon-wrapper">${i.state ? '✔' : i.icon}</div>
        <div class="ob-item-title">${i.title}</div>
      </div>
      <a href="${i.link}" class="ob-action-link">Ir para lá →</a>
    </li>
  `).join("");

  containerElement.innerHTML = `
    <div class="ob-checklist-container">
      <div class="ob-checklist-header">
        <div class="ob-checklist-title">Primeiros Passos (Checklist) 🎉</div>
      </div>
      <p style="font-size:.85rem; color:var(--gray-600); margin-bottom:1rem;">Complete essas ações vitais para liberar a sua automação inteligente.</p>
      
      <div class="ob-progress-wrap">
        <div class="ob-progress-text">Progresso: ${pct}% - Faltam ${5 - doneCount} etapas</div>
        <div class="ob-progress-bg"><div class="ob-progress-fill" style="width:${pct}%"></div></div>
      </div>
      <ul class="ob-list">${itemsUI}</ul>
    </div>
  `;
}
