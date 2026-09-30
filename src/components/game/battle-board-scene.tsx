"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  CloudLightning,
  Compass,
  Flame,
  Leaf,
  MoonStar,
  ScrollText,
  Sparkles,
  Waves,
} from "lucide-react";
import {
  BATTLE_BOARD_BY_ID,
  resolveBattleBoard,
  type BattleBoardId,
} from "@/game/battle/presentation";
import { cn } from "@/lib/utils";

const boardIcons = {
  cartographer: Compass,
  ashes: Flame,
  tides: Waves,
  roots: Leaf,
  storms: CloudLightning,
  veil: MoonStar,
} satisfies Record<BattleBoardId, typeof Compass>;

function AmbientParticles({ board }: { board: BattleBoardId }) {
  return (
    <div className={cn("battle-board-ambient", `battle-board-ambient--${board}`)} aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <span key={index} style={{ "--ambient-index": index } as React.CSSProperties} />
      ))}
    </div>
  );
}

export function BattleBoardScene({
  boardId,
  children,
  cinematic = false,
}: {
  boardId: BattleBoardId | string | undefined;
  children: React.ReactNode;
  cinematic?: boolean;
}) {
  const board = resolveBattleBoard(boardId);
  const definition = BATTLE_BOARD_BY_ID.get(board)!;
  const Icon = boardIcons[board];

  return (
    <motion.div
      className={cn(
        "battle-board-scene",
        `battle-board-scene--${board}`,
        cinematic && "is-cinematic",
      )}
      data-battle-board={board}
      layout
    >
      <div className="battle-board-backdrop" aria-hidden="true">
        <div className="battle-board-depth battle-board-depth--far" />
        <div className="battle-board-depth battle-board-depth--mid" />
        <div className="battle-board-depth battle-board-depth--near" />

        {board === "cartographer" ? (
          <>
            <div className="board-prop board-prop--map"><ScrollText /></div>
            <div className="board-prop board-prop--compass"><Compass /></div>
            <div className="board-prop board-prop--book"><BookOpen /></div>
            <div className="board-prop board-prop--candle board-prop--candle-a"><Flame /></div>
            <div className="board-prop board-prop--candle board-prop--candle-b"><Flame /></div>
          </>
        ) : null}

        {board === "ashes" ? (
          <>
            <div className="board-prop board-prop--volcanic-ring" />
            <div className="board-prop board-prop--rune board-prop--rune-a">ᚱ</div>
            <div className="board-prop board-prop--rune board-prop--rune-b">ᚲ</div>
            <div className="board-prop board-prop--lava board-prop--lava-a" />
            <div className="board-prop board-prop--lava board-prop--lava-b" />
          </>
        ) : null}

        {board === "tides" ? (
          <>
            <div className="board-prop board-prop--water-ring" />
            <div className="board-prop board-prop--pillar board-prop--pillar-a" />
            <div className="board-prop board-prop--pillar board-prop--pillar-b" />
            <div className="board-prop board-prop--pool" />
          </>
        ) : null}

        {board === "roots" ? (
          <>
            <div className="board-prop board-prop--tree board-prop--tree-a" />
            <div className="board-prop board-prop--tree board-prop--tree-b" />
            <div className="board-prop board-prop--root board-prop--root-a" />
            <div className="board-prop board-prop--root board-prop--root-b" />
            <div className="board-prop board-prop--mushrooms" />
          </>
        ) : null}

        {board === "storms" ? (
          <>
            <div className="board-prop board-prop--sky-ring" />
            <div className="board-prop board-prop--banner board-prop--banner-a" />
            <div className="board-prop board-prop--banner board-prop--banner-b" />
            <div className="board-prop board-prop--storm-cloud" />
          </>
        ) : null}

        {board === "veil" ? (
          <>
            <div className="board-prop board-prop--veil-ring" />
            <div className="board-prop board-prop--lantern board-prop--lantern-a"><Sparkles /></div>
            <div className="board-prop board-prop--lantern board-prop--lantern-b"><Sparkles /></div>
            <div className="board-prop board-prop--spirit-gate" />
          </>
        ) : null}

        <AmbientParticles board={board} />
      </div>

      <div className="battle-board-nameplate" aria-label={definition.name}>
        <Icon />
        <span>
          <strong>{definition.name}</strong>
          <small>{definition.ambientLabel}</small>
        </span>
      </div>

      <div className="battle-board-content">{children}</div>
    </motion.div>
  );
}
