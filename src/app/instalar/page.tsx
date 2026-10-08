import "./install.css";
import Link from "next/link";
import { Download, Monitor, Smartphone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Instalar Folklard — PC e celular" };

export default function InstallPage() {
  return (
    <main className="folklard-install">
      <div className="folklard-install__hero">
        <span className="folklard-install__eyebrow">CRÔNICAS DE AURÓRIA</span>
        <h1>Leve Folklard para sua tela</h1>
        <p>Instale o jogo como aplicativo no computador ou celular. Seu progresso online continua ligado à mesma conta.</p>
        <Link href="/">← Voltar ao jogo</Link>
      </div>
      <div className="folklard-install__grid">
        <article>
          <Smartphone aria-hidden="true" />
          <h2>Android e iPhone</h2>
          <p>Android: abra o jogo no Chrome e escolha <strong>Instalar aplicativo</strong> no menu. iPhone: no Safari, toque em <strong>Compartilhar → Adicionar à Tela de Início</strong>.</p>
          <p>O aplicativo abre em tela própria, sem a barra normal do navegador.</p>
          <a href="https://github.com/snowLH/card-realms/actions/workflows/android-app.yml" target="_blank" rel="noopener noreferrer">Ver versões Android de teste ↗</a>
        </article>
        <article>
          <Monitor aria-hidden="true" />
          <h2>Windows e Linux</h2>
          <p>O cliente desktop dedicado é empacotado em instalador Windows e AppImage Linux. Os arquivos ficam nos artefatos das execuções concluídas do GitHub Actions.</p>
          <a href="https://github.com/snowLH/card-realms/actions/workflows/desktop-app.yml" target="_blank" rel="noopener noreferrer"><Download aria-hidden="true" /> Ver instaladores ↗</a>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" />
          <h2>Antes de instalar</h2>
          <p>Os instaladores ainda são compilações de teste, sem assinatura de distribuição. O jogo precisa de internet para carregar o servidor e usar recursos online.</p>
          <p>O APK Android é de desenvolvimento; não é uma versão publicada na Play Store.</p>
        </article>
      </div>
    </main>
  );
}
