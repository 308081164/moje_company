const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    main: './src/main/main.ts',
    preload: './src/main/preload.ts',
  },
  target: 'electron-main',
  module: {
    rules: [
      {
        test: /\.ts$/,
        include: /src/,
        use: [{ loader: 'ts-loader' }]
      }
    ]
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  plugins: [
    // 打包时可通过环境变量注入默认后端基址（不含 /api），例如: set JEWELRY_API_ORIGIN=http://8.8.8.8:8851 && npm run package:win
    new webpack.DefinePlugin({
      __JEWELRY_API_ORIGIN_BAKED__: JSON.stringify(process.env.JEWELRY_API_ORIGIN || ''),
    }),
  ],
  externals: {
    'electron': 'commonjs electron'
  }
};