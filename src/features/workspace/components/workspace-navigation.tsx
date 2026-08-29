"use client";

import { clsx } from "clsx";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { workspaceSections } from "../model/sections";
import styles from "./workspace-shell.module.css";

export function WorkspaceNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.navigation} aria-label="Разделы анализа">
      <div className={styles.navigationInner}>
        {workspaceSections.map((section) => {
          const isActive = pathname === section.href || pathname.startsWith(`${section.href}/`);

          return (
            <Link
              key={section.id}
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
