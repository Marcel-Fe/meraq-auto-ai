/**
 * Erlaubt Node, die erweiterungslosen Importe des Projekts aufzulösen
 * („./valuation" → „./valuation.ts"). Vite macht das im Browser selbst; Node
 * verlangt sonst die Endung, und dafür den Produktivcode umzuschreiben wäre
 * der falsche Weg herum.
 *
 * Verwendung: node --experimental-strip-types --import ./scripts/ts-resolve.mjs <skript>
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./ts-resolve-hook.mjs', pathToFileURL('./scripts/'))
