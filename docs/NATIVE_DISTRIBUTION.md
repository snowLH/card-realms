# Distribuição nativa do Folklard

Os aplicativos carregam o site oficial via HTTPS. A tela local de recuperação
permite tentar novamente quando a rede falha; ela não promete gameplay offline.
Os projetos Android/iOS são gerados pelo Capacitor e ficam fora do Git.

## Builds reproduzíveis

- `desktop-app.yml`: valida o jogo, compila Windows/Linux e publica os dois
  arquivos somente depois de ambos passarem. Versão, commit, tamanho e SHA-256
  acompanham os binários nas releases `downloads-desktop`.
- `android-app.yml`: valida o jogo, gera recursos nativos, compila o APK de teste
  e guarda artefato. A release `downloads-android` só é substituída quando a
  assinatura corresponde ao APK atualmente distribuído. Uma chave debug nova
  impediria atualizar instalações existentes; não exigir desinstalação, pois isso
  poderia apagar o progresso de visitante armazenado no aparelho.
- `ios-simulator.yml`: valida o jogo e compila para simulador, sem assinatura.
  O resultado `.app` não é um IPA instalável em iPhone físico.
- `mobile/init-ios.cjs` contorna um erro confirmado no seletor SPM do Capacitor
  CLI 7.6.9: aceita a falha inicial apenas se o projeto SPM foi criado e a mensagem
  menciona Podfile; uma sincronização nova precisa passar. Outros erros falham.

## Assinatura real — acionamento manual

Configurar credenciais nos ambientes protegidos do GitHub, nunca no código,
em arquivos públicos ou no chat. Estes workflows não foram executados com
certificados reais nesta missão.

| Workflow | Ambiente | Secrets obrigatórios |
| --- | --- | --- |
| `windows-signed-release.yml` | `windows-release` | `WINDOWS_CSC_LINK`, `WINDOWS_CSC_KEY_PASSWORD` |
| `android-signed-release.yml` | `android-release` | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` |
| `ios-signed-release.yml` | `ios-release` | `IOS_CERTIFICATE_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISION_PROFILE_BASE64`, `IOS_TEAM_ID` |

A chave Android precisa preservar a identidade de atualização do aplicativo.
O pipeline de assinatura entrega um artefato; a promoção para download deve
conferir assinatura, versão e teste de atualização antes de substituir a release.

O pipeline iOS exige certificado Apple Distribution com chave privada e perfil
App Store válido para `com.folklard.auroria`, da equipe configurada. Valida equipe,
bundle ID, prazo e tipo do perfil, importa o certificado em chaveiro temporário,
exporta IPA para App Store Connect e apaga material de assinatura ao terminar.
Não cria certificados nem envia automaticamente ao TestFlight/App Store.
Aprovação Apple, cadastro do aplicativo, número de build disponível e conta
Apple Developer permanecem necessários para distribuição.

## Compatibilidade e evidências

Versão dos wrappers: 0.2.0. Android requer 7+ e WebView 111+ para o frontend
atual. Navegador/PWA e APKs antigos sem os novos plugins continuam compatíveis;
os novos plugins adicionam pausa ao minimizar, Voltar contextual e orientação
paisagem durante dungeons. O iPad usa `UIRequiresFullScreen` para permitir lock.

Foram gerados e sincronizados projetos Android e iOS localmente. Isso não
comprova compilação nativa nem teste em dispositivo. Windows/Linux 0.2.0 foram
compilados no GitHub, e os downloads completos tiveram SHA-256 confirmado.
O instalador Windows foi conferido como `NotSigned`.

Referências: [assinatura no GitHub Actions](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications),
[assinatura manual Apple](https://help.apple.com/xcode/mac/current/en.lproj/dev1bf96f17e.html).
