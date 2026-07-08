// ============================================================
// ajuda.js — Motor de busca para FAQs e Guias da Central
// Finança Fácil | src/onboarding/ajuda.js
// ============================================================

import { auth } from "../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = id => document.getElementById(id);

const AJUDA_BD = [
  {
    sessao: "Como Começar",
    items: [
      {
        q: "Qual é a primeira coisa que devo fazer?",
        a: "Acesse o <strong>Dashboard</strong> e veja a checklist no topo. Você deve começar gravando pelo menos uma <em>Conta Fixa</em> ou <em>Renda</em> para começar a ver seus cálculos mensais rodarem."
      },
      {
        q: "Como o sistema preenche as cores automaticamente?",
        a: "O app é programado para cruzar seus dados de Renda VS Despesas dependentes. Tudo que é atrasado ficará vermelho automaticamente após sua intervenção ou tempo (em futuras versões de automação)."
      }
    ]
  },
  {
    sessao: "Finanças Pessoais",
    items: [
      {
        q: "Como cadastrar uma conta parcelada?",
        a: "Vá em Finanças Pessoais > Contas Pendentes e Cadastre uma nova conta. Em <strong>Quantidade de parcelas</strong>, insira o número (ex: 12). O sistema vai gravar 12 boletos virtuais para os próximos 12 meses na sua conta. Simples assim!"
      },
      {
        q: "Como informar parcelas já pagas caso a conta não seja de hoje?",
        a: "Durante o cadastro de uma conta parcelada, existe um campo chamado <strong>Parcelas que você já pagou?</strong>. Basta colocar a quantidade (ex: já paguei 6 antes de baixar o app). O sistema vai ignorar as velhas e registrar as novas como Pendente a partir do mês atual."
      },
      {
        q: "Como cadastrar contas fixas personalizadas?",
        a: "Vá em <em>Contas Fixas</em>, e nos slots virtuais logo abaixo das nativas (Energia/Agua...), clique em Criar Conta Customizada. Você pode inclusive usar um 🐱 Emoji nela."
      },
      {
        q: "Como criar metas?",
        a: "Vá na seção <em>Metas</em>, cadastre o ano e o valor alvo. O aplicativo calculará um valor sugerido para cada mês usando o que sobrou nos seus cálculos de Renda."
      }
    ]
  },
  {
    sessao: "Empréstimos",
    items: [
      {
        q: "Como cadastrar um banco/cartão com chave Pix?",
        a: "Navegue para Empréstimos > Bancos/Cartões. O sistema usará as informações que você colocar aqui para mascarar a chave Pix, atrelando esse banco diretamente a um devedor para cobranças diretas automáticas."
      },
      {
        q: "Como cobrar no WhatsApp?",
        a: "Vá em Devedores > Clique em Abrir Detalhes do devedor desejado. Em cada parcela atrasada ou pendente existe um botão <strong>📱 Cobrar no WhatsApp</strong>. Ao clicar, o seu Whatsapp abrirá instantaneamente com nome, dados PIX, valor calculado e restrições já preenchidos num bom dia profissional."
      },
      {
        q: "Como registrar atraso e juros?",
        a: "Na mesma barra de Detalhes da Parcela, clique em <em>⚠️ Registrar Atraso</em>. Uma modal irá perguntar os Dias Atrasados, Juros (%) e Juros Base (Simples/Composto). Ele lhe dará um preview de quanto a pessoa está devendo de juros de forma fácil antes de salvar e manchar o nome dele de Vermelho no seu painel principal!"
      }
    ]
  }
];

function triggerFAQToggle(e) {
  const card = e.currentTarget;
  card.classList.toggle("open");
}

function renderFAQ(filtro = "") {
  const root = $("hjPlaceholder");
  root.innerHTML = "";

  const termo = filtro.toLowerCase().trim();
  let hasResult = false;

  AJUDA_BD.forEach(bloco => {
    // Filtrar itens do bloco
    const filtados = bloco.items.filter(it => 
      it.q.toLowerCase().includes(termo) || it.a.toLowerCase().includes(termo)
    );

    if (filtados.length === 0) return;
    hasResult = true;

    // Build block
    const bDiv = document.createElement("div");
    bDiv.className = "hj-section";
    
    const hTitle = document.createElement("div");
    hTitle.className = "hj-section-title";
    hTitle.textContent = bloco.sessao;
    bDiv.appendChild(hTitle);

    const grid = document.createElement("div");
    grid.className = "hj-card-grid";

    filtados.forEach(f => {
      const card = document.createElement("div");
      card.className = "hj-card";
      card.innerHTML = `
        <div class="hj-card-title">${f.q}</div>
        <div class="hj-card-desc">Clique para ${termo ? 'expandir detalhes encontrados' : 'expandir resposta'}</div>
        <div class="hj-card-content">${f.a}</div>
      `;
      card.addEventListener("click", triggerFAQToggle);
      grid.appendChild(card);
    });

    bDiv.appendChild(grid);
    root.appendChild(bDiv);
  });

  if (!hasResult) {
    root.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--gray-400);">Nenhum resultado encontrado para esta busca... :(</div>`;
  }
}

$("hjBusca").addEventListener("input", (e) => {
  renderFAQ(e.target.value);
});


onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.replace("../../auth/login.html"); return; }
  renderFAQ("");
});
