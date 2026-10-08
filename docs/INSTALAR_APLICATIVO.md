# Folklard como aplicativo

## Android e iPhone
O jogo já tem manifesto PWA e service worker. Abra https://card-realms.vercel.app no Chrome do Android e escolha **Instalar aplicativo** no menu. No iPhone, abra no Safari, use **Compartilhar > Adicionar à Tela de Início**. O jogo aparece com ícone próprio, abre sem barra de navegador e roda em janela dedicada. A primeira execução e os recursos online exigem conexão.

## Windows e Linux
O diretório `desktop/` contém um cliente Electron dedicado. O workflow **Desktop installers** em GitHub Actions gera instalador Windows (.exe) e AppImage Linux. Na página do workflow, escolha uma execução concluída e baixe o artefato do seu sistema; extraia o arquivo ZIP e execute o instalador. Os instaladores não são assinados digitalmente: o sistema pode exibir aviso. Não desative a segurança do sistema para instalá-los sem verificar a origem.

**Importante:** o aplicativo desktop carrega o jogo hospedado em https://card-realms.vercel.app; não é uma versão totalmente offline. Login e partidas cooperativas dependem do servidor. O Electron bloqueia acesso Node dentro do conteúdo remoto e abre links externos no navegador padrão.

## Publicação
Antes de divulgar como download estável, verificar build do workflow, instalação real em Windows/Linux e assinatura dos executáveis. Para APK Android nativo distribuído fora da Play Store, ainda é necessário um projeto Android com assinatura de release e testes em aparelho. Não chamar o PWA de APK.
