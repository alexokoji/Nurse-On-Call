/**
 * No-op stand-in for the `server-only` package.
 *
 * That package deliberately throws when it is imported outside Next's server
 * bundler, which would stop Vitest from importing any module that guards
 * itself with it. Aliasing it here lets the tests exercise the real
 * server-side code; it changes nothing about how the app builds or runs.
 */
export {};
