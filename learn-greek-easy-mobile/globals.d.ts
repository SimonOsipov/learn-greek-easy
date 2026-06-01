// Ambient CSS module declarations so `tsc --noEmit` can resolve CSS imports
// (e.g. `import '@/global.css'` and `import classes from './x.module.css'`).
//
// TEMPORARY (MOB-01a): this is replaced in MOB-02 (NativeWind & Design Tokens),
// which ships `nativewind-env.d.ts` providing its own `*.css` / `*.module.css`
// declarations. Remove this file once NativeWind is wired up.
declare module '*.css';

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
