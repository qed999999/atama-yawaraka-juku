import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  base: "/AtamaYawa/",
  define: {
    // ✅ ビルドのたびに変わる値（ビルド時刻）を埋め込む
    __BUILD_VERSION__: JSON.stringify(Date.now()),
  },
  build: {
    outDir: resolve(__dirname, "../wwwroot"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
