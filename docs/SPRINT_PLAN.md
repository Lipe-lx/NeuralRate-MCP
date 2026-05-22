# NeuralRate MCP — Master Sprint Document
### Mantle Turing Test Hackathon 2026 · Phase 2: AI Awakening

> **Objetivo:** Construir um servidor MCP de inteligência de yield verificável para agentes autônomos na Mantle Network, com benchmarking on-chain e identidade ERC-8004.

---

## 📅 Datas Críticas

| Marco | Data | Status |
|-------|------|--------|
| Início Phase 2 | 1 de Maio, 2026 | ✅ Ativo |
| **Deadline de Submissão** | **15 de Junho, 2026** | ⏳ ~25 dias |
| Demo Day | 2-3 de Julho, 2026 | ⏳ Aguardando |

---

## 🏆 Critérios de Julgamento (Grand Champion)

| Dimensão | Peso | O que importa |
|----------|------|---------------|
| **Technical Depth** | 30% | Integração AI × on-chain, arquitetura, qualidade de código |
| **Innovation** | 25% | Originalidade; novo paradigma AI × Web3 |
| **Mantle Ecosystem** | 25% | Uso substantivo da rede Mantle, valor de longo prazo |
| **Product Completeness** | 20% | Demo funcional, UI/UX, escalabilidade |

---

## 📋 Requisitos de Submissão (DoraHacks)

- [ ] Repositório GitHub open-source com README completo
- [ ] Demo funcional (link público OU vídeo)
- [ ] Vídeo demo: **mínimo 2 minutos** (obrigatório para Deployment Award)
- [ ] Pitch de uma linha
- [ ] Endereço do contrato deployado (Mainnet ou Testnet)
- [ ] Contrato **verificado no Mantlescan**
- [ ] Pelo menos **uma função AI-powered callable on-chain**
- [ ] Frontend demo acessível publicamente (não localhost)
- [ ] Nomear para pelo menos um track

---

## 🔗 Referência Rápida — Rede & Contratos

### Mantle Sepolia Testnet
| Parâmetro | Valor |
|-----------|-------|
| Chain ID | `5003` |
| RPC URL | `https://rpc.sepolia.mantle.xyz` |
| Currency | MNT |
| Explorer | `https://explorer.sepolia.mantle.xyz` |
| Faucet | `https://faucet.sepolia.mantle.xyz/` |
| Bridge | `https://bridge.sepolia.mantle.xyz/` |

### Mantle Mainnet
| Parâmetro | Valor |
|-----------|-------|
| Chain ID | `5000` |
| RPC URL | `https://rpc.mantle.xyz` |
| Explorer | `https://mantlescan.xyz` |

### ERC-8004 Registry Addresses

| Registry | Sepolia (5003) | Mainnet (5000) |
|----------|----------------|----------------|
| **Identity** | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| **Reputation** | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| **Validation** | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` | ⚠️ Em revisão |

### ERC-8004 Identity Registry ABI (Mínimo)
```javascript
const IDENTITY_REGISTRY_ABI = [
    "function register(string calldata agentURI) external returns (uint256)",
    "function setAgentURI(uint256 agentId, string calldata newAgentURI) external",
    "function getAgentWallet(uint256 agentId) external view returns (address)",
    "event AgentRegistered(uint256 agentId, address owner)",
    "event URIUpdated(uint256 agentId, string newAgentURI)"
];
```

### Stack Técnica
| Componente | Tecnologia | Versão |
|------------|------------|--------|
| MCP SDK | `@modelcontextprotocol/sdk` | `1.29.0` |
| Cloudflare Agents | `agents` | `0.12.4+` |
| Cloudflare CLI | `wrangler` | v4 |
| Schema Validation | `zod` | latest |
| Smart Contracts | Hardhat + Solidity | `0.8.20` |
| Contract Verify | `@nomicfoundation/hardhat-verify` | latest |
| Frontend | Next.js ou Vite | latest |

---

## ⚠️ Insight Crítico do Q&A

> **ERC-8004 é emitido pela Mantle para participantes**, mas os contratos de registro estão abertos — qualquer um pode chamar `register()`. Para maximizar pontuação em "Mantle Ecosystem Contribution" (25%), faremos **AMBOS**: registrar nosso agente diretamente via contrato E referenciar o agentId em todas as decisões on-chain.

> **Mainnet vs Testnet:** A página oficial de "Requirements & Criteria" aceita ambos para o Deployment Award. Para tracks principais, Mainnet é preferido. **Estratégia:** Desenvolver em Sepolia Testnet, deploy final em Mainnet.

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT CONSUMERS                       │
│  Claude / GPT / Custom Agent / Telegram Bot / Dashboard  │
└──────────────────────┬──────────────────────────────────┘
                       │ Streamable HTTP (/mcp)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              NEURALRATE MCP SERVER                        │
│              Cloudflare Worker (McpAgent)                 │
│                                                         │
│  Tools: yield_scan · tbill_spread · nansen_context      │
│         risk_assess · optimal_allocation · settle        │
│                                                         │
│  Stack: @modelcontextprotocol/sdk 1.29.0                │
│         agents 0.12.4+ (Cloudflare)                     │
│         Streamable HTTP Transport                        │
│                                                         │
│  Storage: KV (cache) · D1 (decisions) · Durable Objects │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────────┐
          ▼            ▼                ▼
   ┌────────────┐ ┌──────────┐  ┌───────────────┐
   │ Data APIs  │ │ On-Chain  │  │ Smart Contract│
   │            │ │ Data      │  │               │
   │ DefiLlama │ │ Pyth      │  │ NeuralRate    │
   │ FRED API  │ │ Mantle RPC│  │ Benchmark.sol │
   │ Nansen    │ │           │  │ ERC-8004      │
   └────────────┘ └──────────┘  └───────────────┘
```

---

## 🔌 Referência de APIs & Data Sources

| API | Base URL | Auth | Cache TTL | Uso |
|-----|----------|------|-----------|-----|
| DefiLlama Yields | `https://yields.llama.fi/pools` | Nenhuma | 5 min | Pools Mantle APY/TVL |
| DefiLlama TVL | `https://api.llama.fi/protocol/{slug}` | Nenhuma | 15 min | TVL por protocolo |
| FRED Treasury | `https://api.stlouisfed.org/fred/series/observations` | API Key (grátis) | 1 hora | T-Bill DGS3MO/DGS1 |
| Nansen Smart Money | `https://api.nansen.ai/api/v1/smart-money/*` | Header `apikey` | 10 min | Netflows, labels |
| Pyth Hermes | `https://hermes.pyth.network/v2/updates/price/latest` | Nenhuma | 30 sec | Depeg detection |
| Mantle RPC | `https://rpc.sepolia.mantle.xyz` | Nenhuma | On-demand | Estado on-chain |

### Tokens RWA no Mantle Mainnet

| Token | Endereço | Tipo |
|-------|----------|------|
| mUSD | `0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3` | Rebasing wrapper USDY (Ondo) |
| USDY | `0x5bE26527e817998A7206475496fDE1E68957c5A6` | Tokenized T-Bill (Ondo) |
| USDe | `0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34` | Synthetic dollar (Ethena) |
| mETH | `0xcDA86A272531e8640cD7F1a92c01839911B90bb0` | Mantle Staked ETH |

### Protocolos DeFi no Mantle

| Protocolo | Tipo | Slug DefiLlama |
|-----------|------|----------------|
| Agni Finance | DEX (Uni V3 fork) | `agni-finance` |
| Merchant Moe | DEX (Trader Joe fork) | `merchant-moe` |
| Aave V3 Mantle | Lending | `aave-v3` |
| Lendle | Lending | `lendle` |

---

# 🚀 SPRINTS

---

## Sprint 1 — Scaffold & Ambiente (Dia 1)
> **Meta:** Estrutura do monorepo funcional, todas as dependências instaladas, configs prontas.

### Setup do Monorepo
- [x] Criar estrutura de diretórios:
  ```
  <repo-root>/
  ├── apps/
  │   ├── worker/          # Cloudflare Worker MCP Server
  │   │   ├── src/
  │   │   │   ├── index.ts
  │   │   │   ├── mcp/
  │   │   │   │   └── tools/
  │   │   │   ├── services/
  │   │   │   └── types/
  │   │   ├── wrangler.toml
  │   │   ├── package.json
  │   │   └── tsconfig.json
  │   └── web/             # Dashboard UI (Vite + React)
  │       ├── src/
  │       ├── package.json
  │       └── vite.config.ts
  ├── contracts/           # Hardhat Smart Contracts
  │   ├── contracts/
  │   │   └── NeuralRateDecisionBenchmark.sol
  │   ├── scripts/
  │   │   ├── deploy.ts
  │   │   └── register-agent.ts
  │   ├── test/
  │   ├── hardhat.config.ts
  │   └── package.json
  ├── packages/
  │   └── shared/          # Tipos compartilhados
  ├── .env.example
  ├── .gitignore
  ├── package.json         # Root workspace
  └── README.md
  ```

### Configurações
- [x] Inicializar root `package.json` com workspaces (npm/pnpm)
- [x] Configurar `apps/worker/` com template Cloudflare MCP authless
- [x] Configurar `contracts/` com Hardhat + hardhat-toolbox + hardhat-verify
- [x] Configurar `hardhat.config.ts` com rede `mantleSepolia` (chain 5003)
- [x] Criar `.env.example` com todas as variáveis necessárias
- [x] Criar `.gitignore` robusto (node_modules, .env, artifacts, cache)
- [x] Configurar `wrangler.toml` com KV namespace para cache

### Validação Sprint 1
- [ ] `npm install` roda sem erros em todos os workspaces
- [ ] `npx wrangler dev` inicia o worker localmente
- [ ] `npx hardhat compile` compila com sucesso (mesmo que contrato esteja vazio)

---

## Sprint 2 — Smart Contracts & ERC-8004 (Dias 2-3)
> **Meta:** Contrato de benchmark deployado e verificado, agente registrado no ERC-8004.

### NeuralRateDecisionBenchmark.sol
- [x] Escrever o contrato completo com:
  - `struct DecisionMeta` (agent, requestedBy, dataSnapshotHash, predictedApyBps, etc.)
  - `createDecision()` → emite `DecisionCreated` event
  - `settleDecision()` → emite `DecisionSettled` event
  - Modifier `onlyAgent` para restringir ao endereço do agente
  - Getter functions para consultas públicas
- [x] Escrever testes unitários Hardhat:
  - Test: criar decisão com dados válidos
  - Test: settle decisão com cálculo de erro
  - Test: rejeitar settle de decisão já settled
  - Test: rejeitar chamadas de não-agente
- [x] Rodar `npx hardhat test` — todos passando

### Deploy & Verificação
- [ ] Obter MNT testnet via faucet (`https://faucet.sepolia.mantle.xyz/`)
- [ ] Escrever script `deploy.ts` (deploya contrato + log do endereço)
- [ ] Deploy para Mantle Sepolia: `npx hardhat run scripts/deploy.ts --network mantleSepolia`
- [ ] Verificar contrato: `npx hardhat verify --network mantleSepolia <ADDRESS> <CONSTRUCTOR_ARGS>`
- [ ] Confirmar no explorer: `https://explorer.sepolia.mantle.xyz/address/<ADDRESS>`

### ERC-8004 Agent Identity
- [x] Criar `agent-card.json` seguindo o schema oficial
- [x] Gerar avatar do agente (usar generate_image tool)
- [ ] Upload agent-card.json + avatar para IPFS (Pinata free tier)
- [x] Escrever script `register-agent.ts` que chama `register(agentURI)` no Identity Registry
- [x] Executar registro no Mantle Sepolia
- [x] Salvar o `agentId` retornado no `.env`
- [ ] Atualizar `registrations.agentId` no agent-card.json e fazer `setAgentURI()`

### Validação Sprint 2
- [x] Contrato deployado e verificado no Mantle Sepolia Explorer
- [x] `createDecision()` e `settleDecision()` funcionam via script
- [x] Agente registrado no ERC-8004 — NFT visível no explorer
- [ ] Agent card acessível via IPFS gateway

---

## Sprint 3 — MCP Server Core (Dias 3-6)
> **Meta:** Servidor MCP funcional com todas as 6+ tools respondendo dados reais.

### Estrutura do Worker
- [ ] Setup `McpAgent` ou `createMcpHandler()` no `index.ts`
- [ ] Configurar Streamable HTTP transport (endpoint `/mcp`)
- [ ] Configurar KV namespace para cache (TTLs por tipo de dado)
- [ ] Configurar bindings de environment (API keys, contract addresses)

### MCP Tools Implementation

#### Tool 1: `yield_scan`
- [ ] Integrar DefiLlama API (`https://yields.llama.fi/pools`)
  - Filtrar por chain "Mantle"
  - Retornar pools com APY, TVL, protocolo
- [ ] Cache com TTL de 5 minutos no KV
- [ ] Fallback para snapshot estático se API indisponível
- [ ] Definir schema Zod de input/output

#### Tool 2: `tbill_spread`
- [ ] Integrar FRED API (`https://api.stlouisfed.org/fred/series/observations`)
  - Series: DGS3MO (3-month), DGS1 (1-year)
- [ ] Calcular spread em bps (yield on-chain - Treasury rate)
- [ ] Cache com TTL de 1 hora
- [ ] Fallback para último valor cached

#### Tool 3: `nansen_context`
- [ ] Implementar adapter Nansen com endpoints:
  - Smart money flows
  - Wallet labels
  - Holder concentration
- [ ] Implementar modo **demo/cached** com snapshots realistas
- [ ] Flag `nansen_available` no output
- [ ] Fallback gracioso para dados on-chain puros

#### Tool 4: `risk_assess`
- [ ] Implementar scoring determinístico com pesos:
  - Depeg history (20%)
  - Liquidity depth (20%)
  - TVL concentration (15%)
  - Protocol/smart contract risk (15%)
  - Issuer mechanism risk (15%)
  - Nansen context (15%)
- [ ] Score 0-100, classificação LOW/MEDIUM/HIGH/CRITICAL
- [ ] Cada fator retorna score individual + detalhe textual

#### Tool 5: `optimal_allocation`
- [ ] Combinar yield_scan + tbill_spread + risk_assess + nansen_context
- [ ] Aceitar `amount_usd`, `risk_profile`, `assets[]`, `settlement_horizon_hours`
- [ ] Gerar alocação percentual por asset/protocol
- [ ] Se `log_onchain: true`, chamar `createDecision()` no contrato
- [ ] Retornar `decision_id` e `data_snapshot_hash`

#### Tool 6: `log_decision`
- [ ] Persistir decisão, risk profile, allocation JSON e hashes no D1
- [ ] Associar tx hash on-chain quando `createDecision()` for usado
- [ ] Retornar confirmação com `decision_id`, `created_at` e status

#### Tool 7: `get_decisions`
- [ ] Buscar histórico recente com paginação simples por `limit`
- [ ] Retornar estado de settlement, métricas previstas e tx hashes
- [ ] Ordenar do mais recente para o mais antigo

### Validação Sprint 3
- [ ] Cada tool responde com dados válidos em `npx wrangler dev`
- [ ] Fallbacks funcionam quando APIs estão indisponíveis
- [ ] Cache KV funciona corretamente com TTLs
- [ ] Tool `optimal_allocation` com `log_onchain: true` cria decisão no contrato testnet

---

## Sprint 4 — Data Sources & Integrations (Dias 5-7)
> **Meta:** Todas as fontes de dados reais conectadas, snapshots de fallback populados.

### DefiLlama Integration
- [ ] Endpoint yields: `GET https://yields.llama.fi/pools`
  - Filtrar: `chain === "Mantle"` e `tvlUsd > min_tvl`
  - Sem autenticação necessária
- [ ] Endpoint TVL: `GET https://api.llama.fi/v2/chains`
- [ ] Endpoint protocol: `GET https://api.llama.fi/protocol/{protocol-slug}`
- [ ] Mapear protocols Mantle: Agni Finance, Merchant Moe, Lendle, INIT Capital

### FRED API Integration
- [ ] Registrar API key gratuita em `https://fred.stlouisfed.org/docs/api/api_key.html`
- [ ] Endpoint: `GET https://api.stlouisfed.org/fred/series/observations`
  - Params: `series_id=DGS3MO`, `api_key=<KEY>`, `file_type=json`, `sort_order=desc`, `limit=1`
- [ ] Implementar cache de 1h (Treasury rates mudam devagar)

### Nansen Integration (ou Mock)
- [ ] Se API key disponível: integrar endpoints reais
- [ ] Se não: criar dataset de mock rico e realista
  - Smart money netflows por asset (últimas 24h, 7d)
  - Wallet labels (market_maker, fund, whale, retail)
  - Holder concentration metrics
  - Anomaly scores
- [ ] Armazenar snapshots no KV ou como constants no código

### On-Chain Data (Mantle RPC)
- [ ] Integrar leitura de preços via Pyth/Chainlink para depeg detection
- [ ] Consultar TVL de protocolos diretamente via subgraphs se necessário
- [ ] Buscar endereços de contratos dos tokens RWA no Mantle:
  - mETH, USDY, USDe, mUSD/FBTC

### IPFS Setup
- [ ] Criar conta Pinata (free tier: 1GB, 200 uploads)
- [ ] Upload do agent-card.json
- [ ] Upload do avatar do agente
- [ ] Salvar CIDs no `.env`

### Validação Sprint 4
- [ ] DefiLlama retorna pools Mantle com APY/TVL corretos
- [ ] FRED API retorna taxa DGS3MO atualizada
- [ ] Mock Nansen retorna dados estruturados realistas
- [ ] Depeg detection funciona com price feeds
- [ ] Agent card e avatar acessíveis via IPFS gateway público

---

## Sprint 5 — Dashboard UI Premium (Dias 7-10)
> **Meta:** Interface de terminal de benchmark do agente — dark theme, interativa, premium.

### Setup do Projeto Web
- [ ] Inicializar com Vite + React + TypeScript
- [ ] Design system: dark mode, glassmorphism, gradients vibrantes
- [ ] Tipografia: Google Fonts (Inter ou Outfit)
- [ ] Paleta de cores: dark base (#0a0b0d), accent cyan/green (#00f0ff, #00e676)

### Componentes da Dashboard

#### Header & Navigation
- [ ] Logo NeuralRate MCP + status de conexão ao MCP server
- [ ] Badge do ERC-8004 Agent ID (link para explorer)
- [ ] Indicador de modo: Core / Enhanced (Nansen) / Demo

#### Painel 1: Yield Scanner
- [ ] Tabela interativa com pools Mantle (APY, TVL, Protocol, Asset)
- [ ] Sparklines de tendência de APY
- [ ] Sorting e filtering por asset/protocol
- [ ] Indicadores visuais de confidence (HIGH/MEDIUM/LOW)

#### Painel 2: Treasury Spread
- [ ] Gauge visual: On-chain yield vs T-Bill rate
- [ ] Spread em bps com indicador de direção (premium/discount)
- [ ] Histórico de spread (gráfico de linha)

#### Painel 3: Risk Assessment
- [ ] Radar chart com os 6 fatores de risco
- [ ] Score total com badge colorido (LOW=verde, HIGH=vermelho)
- [ ] Drill-down em cada fator

#### Painel 4: Agent Decision Ledger
- [ ] Timeline de decisões on-chain (DecisionCreated → DecisionSettled)
- [ ] Cards com: predicted vs realized APY, error bps, outperformance
- [ ] Links para transações no explorer
- [ ] Score de performance acumulado do agente

#### Painel 5: Live MCP Terminal
- [ ] Terminal interativo simulando chamadas MCP
- [ ] Input de tools com autocomplete
- [ ] Output formatado em JSON com syntax highlighting
- [ ] Animações de streaming (simula SSE responses)

#### Painel 6: Nansen Intelligence (se disponível)
- [ ] Smart money flow indicators
- [ ] Wallet label distribution chart
- [ ] Anomaly score gauge

### Responsividade & Polish
- [ ] Responsive para desktop e tablet
- [ ] Micro-animações em hover, transitions suaves
- [ ] Loading states elegantes (skeleton screens)
- [ ] Toast notifications para eventos on-chain

### Validação Sprint 5
- [ ] Dashboard carrega com dados reais do MCP server
- [ ] Todas as visualizações funcionam e são interativas
- [ ] Design é premium e impressiona à primeira vista
- [ ] Funciona em browsers modernos (Chrome, Firefox, Safari)

---

## Sprint 6 — Polish, Deploy & Submissão (Dias 10-14)
> **Meta:** Tudo deployado, verificado, documentado e submetido no DoraHacks.

### Deploy Final

#### Contratos
- [ ] Re-deploy `NeuralRateDecisionBenchmark.sol` na **Mantle Mainnet** (se possível) ou confirmar deploy Sepolia
- [ ] Verificar contrato no Mantlescan
- [ ] Registrar agente no ERC-8004 (Mainnet ou Sepolia conforme target)

#### MCP Server
- [ ] Deploy do Cloudflare Worker para produção: `npx wrangler deploy`
- [ ] Configurar secrets de produção: `npx wrangler secret put <KEY>`
- [ ] Testar endpoint público: `https://neuralrate-worker.neuralrate.workers.dev/mcp`
- [ ] Atualizar `agent-card.json` com endpoint de produção

#### Dashboard
- [ ] Build de produção: `npm run build`
- [ ] Deploy para Cloudflare Pages ou Vercel
- [ ] Domínio público acessível

### Documentação

#### README.md
- [ ] Descrição do projeto (o que é, por que existe)
- [ ] Arquitetura (diagrama ASCII/mermaid)
- [ ] Instruções de setup local
- [ ] Endereços de contratos deployados
- [ ] Agent ID no ERC-8004
- [ ] Links para demo e vídeo
- [ ] Screenshots da dashboard
- [ ] Tecnologias utilizadas
- [ ] Integrações (DefiLlama, FRED, Nansen, Mantle RPC)

#### Vídeo Demo (mín 2 min)
- [ ] Pitch (15-20s): O que é NeuralRate MCP
- [ ] Problema: Por que agentes precisam de yield intelligence verificável
- [ ] Solução: Demo ao vivo mostrando:
  - Chamada de `yield_scan` via MCP
  - `optimal_allocation` criando decisão on-chain
  - Dashboard mostrando a decisão no ledger
  - settlement on-chain via `settleDecision()` com resultado verificável
- [ ] Integração ERC-8004: mostrar agent identity no explorer
- [ ] Diferencial: deterministic scoring + benchmarking on-chain
- [ ] Gravar em 1080p, hospedar no YouTube/Google Drive

### Submissão DoraHacks
- [ ] Criar BUIDL no DoraHacks
- [ ] Pitch de uma linha: *"NeuralRate MCP: A verifiable RWA yield intelligence layer for autonomous agents on Mantle — every recommendation becomes a benchmarkable, on-chain prediction."*
- [ ] Preencher campos: GitHub link, demo link, vídeo link, contrato deployado
- [ ] Nomear tracks: **AI × RWA** (principal) + **Agentic Wallets** (secundário)
- [ ] Submeter antes de **15 de Junho, 2026**

### Testes E2E Finais
- [ ] MCP server responde a todas as 6 tools
- [ ] Contrato cria e settle decisões corretamente
- [ ] Dashboard mostra dados em tempo real
- [ ] Fallback Nansen funciona perfeitamente
- [ ] Agent card válido no IPFS
- [ ] GitHub público e acessível
- [ ] Vídeo uploaded e compartilhável

### Preparação Demo Day (2-3 Julho)
- [ ] Preparar apresentação de 5 min
- [ ] Testar demo ao vivo (backup com vídeo pré-gravado)
- [ ] Garantir que todos os serviços estão estáveis

---

## 📊 Resumo de Progresso

| Sprint | Descrição | Status | Prazo Alvo |
|--------|-----------|--------|------------|
| Sprint 1 | Scaffold & Ambiente | `[ ]` Não iniciado | Dia 1 (22 Mai) |
| Sprint 2 | Smart Contracts & ERC-8004 | `[ ]` Não iniciado | Dias 2-3 (23-24 Mai) |
| Sprint 3 | MCP Server Core | `[ ]` Não iniciado | Dias 3-6 (24-27 Mai) |
| Sprint 4 | Data Sources & Integrations | `[ ]` Não iniciado | Dias 5-7 (26-28 Mai) |
| Sprint 5 | Dashboard UI Premium | `[ ]` Não iniciado | Dias 7-10 (28-31 Mai) |
| Sprint 6 | Polish, Deploy & Submissão | `[ ]` Não iniciado | Dias 10-14 (31 Mai - 4 Jun) |

> **Buffer de segurança:** ~11 dias entre conclusão planejada (4 Jun) e deadline (15 Jun).

---

## 🔑 Decisões Pendentes do Usuário

> [!IMPORTANT]
> 1. **Carteira de Deployer:** Você já possui uma carteira com MNT para Mantle Sepolia/Mainnet? Preciso do endereço público para enviar testnet MNT via faucet.
> 2. **Nansen API Key:** Possui acesso? Se não, usaremos o modo demo com snapshots cached (100% funcional para o hackathon).
> 3. **FRED API Key:** Gratuita, posso gerar se você não tiver. Precisa de registro em `https://fred.stlouisfed.org/docs/api/api_key.html`.
> 4. **Cloudflare Account:** Necessário para deploy do Worker. Free tier é suficiente.
> 5. **Pinata Account:** Para IPFS do agent-card.json. Free tier (1GB) é suficiente.
> 6. **Target de Deploy:** Mantle Mainnet (ideal para competição) ou Sepolia Testnet (mais seguro)?
