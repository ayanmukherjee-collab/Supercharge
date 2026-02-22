import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // ── OpenAI ──
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
        secure: true,
      },
      // ── Anthropic ──
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        secure: true,
      },
      // ── DeepSeek ──
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
        secure: true,
      },
      // ── Mistral ──
      '/api/mistral': {
        target: 'https://api.mistral.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mistral/, ''),
        secure: true,
      },
      // ── Groq ──
      '/api/groq': {
        target: 'https://api.groq.com/openai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groq/, ''),
        secure: true,
      },
      // ── Together AI ──
      '/api/together': {
        target: 'https://api.together.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/together/, ''),
        secure: true,
      },
      // ── Perplexity ──
      '/api/perplexity': {
        target: 'https://api.perplexity.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/perplexity/, ''),
        secure: true,
      },
      // ── xAI (Grok) ──
      '/api/xai': {
        target: 'https://api.x.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/xai/, ''),
        secure: true,
      },
      // ── OpenRouter ──
      '/api/openrouter': {
        target: 'https://openrouter.ai/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openrouter/, ''),
        secure: true,
      },
      // ── Fireworks AI ──
      '/api/fireworks': {
        target: 'https://api.fireworks.ai/inference',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fireworks/, ''),
        secure: true,
      },
      // ── Cohere ──
      '/api/cohere': {
        target: 'https://api.cohere.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cohere/, ''),
        secure: true,
      },
      // ── Cerebras ──
      '/api/cerebras': {
        target: 'https://api.cerebras.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cerebras/, ''),
        secure: true,
      },
      // ── SambaNova ──
      '/api/sambanova': {
        target: 'https://api.sambanova.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sambanova/, ''),
        secure: true,
      },
      // ── AI21 Labs ──
      '/api/ai21': {
        target: 'https://api.ai21.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai21/, ''),
        secure: true,
      },
    },
  },
})
