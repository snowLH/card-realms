# Runbook — transferência do Supabase para a conta Folklard

Este documento controla a reorganização do backend antes da criação do staging. O projeto `cryohive` está explicitamente fora de escopo: não deve ser pausado, retomado, transferido, reconfigurado ou usado para testes do Folklard.

## Estado em 27 de setembro de 2026

| Item | Estado | Evidência |
| --- | --- | --- |
| Projeto de origem identificado | PASS | `Card Realms`, ref `lfmbvqixixbhffdpmvhp`, organização `Card Realms` (`eyozglwnpizvqptnnlsd`) |
| Origem saudável | PASS | `ACTIVE_HEALTHY`, região `sa-east-1`, PostgreSQL `17.6.1.166`, plano Free |
| Proprietário de origem | PASS | `henrysoldan@gmail.com`, Owner e único membro da organização |
| GitHub Integration no Supabase | PASS | nenhuma conexão ativa; seletor ainda mostra `Choose GitHub repository` |
| Integração Supabase–Vercel | PASS | não instalada no Supabase; painel oferece `Install Vercel integration` |
| Log Drains | PASS | indisponíveis no Free e nenhum drain configurado |
| Edge Functions e secrets próprios | PASS | zero funções e nenhum custom secret |
| Vault secrets | PASS | zero entradas em `vault.secrets`; valores nunca foram consultados |
| Target `cryohive11` identificado | PASS | conta `cryohive11@gmail.com`, Owner da organização Free `cryo` (`vdxeeviukkxoztfvmaoe`) |
| Owner da origem no target | BLOCKED | `cryo` ainda possui somente `cryohive11@gmail.com`; o operador da origem precisa ser convidado antes da transferência |
| Backup lógico restarável | BLOCKED | plano Free não oferece backup; `pg_dump`/`supabase db dump` exige a senha do banco, que não está disponível e não será solicitada em chat |
| Transferência | BLOCKED | não iniciada; depende dos dois itens anteriores |
| Staging | READY | projeto vazio `ywawwhnsvpfeppfcuwzg`, região `us-east-1`, conectado a `snowLH/card-realms`; migrations ainda não aplicadas |

## Snapshot pré-transferência

- Banco: aproximadamente 11,96 MB.
- Schemas: `auth`, `extensions`, `graphql`, `graphql_public`, `public`, `realtime`, `storage`, `vault`.
- Schema `public`: 20 tabelas, todas com RLS; 34 índices; 96 constraints; 36 policies; 10 eventos de trigger.
- Dados de conta: zero usuários em `auth.users`; zero buckets e objetos de Storage; tabelas de progresso/PVP vazias.
- Conteúdo seed: 7 regiões, 7 criaturas e 3 missões.
- Realtime: somente `public.battle_events` está na publication `supabase_realtime` do banco legado.
- Migration history do Dashboard: vazio. O banco existente não pode ser tratado como se as migrations locais estivessem registradas.
- Advisors: quatro warnings de execução de `SECURITY DEFINER` nas funções públicas `is_battle_participant(uuid)` e `rls_auto_enable()` para `anon`/`authenticated`. A correção já está versionada na migration de hardening, mas não será aplicada neste projeto de origem durante a transferência.
- Auth: signup por e-mail e confirmação de e-mail habilitados; demais provedores desabilitados; Site URL `https://card-realms.vercel.app`; redirect permitido `https://card-realms.vercel.app/auth/callback`.
- Vercel: projeto `card-realms` (`prj_llxoMmp5EQtpB8IZc3QhIRkR7dSN`) conectado a `snowLH/card-realms`. Variáveis existentes, sem leitura de valores: `NEXT_PUBLIC_SITE_URL`, `GAME_ACTION_SECRET`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`; todas em Production e Preview.

## Pré-requisitos oficiais

A [documentação de transferência do Supabase](https://supabase.com/docs/guides/platform/project-transfer) exige:

1. o operador ser Owner da organização de origem;
2. o operador ser ao menos membro da organização de destino;
3. não existir GitHub Integration ativa;
4. não existir role com escopo de projeto (Team/Enterprise);
5. não existir Log Drain configurado.

O transfer mantém a região e pode causar 1–2 minutos de indisponibilidade quando houver mudança de plano. O plano da organização de destino também pode remover recursos. A ref do projeto deve permanecer a mesma numa transferência entre organizações, mas isso será verificado no pós-transferência antes de qualquer alteração de Vercel.

## Procedimento seguro

1. Usar somente a organização `cryo` (`vdxeeviukkxoztfvmaoe`), da conta `cryohive11@gmail.com`, como destino de `Card Realms` e de seu staging.
2. Convidar `henrysoldan@gmail.com` como membro temporário dessa organização e aceitar o convite. Isso é necessário para o seletor de transferência reconhecer o destino; elevação a Owner só deve ser usada se o Dashboard exigir.
3. Gerar um backup lógico fora do repositório público com a CLI oficial:

   ```bash
   supabase db dump --db-url <SESSION_POOLER_URL> -f roles.sql --role-only
   supabase db dump --db-url <SESSION_POOLER_URL> -f schema.sql
   supabase db dump --db-url <SESSION_POOLER_URL> -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
   ```

   A senha deve ser inserida localmente pelo proprietário; não deve ser enviada por chat, commit, log ou screenshot. Como `auth.users` e Storage estão vazios, o snapshot de inventário atual reduz o risco, mas não substitui esses três arquivos restaráveis.
4. Reabrir a prévia de transferência e selecionar somente `cryo` (`vdxeeviukkxoztfvmaoe`).
5. Revisar plano, permissões e aviso de downtime; somente então confirmar a transferência.
6. Verificar imediatamente: mesma project ref, região, status, Auth URLs, providers, chaves, Data API, Realtime, grants, RLS, Vercel e deploy publicado.
7. Usar `ywawwhnsvpfeppfcuwzg` como staging. Ele foi criado em `us-east-1`; não criar outro projeto nem reutilizar `cryohive` sem uma decisão explícita posterior.
8. Aplicar e homologar migrations somente nesse staging. Produção continua sem testes destrutivos.
9. Após a passagem de controle, remover `henrysoldan@gmail.com` da organização Folklard ou reduzir seu papel ao mínimo necessário. A conta antiga deve permanecer apenas com `cryohive`.

## Critério de parada

Se o navegador solicitar nova autenticação da conta `cryohive11@gmail.com` ou da conta de origem, a automação deve parar para o usuário fazer login. Nenhuma senha, OTP, recovery code ou secret deve ser solicitado ou digitado pelo agente.

