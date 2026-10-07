import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import path from "path";

export default defineConfig({
  site: "https://palicakes.pt",
  // Endereços antigos que deixaram de existir: quem os tiver guardado (ou o
  // Google) é levado para o sítio novo. Se a categoria Cupcakes voltar a ser
  // ativada, retirar estas duas linhas.
  redirects: {
    "/catalogo/cupcakes": "/catalogo/miniaturas",
    "/catalogo/cupcakes/cupcakes": "/catalogo/miniaturas/cupcakes"
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes("/carrinho") &&
        !page.includes("/finalizar-encomenda") &&
        !page.includes("/admin")
    })
  ],
  vite: {
    resolve: {
      alias: {
        "@": path.resolve("./src")
      }
    }
  }
});