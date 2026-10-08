import "./install.css";
import Link from "next/link";
import { Download, Monitor, Smartphone, ShieldCheck, Apple, Gamepad2 } from "lucide-react";
import type { Metadata } from "next";
import { getDownloadReleases, type DownloadRelease, type DownloadPlatform } from "@/server/downloads/releases";

export const metadata: Metadata = {
  title: "Baixar Folklard — Windows, Android e Linux",
  description: "Baixe Folklard — Crônicas de Aurória. Downloads oficiais, requisitos e instruções de instalação.",
};

const platforms: { key: DownloadPlatform; title: string; button: string; requirements: string; steps: string[] }[] = [
  {
    key: "windows", title: "Windows", button: "BAIXAR PARA WINDOWS",
    requirements: "Windows 10 ou 11 · processador x64 · internet",
    steps: ["Baixe o instalador .exe e abra o arquivo.", "Escolha a pasta de instalação e abra Folklard pelo atalho.", "Use WASD ou as setas para mover. F11 alterna a tela cheia."],
  },
  {
    key: "android", title: "Android", button: "BAIXAR APK ANDROID",
    requirements: "Android 7 ou superior · WebView 111 ou superior · internet",
    steps: ["Baixe o APK e abra pelo gerenciador de arquivos.", "Se solicitado, permita a instalação por esse aplicativo apenas para concluir a instalação.", "Nas dungeons, gire o aparelho para paisagem e use o joystick e os botões de combate."],
  },
  {
    key: "linux", title: "Linux", button: "BAIXAR PARA LINUX",
    requirements: "Linux · processador x86_64 · suporte a AppImage · internet",
    steps: ["Baixe o arquivo .AppImage.", "Nas propriedades do arquivo, permita a execução como programa e abra Folklard.", "Algumas distribuições exigem o pacote FUSE para executar AppImages."],
  },
];


function signingLabel(release: DownloadRelease) {
  if (release.signing === "signed-release") return "Distribuição";
  if (release.signing === "development-test") return "Desenvolvimento";
  if (release.signing === "unsigned-test") return "Não assinada";
  return null;
}

function platformReleaseNote(platform: DownloadPlatform, release: DownloadRelease) {
  if (platform === "windows") {
    return release.signing === "signed-release"
      ? "Instalador assinado para distribuição. O SmartScreen ainda pode alertar enquanto a versão ganha reputação."
      : "Instalador de teste sem certificado de distribuição confirmado. O Windows pode exibir um aviso de editor desconhecido.";
  }
  if (platform === "android") {
    return release.signing === "signed-release"
      ? "APK assinado para distribuição. Quem instalou um APK de desenvolvimento anterior pode precisar desinstalá-lo antes de instalar esta versão."
      : "APK de teste com assinatura de desenvolvimento ou assinatura ainda não confirmada. A compatibilidade física continua em validação.";
  }
  return "Aplicativo portátil de teste. Não exige uma instalação tradicional.";
}

function ReleaseDetails({ release }: { release: DownloadRelease }) {
  return (
    <dl className="folklard-install__release">
      {release.version
          ? <div><dt>Versão</dt><dd>{release.version} · teste</dd></div>
          : <div><dt>Canal</dt><dd>Build de teste</dd></div>}
      {release.size !== null && <div><dt>Arquivo</dt><dd>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(release.size / 1048576)} MB</dd></div>}
      {release.updatedAt && <div><dt>Atualizado</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(release.updatedAt))}</dd></div>}
      {release.commit && <div><dt>Compilação</dt><dd>{release.commit.slice(0, 7)}</dd></div>}
      {signingLabel(release) && <div><dt>Assinatura</dt><dd>{signingLabel(release)}</dd></div>}
    </dl>
  );
}

export default async function InstallPage() {
  const releases = await getDownloadReleases();
  return (
    <main className="folklard-install">
      <div className="folklard-install__hero">
        <span className="folklard-install__eyebrow"><Gamepad2 size={18} aria-hidden="true" /> CRÔNICAS DE AURÓRIA</span>
        <h1>Aurória, onde você estiver.</h1>
        <p>Treze lendas. Três biomas. Uma nova expedição a cada partida. Leve Folklard para uma janela própria no computador ou para a tela do seu celular.</p>
        <Link href="/">← Voltar ao jogo</Link>
        <div className="folklard-install__connection">Conexão com a internet necessária para carregar o jogo e sincronizar o progresso da conta.</div>
      </div>
      <div className="folklard-install__grid">
        {platforms.map((platform) => {
          const release = releases[platform.key];
          return (
            <article className="folklard-install__card" key={platform.key}>
              {platform.key === "android" ? <Smartphone aria-hidden="true" /> : <Monitor aria-hidden="true" />}
              <h2>{platform.title}</h2>
              <span className={`folklard-install__status${release.available ? " is-available" : ""}`}>{release.available ? "Arquivo disponível" : "Download não confirmado"}</span>
              <p className="folklard-install__requirements">{platform.requirements}</p>
              <ReleaseDetails release={release} />
              {release.available
                ? <a className="folklard-install__button" href={release.url}><Download size={19} aria-hidden="true" />{platform.button}</a>
                : <span className="folklard-install__unavailable">Não foi possível verificar o arquivo agora. Tente novamente em alguns minutos.</span>}
              <details className="folklard-install__instructions">
                <summary>Como instalar</summary>
                <ol>{platform.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              </details>
              <small>{platformReleaseNote(platform.key, release)}</small>
              {release.sha256 && <details className="folklard-install__checksum"><summary>Verificar integridade · SHA-256</summary><code>{release.sha256}</code></details>}
            </article>
          );
        })}
        <article className="folklard-install__card">
          <Apple aria-hidden="true" />
          <h2>iPhone e iPad</h2>
          <span className="folklard-install__status is-available">Disponível pela tela de início</span>
          <p className="folklard-install__requirements">Safari atualizado · internet</p>
          <p>Abra Folklard no Safari e adicione o jogo à tela de início. Seu acesso ganha um ícone próprio.</p>
          <Link className="folklard-install__button" href="/">ABRIR O JOGO</Link>
          <details className="folklard-install__instructions" open>
            <summary>Como adicionar à tela de início</summary>
            <ol><li>No Safari, abra o jogo.</li><li>Toque em Compartilhar e em Adicionar à Tela de Início.</li><li>Confirme o nome e toque em Adicionar.</li></ol>
          </details>
          <small>Distribuição nativa por TestFlight e App Store ainda indisponível. Esta opção usa o navegador.</small>
        </article>
      </div>
      <div className="folklard-install__note">
        <ShieldCheck aria-hidden="true" />
        <p>Os botões apontam diretamente para arquivos das releases oficiais do projeto. A disponibilidade é conferida periodicamente. As edições atuais são de teste; requisitos de memória e desempenho ainda dependem da homologação em aparelhos reais.</p>
      </div>
    </main>
  );
}
