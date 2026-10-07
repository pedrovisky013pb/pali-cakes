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
    "/catalogo/cupcakes/cupcakes": "/catalogo/miniaturas/cupcakes",
    "/catalogo/bolos-personalizados/bolo-brnaco-com-flores":
      "/catalogo/bolos-personalizados/bolo-branco-com-flores"
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes("/carrinho") &&
        !page.includes("/finalizar-encomenda") &&
        !page.includes("/admin") &&
        // Categoria oculta da navegação e ainda sem produtos.
        !page.endsWith("/catalogo/doces/")
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