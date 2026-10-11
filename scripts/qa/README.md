# Simulação visual local de co-op

`authored-art-qa.tsx` utiliza os componentes de produção, a engine de raid e a dungeon compartilhada. Intercepta somente os requests do room ID fictício documentado no arquivo; não acessa banco, servidor externo ou contas reais. Dois jogadores protegidos permitem inspecionar uma sequência longa sem morrer durante a captura. Botões assistem chegada ao boss, thresholds e confirmação em memória. Não demonstram autorização de recompensa no servidor.

Para repetir em desenvolvimento, crie temporariamente `src/app/authored-art-qa/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import AuthoredArtQa from "../../../scripts/qa/authored-art-qa";
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AuthoredArtQa />;
}
```

Execute `npm run dev` e abra `/authored-art-qa`. Teste a intro com ambos os jogadores, o bloqueio de movimento/ataque/poder, os três thresholds, HP zero e purificação. A restauração local só confirma após RESTORED. Remova a página temporária antes de build/commit; a rota não faz parte da entrega. O arquivo neste diretório também não é importado pelo aplicativo de produção.

Para QA solo, `?debugDungeon=1&bossQA=1` disponibiliza as assistências de sala/dano somente em desenvolvimento offline. A dungeon publicada continua exigindo todas as salas anteriores, inclusive ramos, antes do boss. Veja as provas e limitações em `docs/AUTHORED_ART_QA.md`.
