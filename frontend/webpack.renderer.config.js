const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  entry: './src/renderer/index.tsx',
  // 使用 'web' target：renderer 代码不依赖 Node API（Node 能力经 preload 的 contextBridge 注入 window.electronAPI），
  // 改用 'web' 后 bundle 在浏览器（管理端 web 页面）与 Electron 渲染进程均可运行，
  // 避免 'electron-renderer' 生成的代码依赖 require 导致浏览器端 "require is not defined" 白屏。
  target: 'web',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: /src/,
        use: [{ loader: 'ts-loader' }]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]'
        }
      }
    ]
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'renderer.js',
    // 让 webpack runtime 使用 globalThis（避免依赖读取 global 时崩溃）
    globalObject: 'globalThis'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@types': path.resolve(__dirname, 'src/types')
    }
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: path.join(__dirname, 'public'), to: path.join(__dirname, 'dist') }],
    }),
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
      inject: 'body'
    }),
    new webpack.DefinePlugin({
      global: 'globalThis',
    }),
    // 在 bundle 最前面注入 global（先于任何 import/模块执行）
    new webpack.BannerPlugin({
      raw: true,
      banner: 'var global = globalThis;',
    }),
  ],
  devServer: {
    static: [
      { directory: path.join(__dirname, 'dist') },
      { directory: path.join(__dirname, 'public'), publicPath: '/' },
    ],
    port: 3000,
    // Electron 渲染进程在 nodeIntegration=false 时没有 require，
    // webpack HMR 客户端会间接依赖 node polyfill，容易触发 "require is not defined"。
    // 这里关闭 hot，使用 liveReload 进行开发期刷新。
    hot: false,
    liveReload: true,
    historyApiFallback: true
  }
};