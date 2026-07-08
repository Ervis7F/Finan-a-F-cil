# 💰 Finança Fácil

> **App web de controle financeiro pessoal com módulos de Finanças Pessoais e Empréstimos a Terceiros**

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)
![Firebase](https://img.shields.io/badge/backend-Firebase-orange)
![JavaScript](https://img.shields.io/badge/linguagem-JavaScript-yellow)

---

## 📋 Sobre o Projeto

O **Finança Fácil** é um aplicativo web de controle financeiro pessoal que permite ao usuário organizar suas finanças de forma simples e eficiente. O sistema é composto por dois módulos principais:

1. **Finanças Pessoais** – controle de receitas, despesas, contas fixas e metas de economia.
2. **Empréstimos** – gerenciamento de empréstimos concedidos a terceiros, com controle de parcelas, juros e cobranças via WhatsApp.

O app utiliza **login multiusuário** com autenticação segura via Firebase Authentication. Os dados de cada usuário são totalmente **isolados e protegidos** por meio de Firebase Authentication + Firestore Security Rules, garantindo que nenhum usuário acesse informações de outro.

---

## 📦 Módulo 1 — Finanças Pessoais

Este módulo oferece uma visão completa das finanças pessoais do usuário:

- **Dashboard de boas-vindas** com resumo financeiro do mês atual.
- **Cadastro de contas por mês/ano**: lançamento de despesas categorizadas por período.
- **Controle de renda**: registro das fontes de renda mensais.
- **Adiantamento de pagamentos**: possibilidade de antecipar parcelas ou compromissos futuros.
- **Contas fixas em destaque**: campos dedicados para despesas recorrentes como:
  - 🏠 Aluguel
  - 💧 Água
  - 💡 Luz
  - 🌐 Internet
  - 🏥 Plano de Saúde
  - 📱 Telefone
- **Metas de economia**: definição de objetivos financeiros com sugestão automática de valor mensal para atingir a meta no prazo.
- **Relatórios de gastos por mês**: visualização detalhada das despesas com filtros por período e categoria.

---

## 💳 Módulo 2 — Empréstimos

Este módulo é voltado para quem empresta dinheiro a terceiros e precisa controlar os recebimentos:

- **Cadastro de bancos/cartões**: registro de fontes de crédito com limite disponível e chave Pix associada.
- **Cadastro de devedores**: registro de pessoas com informações de:
  - Valor emprestado
  - Número de parcelas
  - Taxa de juros
  - Número de WhatsApp (opcional)
- **Controle de parcelas**: acompanhamento de parcelas pagas e pendentes de cada devedor.
- **Calculadora de juros por atraso**: cálculo automático de juros sobre parcelas em atraso.
- **Cobrança via WhatsApp**: geração de link de cobrança (`wa.me`) com mensagem pré-formatada contendo:
  - Chave Pix para pagamento
  - Valor da parcela
  - Número de parcelas restantes
  - Mensagem amigável de cobrança

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Uso |
|---|---|
| **Firebase Authentication** | Login e gerenciamento de usuários |
| **Cloud Firestore** | Banco de dados NoSQL em tempo real |
| **Firebase Hosting** | Hospedagem do app web |
| **JavaScript (ES6+)** | Lógica da aplicação |
| **HTML5** | Estrutura das páginas |
| **CSS3** | Estilização e responsividade |

---

## 🤖 Metodologia de Desenvolvimento

Este projeto está sendo construído com apoio de **Inteligência Artificial** via **Antigravity (Gemini)**, assistente de codificação da Google DeepMind.

A metodologia adotada é a de **desenvolvimento orientado a prompts modulares**:

1. Cada funcionalidade ou módulo é descrito em um prompt detalhado.
2. O código gerado é revisado, ajustado e testado localmente.
3. Ao final de cada etapa, as alterações são **comitadas com mensagem semântica** e **enviadas ao GitHub**.

Isso garante um histórico de commits limpo, organizado e rastreável, refletindo cada etapa do desenvolvimento.

---

## 📁 Estrutura de Pastas

```
financas-facil/
├── public/                      # Arquivos públicos (favicon, manifest, etc.)
├── src/
│   ├── assets/                  # Imagens, ícones, fontes
│   ├── auth/                    # Telas e lógica de autenticação (login, cadastro)
│   ├── dashboard/               # Dashboard principal do usuário
│   ├── financas/                # Módulo de Finanças Pessoais
│   │   ├── contas/              # Cadastro e listagem de contas por mês/ano
│   │   ├── renda/               # Controle de renda mensal
│   │   ├── metas/               # Metas de economia
│   │   └── contas-fixas/        # Contas fixas (aluguel, água, luz, etc.)
│   ├── emprestimos/             # Módulo de Empréstimos
│   │   ├── bancos/              # Cadastro de bancos/cartões com Pix
│   │   ├── devedores/           # Cadastro e controle de devedores
│   │   ├── atrasos/             # Calculadora de juros por atraso
│   │   └── relatorios/          # Relatórios de empréstimos
│   ├── shared/                  # Componentes e utilitários compartilhados
│   ├── firebase/                # Configuração e inicialização do Firebase
│   └── onboarding/              # Fluxo de onboarding do novo usuário
├── docs/                        # Documentação técnica e de produto
├── firestore.rules              # Regras de segurança do Firestore
├── firebase.json                # Configuração de deploy do Firebase Hosting
├── .gitignore                   # Arquivos ignorados pelo Git
└── README.md                    # Este arquivo
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) v18+
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- Conta no [Firebase Console](https://console.firebase.google.com/)

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/Ervis7F/Finan-a-F-cil.git
cd Finan-a-F-cil

# 2. Faça login no Firebase
firebase login

# 3. Inicie o emulador local (opcional, para testes)
firebase emulators:start

# 4. Ou sirva os arquivos localmente
firebase serve
```

> **Atenção:** Configure o arquivo `src/firebase/firebase-config.js` com as credenciais do seu projeto Firebase antes de executar.

---

## 📊 Status do Projeto

🟡 **Em desenvolvimento ativo**

| Módulo | Status |
|---|---|
| Estrutura de pastas e documentação | ✅ Concluído |
| Configuração do Firebase | 🔄 Em andamento |
| Autenticação (login/cadastro) | ⏳ Pendente |
| Dashboard principal | ⏳ Pendente |
| Módulo Finanças Pessoais | ⏳ Pendente |
| Módulo Empréstimos | ⏳ Pendente |
| Deploy no Firebase Hosting | ⏳ Pendente |

---

## 📄 Licença

Este projeto é de uso pessoal. Todos os direitos reservados ao autor.

---

*Desenvolvido com ❤️ e apoio de IA via Antigravity (Gemini)*
