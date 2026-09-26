import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="max-w-md text-center">
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-primary">
          Região desconhecida
        </p>
        <h1 className="mt-3 text-4xl font-black">O mapa termina aqui.</h1>
        <p className="mt-4 text-muted-foreground">
          Este caminho ainda não foi revelado pelos cartógrafos de Card Realms.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground"
        >
          Voltar ao mapa
        </Link>
      </div>
    </main>
  );
}
