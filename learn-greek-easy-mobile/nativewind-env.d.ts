/// <reference types="nativewind/types" />

// Ambient CSS module declarations so `tsc --noEmit` can resolve CSS imports.
declare module '*.css';

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
