const path = require('path');

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
  externals: {
    'electron': 'commonjs electron'
  }
};