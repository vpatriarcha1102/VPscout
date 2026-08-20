import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// "/" funciona para Netlify, Vercel ou domínio próprio (o app fica na raiz
// do site). Só troque para "/nome-do-repositorio/" se for publicar direto
// pelo GitHub Pages num repositório de projeto (não é o caso deste guia).
export default defineConfig({
  plugins: [react()],
  base: "/",
});
