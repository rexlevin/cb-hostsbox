import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
    base: './',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    plugins: [vue()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
        __APP_DESCRIPTION__: JSON.stringify(pkg.description)
    },
    build: {
        outDir: 'build',
        chunkSizeWarningLimit: 1500
    }
})
