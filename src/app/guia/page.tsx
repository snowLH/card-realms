import "./guia.css";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Crown,
  Download,
  Gamepad2,
  MapPinned,
  Play,
  Sparkles,
  Swords,
} from "@/components/ui/pixel-icon";
import { PLAYABLE_LEGENDS } from "@/game/arpg/content/legends";
import { ARPG_EXPEDITIONS } from "@/game/arpg/content/expeditions";
import { getExpeditionStages } from "@/game/arpg/content/stages";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";

export const metadata: Metadata = {
  title: "Guia do Explorador — Folklard ARPG",
  description: "Manual completo das expedições, biomas, fases sequenciais, mecânicas de combate e lendas folclóricas de Folklard.",
};

export default function GuidePage() {
  return (
    <main className="folklard-guide">
      <header className="folklard-guide__hero">
        <span className="folklard-guide__eyebrow">
          <Gamepad2 size={18} aria-hidden="true" /> CRÔNICAS DE AURÓRIA
        </span>
        <h1>Guia do Explorador</h1>
        <p>
          Bem-vindo ao mundo de Folklard. Aqui você encontrará o manual das expedições por fases
          sequenciais, as regras de combate em tempo real, as características das Lendas e o guia de controles.
        </p>
        <nav className="folklard-guide__nav" aria-label="Navegação do site">
          <Link href="/">
            <ArrowLeft aria-hidden="true" /> Voltar ao jogo
          </Link>
          <Link href="/instalar">
            <Download aria-hidden="true" /> Baixar aplicativo
          </Link>
        </nav>
      </header>

      <section className="folklard-guide__section" aria-labelledby="guide-expeditions-heading">
        <h2 id="guide-expeditions-heading">
          <MapPinned aria-hidden="true" /> Rotas & Fases Sequenciais
        </h2>
        <p>
          Cada expedição é uma jornada linear e temática dividida em três zonas de mundo sucessivas antes da câmara
          do chefe. Ao atravessar de uma zona para a seguinte, a ambientação visual, a trilha sonora adaptativa e
          a composição dos inimigos evoluem dinamicamente.
        </p>

        <div className="folklard-guide__grid">
          {ARPG_EXPEDITIONS.map((expedition) => {
            const stages = getExpeditionStages(expedition.id);
            return (
              <article key={expedition.id} className="folklard-guide__card">
                <span className="folklard-guide__tag">{expedition.elementLabel}</span>
                <h3>{expedition.name}</h3>
                <p>{expedition.description}</p>
                <ol>
                  {stages.map((stage) => (
                    <li key={stage.id}>
                      <strong>{stage.name}</strong>: {stage.subtitle}
                    </li>
                  ))}
                  <li>
                    <strong>Confronto Final</strong>: <Crown aria-hidden="true" /> {expedition.bossName}
                  </li>
                </ol>
              </article>
            );
          })}
        </div>
      </section>

      <section className="folklard-guide__section" aria-labelledby="guide-combat-heading">
        <h2 id="guide-combat-heading">
          <Swords aria-hidden="true" /> Combate em Tempo Real & Mecânicas
        </h2>
        <p>
          Folklard é um ARPG ágil em visão aérea com física de projéteis, esquiva tática e sinergias elementais.
        </p>

        <div className="folklard-guide__grid">
          <article className="folklard-guide__card">
            <span className="folklard-guide__tag">Arsenal</span>
            <h3>Dois Slots de Armas</h3>
            <p>
              Sua Lenda carrega duas armas distintas (Slot A e Slot B). Alterne entre elas com a tecla <strong>Q</strong> para
              adaptar seu alcance a cada grupo de inimigos. Espadas desferem cortes em arco corpo a corpo; cajados disparam
              projéteis mágicos velozes; arcos atingem alvos a longa distância.
            </p>
          </article>

          <article className="folklard-guide__card">
            <span className="folklard-guide__tag">Magia</span>
            <h3>Dois Poderes de Assinatura</h3>
            <p>
              Cada Lenda possui duas habilidades exclusivas inspiradas no seu folclore de origem. Os poderes operam
              em recargas independentes e podem controlar o terreno, invocar raízes e chamas, ou criar auras de proteção
              para si e aliados.
            </p>
          </article>

          <article className="folklard-guide__card">
            <span className="folklard-guide__tag">Agilidade</span>
            <h3>Esquiva com Invulnerabilidade</h3>
            <p>
              O comando de Dash concede uma investida rápida que ignora projéteis e dano de contato durante os frames
              de ação. Use-o para atravessar barreiras de espinhos, esquivar de flechas e reposicionar-se taticamente.
            </p>
          </article>

          <article className="folklard-guide__card">
            <span className="folklard-guide__tag">Exploração</span>
            <h3>Salas Especiais & Mercadores</h3>
            <p>
              Durante as expedições você encontrará clareiras de descanso seguras, empórios de mercadores eremitas e
              altares de eventos folclóricos. Use fragmentos obtidos quebrando caixotes e derrotando monstros para
              adquirir tônicos e bênçãos antes do chefe.
            </p>
          </article>
        </div>
      </section>

      <section className="folklard-guide__section" aria-labelledby="guide-legends-heading">
        <h2 id="guide-legends-heading">
          <Sparkles aria-hidden="true" /> Catálogo das 14 Lendas
        </h2>
        <p>
          Heróis baseados em tradições orais e lendas folclóricas de diversos povos, cada qual com identidade visual,
          atributos próprios e duas habilidades de combate exclusivas.
        </p>

        <div className="folklard-guide__grid">
          {PLAYABLE_LEGENDS.map((legend) => (
            <article key={legend.id} className="folklard-guide__card">
              <span className="folklard-guide__tag">{legend.folklore}</span>
              <h3>{legend.name}</h3>
              <p>
                <em>{legend.epithet}</em>
              </p>
              <p>{legend.description}</p>
              <div className="folklard-guide__legend-powers">
                <small>PODERES DE ASSINATURA:</small>
                <ul>
                  {legend.signatureAbilityIds.map((abilityId) => {
                    const ability = ARPG_ABILITY_CARD_BY_ID.get(abilityId);
                    if (!ability) return null;
                    return (
                      <li key={abilityId}>
                        <strong>{ability.name}</strong> ({ability.element}) — {ability.description}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="folklard-guide__section" aria-labelledby="guide-controls-heading">
        <h2 id="guide-controls-heading">
          <Gamepad2 aria-hidden="true" /> Esquema de Controles
        </h2>
        <p>
          Folklard oferece suporte nativo a Teclado/Mouse no computador, Controles Touch com auto-mira em celulares e
          Gamepads via Bluetooth/USB.
        </p>

        <table className="folklard-guide__controls-table">
          <thead>
            <tr>
              <th>Ação</th>
              <th>Teclado / Mouse</th>
              <th>Celular (Touch)</th>
              <th>Gamepad</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Movimentação</td>
              <td><code>W, A, S, D</code> ou Setas</td>
              <td>Joystick virtual esquerdo</td>
              <td>Analógico esquerdo / D-Pad</td>
            </tr>
            <tr>
              <td>Ataque Básico</td>
              <td>Clique Esquerdo / Barra de Espaço</td>
              <td>Botão de Ataque (com auto-mira)</td>
              <td>Botão X / Quadrado</td>
            </tr>
            <tr>
              <td>Esquiva (Dash)</td>
              <td><code>Shift</code> ou Barra de Espaço</td>
              <td>Botão de Dash</td>
              <td>Botão A / Cruz</td>
            </tr>
            <tr>
              <td>Poder 1</td>
              <td><code>Tecla 1</code></td>
              <td>Botão de Poder 1</td>
              <td>Gatilho Esquerdo (LT / L2)</td>
            </tr>
            <tr>
              <td>Poder 2</td>
              <td><code>Tecla 2</code></td>
              <td>Botão de Poder 2</td>
              <td>Gatilho Direito (RT / R2)</td>
            </tr>
            <tr>
              <td>Trocar Arma</td>
              <td><code>Tecla Q</code></td>
              <td>Botão de Troca de Arma</td>
              <td>Botão Y / Triângulo</td>
            </tr>
            <tr>
              <td>Interagir / Portal</td>
              <td><code>Tecla E</code></td>
              <td>Botão de Interação</td>
              <td>Botão B / Círculo</td>
            </tr>
            <tr>
              <td>Minimapa / Pausa</td>
              <td><code>Tecla M</code> / <code>Esc</code></td>
              <td>Ícone de Mapa / Pausa no HUD</td>
              <td>Start / Menu</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="folklard-guide__cta">
        <h2>Pronto para iniciar sua expedição?</h2>
        <p>Entre na Guilda dos Cartógrafos, escolha sua Lenda e enfrente as masmorras procedurais de Aurória.</p>
        <div className="folklard-guide__cta-buttons">
          <Link href="/" className="folklard-guide__button">
            <Play aria-hidden="true" /> Jogar no Navegador
          </Link>
          <Link href="/instalar" className="folklard-guide__button">
            <Download aria-hidden="true" /> Baixar Aplicativo
          </Link>
        </div>
      </div>
    </main>
  );
}
