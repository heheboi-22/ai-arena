import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /three\.core\.js$/ },
            { name: 'three-renderer', test: /three\.module\.js$/ },
          ],
        },
      },
    },
  },
})

