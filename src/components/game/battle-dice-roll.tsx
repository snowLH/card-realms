"use client";

import { motion } from "framer-motion";
import { Dice5 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BattleDiceRoll({ value }: { value: number }) {
  return (
    <motion.div
      className={cn(
        "dice-result",
        value === 1 && "dice-result--miss",
        value === 6 && "dice-result--critical",
      )}
      initial={{ rotate: -520, scale: 0.1, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 13 }}
    >
      <Dice5 />
      <strong>{value}</strong>
      <span>
        {value === 1 ? "Falha crítica" : value === 6 ? "Acerto crítico" : "Ataque certeiro"}
      </span>
    </motion.div>
  );
}
