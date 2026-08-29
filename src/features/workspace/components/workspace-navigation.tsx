"use client";

import { clsx } from "clsx";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
<<<<<<< Updated upstream
=======
import { useEffect, useRef } from "react";
>>>>>>> Stashed changes

import { workspaceSections } from "../model/sections";
import styles from "./workspace-shell.module.css";

export function WorkspaceNavigation() {
  const pathname = usePathname();
<<<<<<< Updated upstream
=======
  const activeLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeLink.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [pathname]);
>>>>>>> Stashed changes

  return (
    <nav className={styles.navigation} aria-label="Разделы анализа">
      <div className={styles.navigationInner}>
        {workspaceSections.map((section) => {
          const isActive = pathname === section.href || pathname.startsWith(`${section.href}/`);

          return (
            <Link
              key={section.id}
<<<<<<< Updated upstream
=======
              ref={isActive ? activeLink : undefined}
>>>>>>> Stashed changes
              href={section.href as Route}
              className={clsx(styles.navigationItem, isActive && styles.navigationItemActive)}
              aria-current={isActive ? "page" : undefined}
            >
              {section.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
