# Relatorio de Auditoria MCP - NeuralRate

Data da auditoria: 2026-05-27
Endpoint testado: https://neuralrate-worker.neuralrate.workers.dev/mcp

## Escopo

Teste de smoke do MCP publico usando um cliente real do protocolo.

Regras seguidas:

- nenhuma rota interna foi usada
- nenhuma chamada de atalho substituiu o cliente MCP
- o teste foi executado contra o endpoint publico em producao

## Metodologia

Fluxos executados:

1. Conexao Streamable HTTP ao MCP publico
2. Listagem do catalogo de ferramentas
3. Chamadas reais para ferramentas read-only
4. Tentativa de chamada de uma mutacao com session token invalido

Ferramentas exercitadas:

- `yield_scan`
- `tbill_spread`
- `risk_assess`
- `optimal_allocation`
- `get_user_state`
- `list_jobs`
- `update_agent_policy` com token invalido

## Resultados

### 1. Conexao e handshake

[OK] O cliente MCP conectou com sucesso.

[OK] O servidor respondeu com:

- `name`: `neuralrate-mcp`
- `version`: `1.0.0`

### 2. Catalogo publico

[OK] O endpoint respondeu com ferramentas.

[ACHADO] O catalogo publico incluiu ferramentas que nao deveriam estar no MCP read-only publico segundo a documentacao:

- `log_decision`
- `bootstrap_user_vault`
- `update_agent_policy`
- `issue_automation_grant`
- `revoke_automation_grant`
- `queue_benchmark`
- `execute_strategy`

Interpretacao:

- o endpoint publico nao esta restrito ao subconjunto read-only esperado
- isso expande a superficie exposta a modelos externos

### 3. Ferramentas read-only

[OK] As ferramentas publicas principais responderam com dados reais:

- `yield_scan` retornou pools reais do Mantle, incluindo `SYRUPUSDT`, `SUSDE` e `USDY`
- `tbill_spread` retornou um spread calculado de `132 bps` para `apy = 5`
- `risk_assess` retornou score `59/100` com classificacao `HIGH`
- `optimal_allocation` retornou uma proposta de alocacao com tres ativos
- `get_user_state` retornou o estado vazio esperado para `ownerEoa = 0x000...000`
- `list_jobs` retornou filas vazias

### 4. Mutacao com token invalido

[OK] A tentativa de `update_agent_policy` com `sessionToken` invalido foi rejeitada.

Resposta observada:

- `Unknown MCP mutation session.`

Interpretacao:

- a validacao de execucao ainda existe no runtime
- mesmo assim, o simples fato de a mutacao aparecer no catalogo publico continua sendo um problema de exposicao

## Achados

### Confirmados

1. O MCP publico esta acessivel e funcional.
2. As ferramentas read-only respondem com dados reais.
3. O catalogo publico exposto e mais amplo do que o contrato documental descreve.
4. A mutacao testada nao executou sem session valida.

### Risco principal

1. O endpoint publico esta advertindo ferramentas mutaveis no catalogo.
   Isso pode induzir modelos ou integracoes externas a tentar acoes que deveriam ficar fora do MCP publico.

## Conclusao

O MCP publico esta operacional, mas o catalogo publicado precisa de revisao.

O smoke confirmou:

- handshake valido
- tools reais respondendo
- guard rails no runtime para mutacao invalida

Ao mesmo tempo, o catalogo publico inclui ferramentas alem do subconjunto read-only esperado pela documentacao, o que merece correcao antes de considerar o MCP como estritamente publico e somente leitura.

