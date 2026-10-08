import "./install.css";
import Link from "next/link";
import { Download, Monitor, Smartphone, ShieldCheck, Apple, Gamepad2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Baixar Folklard — Windows, Android e Linux",
  description: "Baixe o Folklard — Crônicas de Aurória como aplicativo para computador ou celular.",
};

const releases = {
  windows: "https://github.com/snowLH/card-realms/releases/download/downloads-desktop/Folklard-Windows.exe",
  android: "https://github.com/snowLH/card-realms/releases/download/downloads-android/Folklard-Android.apk",
  linux: "https://github.com/snowLH/card-realms/releases/download/downloads-desktop/Folklard-Linux.AppImage",
};

type DownloadKey = keyof typeof releases;

async function getAvailableDownloads(): Promise<Record<DownloadKey, boolean>> {
  const checks = await Promise.all(
    (Object.keys(releases) as DownloadKey[]).map(async (key) => {
      try {
        const response = await fetch(releases[key], { method: "HEAD", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(4500) });
        return [key, response.status >= 200 && response.status < 400] as const;
      } catch {
        return [key, false] as const;
      }
    }),
  );
  return Object.fromEntries(checks) as Record<DownloadKey, boolean>;
}

export default async function InstallPage() {
  const available = await getAvailableDownloads();
  return (
    <main className="folklard-install">
      <div className="folklard-install__hero">
        <span className="folklard-install__eyebrow"><Gamepad2 size={18} aria-hidden="true" /> CRÔNICAS DE AURÓRIA</span>
        <h1>Seu próximo mundo começa aqui.</h1>
        <p>Baixe Folklard diretamente pelo nosso site e jogue em uma janela dedicada, no computador ou celular. Escolha sua plataforma.</p>
        <Link href="/">← Voltar ao jogo</Link>
      </div>
      <div className="folklard-install__grid">
        <article className="folklard-install__card">
          <Monitor aria-hidden="true" />
          <h2>Windows</h2>
          <p>Instalador para computadores com Windows 10 ou 11 (64 bits).</p>
          {available.windows ? <a className="folklard-install__button" href={releases.windows}><Download size={19} /> BAIXAR PARA WINDOWS</a> : <span className="folklard-install__unavailable">Preparando download para Windows</span>}
          <small>Versão de teste • conexão com a internet necessária</small>
        </article>
        <article className="folklard-install__card">
          <Smartphone aria-hidden="true" />
          <h2>Android</h2>
          <p>Aplicativo APK para instalar no seu celular Android.</p>
          {available.android ? <a className="folklard-install__button" href={releases.android}><Download size={19} /> BAIXAR APK ANDROID</a> : <span className="folklard-install__unavailable">Preparando APK para Android</span>}
          <small>APK de teste • pode exigir autorização para instalar</small>
        </article>
        <article className="folklard-install__card">
          <Monitor aria-hidden="true" />
          <h2>Linux</h2>
          <p>Aplicativo portátil AppImage para sistemas Linux 64 bits.</p>
          {available.linux ? <a className="folklard-install__button" href={releases.linux}><Download size={19} /> BAIXAR PARA LINUX</a> : <span className="folklard-install__unavailable">Preparando download para Linux</span>}
          <small>Versão de teste • arquivo AppImage</small>
        </article>
        <article className="folklard-install__card">
          <Apple aria-hidden="true" />
          <h2>iPhone e iPad</h2>
          <p>No Safari, abra o jogo e toque em <strong>Compartilhar → Adicionar à Tela de Início</strong>. O aplicativo aparece com ícone próprio.</p>
          <Link className="folklard-install__button" href="/">ABRIR PARA INSTALAR</Link>
          <small>Distribuição nativa pela App Store ainda indisponível</small>
        </article>
      </div>
      <div className="folklard-install__note">
        <ShieldCheck aria-hidden="true" />
        <p>Downloads hospedados na área oficial de versões do projeto. Os instaladores ainda não têm assinatura de distribuição e não foram homologados em todos os aparelhos. O jogo utiliza o servidor online para carregar e salvar seu progresso.</p>
      </div>
    </main>
  );
}
