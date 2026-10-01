import type { CreatureDefinition } from "../types";
import { materializeCreatureSeeds, type CreatureSeed } from "./creature-seed";
import { ROOTS_CREATURE_SEEDS } from "./creatures/roots";
import { ARCHIPELAGO_CREATURE_SEEDS } from "./creatures/archipelago";
import { RUNIC_CREATURE_SEEDS } from "./creatures/runic";
import { MIST_CREATURE_SEEDS } from "./creatures/mist";
import { DESERT_CREATURE_SEEDS } from "./creatures/desert";
import { DEEP_SEA_CREATURE_SEEDS } from "./creatures/deep-sea";
import { ECLIPSE_CREATURE_SEEDS } from "./creatures/eclipse";

const CREATURE_SEED_GROUPS = [
  ROOTS_CREATURE_SEEDS,
  ARCHIPELAGO_CREATURE_SEEDS,
  RUNIC_CREATURE_SEEDS,
  MIST_CREATURE_SEEDS,
  DESERT_CREATURE_SEEDS,
  DEEP_SEA_CREATURE_SEEDS,
  ECLIPSE_CREATURE_SEEDS,
] satisfies readonly CreatureSeed[][];

const seeds = CREATURE_SEED_GROUPS.flat();

export const CREATURES: CreatureDefinition[] = materializeCreatureSeeds(seeds);

export const CREATURE_BY_ID = new Map(CREATURES.map((creature) => [creature.id, creature]));

export const STARTER_TEAM_IDS = [
  "boitata",
  "iara",
  "curupira",
  "saci-perere",
  "black-shuck",
  "boto-cor-de-rosa",
] as const;

export const NPC_TEAM_IDS = [
  "mula-sem-cabeca",
  "kappa",
  "mapinguari",
  "raiju",
  "domovoi",
  "qilin",
] as const;
