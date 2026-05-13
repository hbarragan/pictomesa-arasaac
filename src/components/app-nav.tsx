"use client";

import Link from "next/link";

type AppNavProps = {
  current?: "home" | "pictogramas" | "disenador" | "creador" | "evaluacion";
  subtitle: string;
};

const items = [
  { href: "/herramientas/pictogramas", label: "Pictogramas", key: "pictogramas" },
  { href: "/herramientas/disenador", label: "Disenador", key: "disenador" },
  { href: "/herramientas/creador-pictos", label: "Crear picto", key: "creador" },
  { href: "/herramientas/evaluacion", label: "Evaluacion", key: "evaluacion" },
] as const;

export function AppNav({ current, subtitle }: AppNavProps) {
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
        <a href="https://amaretea.es/" target="_blank" rel="noreferrer">
          amaretea.es
        </a>
      </div>
    </nav>
  );
}
