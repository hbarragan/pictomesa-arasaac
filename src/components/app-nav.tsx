"use client";

import Link from "next/link";

type AppNavProps = {
  current?: "home" | "pictogramas" | "disenador" | "creador" | "evaluacion";
  showExternal?: boolean;
  subtitle: string;
};

const items = [
  { href: "/herramientas/pictogramas", label: "Pictogramas", key: "pictogramas" },
  { href: "/herramientas/disenador", label: "Disenador", key: "disenador" },
  { href: "/herramientas/creador-pictos", label: "Crear picto", key: "creador" },
] as const;

export function AppNav({ current, showExternal = false, subtitle }: AppNavProps) {
  return (
    <nav className="home-nav" aria-label="Navegacion principal">
      <Link className="home-brand" href="/">
        <span>Amaretea</span>
        <small>{subtitle}</small>
      </Link>
      <div>
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current === item.key ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        {showExternal ? (
          <a href="https://amaretea.es/" target="_blank" rel="noreferrer">
            amaretea.es
          </a>
        ) : null}
      </div>
    </nav>
  );
}
