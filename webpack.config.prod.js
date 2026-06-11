const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'img', to: 'img' },
        { from: 'styles/main.css', to: 'styles/main.css' },
        { from: 'styles/main.css.map', to: 'styles/main.css.map', noErrorOnMissing: true },
        { from: 'js/vendor', to: 'js/vendor' },
        { from: 'fonts', to: 'fonts', noErrorOnMissing: true },
        { from: 'icon.svg', to: 'icon.svg' },
        { from: 'favicon.ico', to: 'favicon.ico' },
        { from: 'robots.txt', to: 'robots.txt' },
        { from: 'icon.png', to: 'icon.png' },
        { from: '404.html', to: '404.html' },
        { from: 'blog.html', to: 'blog.html' },
        { from: 'contacts.html', to: 'contacts.html' },
        { from: 'news.html', to: 'news.html' },
        { from: 'podcasts.html', to: 'podcasts.html' },
        { from: 'resources.html', to: 'resources.html' },
        { from: 'site.webmanifest', to: 'site.webmanifest' },
      ],
    }),
  ],
});
