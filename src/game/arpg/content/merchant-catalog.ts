import { REFUGE_FURNITURE_UNLOCK_ITEM_KEYS } from "@/game/refuge";

export const ARPG_MERCHANT_PRODUCTS = [
  {
    itemKey: REFUGE_FURNITURE_UNLOCK_ITEM_KEYS.books!,
    category: "cosmetic",
    kind: "Cosmético do Refúgio",
    name: "Estante de Lendas",
    description: "Desbloqueia livros decorativos para a casa do Cartógrafo.",
    price: 45,
  },
  {
    itemKey: REFUGE_FURNITURE_UNLOCK_ITEM_KEYS.chest!,
    category: "cosmetic",
    kind: "Cosmético do Refúgio",
    name: "Baú Entalhado",
    description: "Desbloqueia um baú decorativo para a casa do Cartógrafo.",
    price: 60,
  },
  {
    itemKey: REFUGE_FURNITURE_UNLOCK_ITEM_KEYS["map-stand"]!,
    category: "cosmetic",
    kind: "Cosmético do Refúgio",
    name: "Suporte de Mapas",
    description: "Desbloqueia mapas decorativos para a casa do Cartógrafo.",
    price: 75,
  },
] as const;

export type ArpgMerchantProduct = (typeof ARPG_MERCHANT_PRODUCTS)[number];
export type ArpgMerchantProductKey = ArpgMerchantProduct["itemKey"];

export const ARPG_MERCHANT_PRODUCT_BY_KEY = new Map(
  ARPG_MERCHANT_PRODUCTS.map((product) => [product.itemKey, product]),
);

export const ARPG_MERCHANT_PRODUCT_KEYS = new Set<string>(ARPG_MERCHANT_PRODUCT_BY_KEY.keys());
