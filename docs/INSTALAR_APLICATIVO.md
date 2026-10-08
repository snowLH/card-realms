# Folklard como aplicativo

## Android e iPhone
O jogo já tem manifesto PWA e service worker. Abra https://card-realms.vercel.app no Chrome do Android e escolha **Instalar aplicativo** no menu. No iPhone, abra no Safari, use **Compartilhar > Adicionar à Tela de Início**. O jogo aparece com ícone próprio, abre sem barra de navegador e roda em janela dedicada. A primeira execução e os recursos online exigem conexão.

## Windows e Linux
O diretório `desktop/` contém um cliente Electron dedicado. O workflow **Desktop installers** em GitHub Actions gera instalador Windows (.exe) e AppImage Linux. Na página do workflow, escolha uma execução concluída e baixe o artefato do seu sistema; extraia o arquivo ZIP e execute o instalador. Os instaladores não são assinados digitalmente: o sistema pode exibir aviso. Não desative a segurança do sistema para instalá-los sem verificar a origem.

**Importante:** o aplicativo desktop carrega o jogo hospedado em https://card-realms.vercel.app; não é uma versão totalmente offline. Login e partidas cooperativas dependem do servidor. O Electron bloqueia acesso Node dentro do conteúdo remoto e abre links externos no navegador padrão.

## Publicação
Antes de divulgar como download estável, verificar build do workflow, instalação real em Windows/Linux e assinatura dos executáveis. O diretório `mobile/` contém um projeto Capacitor que gera um **APK Android de teste** no workflow **Android test APK**. Após uma execução concluída, baixe o artefato `folklard-android-debug`, extraia o ZIP e instale o APK somente em dispositivo de teste. Esse APK usa assinatura de desenvolvimento, depende da versão web hospedada e ainda exige validação de login, desempenho e controles em aparelho real. Para publicação na Play Store é necessária assinatura de release e adequação às políticas da loja.

## iOS nativo
O projeto `mobile/` também suporta `npm run ios:init` em um Mac com Xcode. O workflow **iOS simulator app** compila a versão de simulador sem assinatura; esse artefato **não instala em iPhone físico**. Para distribuição TestFlight/App Store são necessários uma conta Apple Developer, identificadores de equipe, certificados, perfis de provisionamento, aprovação da Apple e testes reais.

## Android assinado
O workflow manual **Android signed release** só pode gerar um APK assinado quando os quatro segredos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` estiverem configurados no ambiente protegido `android-release` do GitHub. A chave deve ser criada e guardada pelo proprietário do aplicativo; nunca versionar o keystore ou suas senhas. A configuração do pipeline não equivale a um APK assinado publicado.

## Validação em dispositivos reais
Para concluir a homologação, testar em Android, iPhone, Windows e Linux: login e retorno de OAuth, áudio, touch/controle virtual, teclado, FPS, reentrada após minimizar, rede intermitente, progresso salvo, co-op e instalação/desinstalação. Os pipelines de CI verificam compilação, **não** substituem testes físicos. O cliente desktop e o app móvel carregam o servidor hospedado e exigem conexão para jogar.

## Windows assinado
O workflow manual **Windows signed release** utiliza o ambiente protegido `windows-release` e requer os segredos `WINDOWS_CSC_LINK` (certificado de assinatura de código) e `WINDOWS_CSC_KEY_PASSWORD`. Sem certificado válido, só os instaladores de teste sem assinatura estão disponíveis. A assinatura não dispensa validação de reputação e de instalação em máquina real.
