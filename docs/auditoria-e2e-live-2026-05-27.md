# Relatorio de Auditoria E2E - NeuralRate

Data da auditoria: 2026-05-27
Ambiente: https://neuralrate.pages.dev/

## Escopo

Teste de smoke como usuario real, usando apenas a interface publica.

Regras seguidas:

- nenhuma rota interna foi usada para facilitar o teste
- nenhuma chamada direta a endpoints internos foi feita para substituir a navegacao do usuario
- as interacoes ocorreram via navegador headless em cima do site ativo

## Metodologia

Fluxos executados no navegador:

1. Carregamento da landing page publica
2. Abertura do modal `AGENT ACCESS`
3. Troca de pool no `Yield Scanner`
4. Acionamento do `Nansen Radar`
5. Troca para a aba `Agent Vault`

Evidencias geradas localmente:

- `/tmp/neuralrate-landing.png`
- `/tmp/neuralrate-agent-modal.png`
- `/tmp/neuralrate-pool-selected.png`
- `/tmp/neuralrate-nansen.png`
- `/tmp/neuralrate-vault-tab.png`

## Resultados

### 1. Landing page

[OK] A pagina carregou e renderizou o terminal publico.

[OK] Os blocos principais ficaram visiveis:

- `Risk Assessment`
- `Nansen Radar`
- `Yield Scanner`
- `Connect Wallet`
- `AGENT ACCESS`

### 2. Modal de agente

[OK] O botao `AGENT ACCESS` abriu o modal de conexao do MCP.

[OK] O modal exibiu o endpoint publico do agente e a configuracao manual em JSON.

[OK] Nenhum erro de pagina foi registrado durante a abertura/fechamento do modal.

### 3. Selecao de pool e risco

[OK] A selecao de pool no `Yield Scanner` funcionou como fluxo real de usuario.

[OK] O score de risco mudou de `86.6` para `73.1` apos a troca de pool.

Interpretacao:

- isso confirma que a UI nao esta apenas estatica
- a troca de ativo dispara recomputacao real do painel de risco

### 4. Nansen Radar

[OK] O toggle do Nansen foi acionado pela UI.

[OK] O painel respondeu com estado final deterministico para o pool selecionado:

- `No Smart Money netflow snapshot was returned for USDC. Cached lookup status: negative.`

Interpretacao:

- o painel nao quebrou
- o caminho de enrichment respondeu com um resultado util, ainda que negativo

### 5. Aba Vault

[OK] A troca para `Agent Vault` funcionou.

[OK] A tela de vault mostrou o estado inicial esperado para um usuario ainda nao bootstrapado:

- vault pendente
- botao `Connect Wallet`
- status de automacao inativo
- nenhum job de execucao registrado

## Achados

### Confirmados

1. O site publico esta funcional e responsivo no fluxo basico.
2. O modal de MCP e acessivel ao usuario sem rotas internas.
3. A selecao de pools altera o score de risco em tempo real.
4. O painel de Nansen responde com estado final coerente para dados ausentes.
5. A aba de vault apresenta o estado de onboarding esperado para um usuario novo.

### Limites do teste

1. Nao foi possivel validar autenticacao real de wallet, bootstrap on-chain e acoes de automacao com assinatura, porque isso exigiria credenciais do usuario.
2. A captura inicial do pool ativo nao ficou estavel na primeira leitura automatizada, mas a troca de estado posterior foi confirmada com sucesso.

## Conclusao

O site publico passou nos smoke tests principais de navegacao e interacao:

- carregamento da homepage
- abertura do modal de agente
- interacao com o scanner de rendimento
- resposta do painel de risco
- navegacao para a area de vault

Nao foram observados erros de console ou exceptions de pagina durante a execucao.
