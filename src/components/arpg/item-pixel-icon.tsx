import styles from "./item-pixel-icon.module.css";

export type ArpgItemPixelIconKey =
  | "sword"
  | "bow"
  | "staff"
  | "compass"
  | "talisman"
  | "shell"
  | "books"
  | "chest"
  | "map";

const iconCell: Record<ArpgItemPixelIconKey, number> = {
  sword: 0,
  bow: 1,
  staff: 2,
  compass: 3,
  talisman: 4,
  shell: 5,
  books: 6,
  chest: 7,
  map: 8,
};

export function ArpgItemPixelIcon({
  item,
  size = 48,
}: {
  item: ArpgItemPixelIconKey;
  size?: number;
}) {
  const cell = iconCell[item];
  const column = cell % 3;
  const row = Math.floor(cell / 3);

  return (
    <span
      aria-hidden="true"
      className={styles.icon}
      style={{
        width: size,
        height: size,
        backgroundPosition: `${column * 50}% ${row * 50}%`,
      }}
    />
  );
}
