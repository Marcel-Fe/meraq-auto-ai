import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Hängt .ts an, wenn ein relativer Import ohne Endung sonst ins Leere liefe */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    try {
      const candidate = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(fileURLToPath(candidate))) {
        return next(`${specifier}.ts`, context)
      }
    } catch {
      /* kein auflösbarer Pfad – der Standardweg meldet den Fehler */
    }
  }
  return next(specifier, context)
}
