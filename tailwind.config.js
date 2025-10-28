/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './app.js',
    './assets/**/*.js',
    './assets/**/*.html'
  ],
  safelist: [
    'theme-red',
    'text-gradient',
    'dot', 'dot-green', 'dot-blue', 'dot-purple',
    'btn', 'btn-blue', 'btn-green', 'btn-purple',
    'card', 'icon-tile', 'feature-area'
  ],
  theme: { extend: {} },
  plugins: []
};
