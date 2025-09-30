const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development'

  return {
    mode: isDev ? 'development' : 'production',
    devtool: isDev ? 'inline-source-map' : false,

    entry: {
      'content': './entry-points/content.js',
      'background': './entry-points/background.js',
      'popup': './entry-points/popup/popup.js',
      'options': './entry-points/options/options.js'
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    },

    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'models', to: 'models', noErrorOnMissing: true },
          { from: 'plugins', to: 'plugins' },
          { from: 'core', to: 'core' },
          { from: 'platform', to: 'platform' },
          { from: 'plugin-manifest.json', to: 'plugin-manifest.json' },
          { from: 'entry-points/popup/popup.html', to: 'popup.html' },
          { from: 'entry-points/options/options.html', to: 'options.html' }
        ]
      })
    ],

    resolve: {
      alias: {
        '/core': path.resolve(__dirname, 'core'),
        '/platform': path.resolve(__dirname, 'platform'),
        '/plugins': path.resolve(__dirname, 'plugins'),
        '/tools': path.resolve(__dirname, 'tools')
      }
    },

    optimization: {
      splitChunks: {
        chunks(chunk) {
          return chunk.name !== 'background'
        }
      }
    },

    performance: {
      hints: isDev ? false : 'warning',
      maxAssetSize: 10 * 1024 * 1024,
      maxEntrypointSize: 10 * 1024 * 1024
    },

    watchOptions: {
      ignored: /node_modules/,
      aggregateTimeout: 300,
      poll: 1000
    }
  }
}