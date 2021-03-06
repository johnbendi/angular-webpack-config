/**
 * Webpack helpers & dependencies
 */
const commonConfig = require('./webpack.common'),
  webpackMerge = require('webpack-merge'),
  webpackMergeDll = webpackMerge.strategy({plugins: 'replace'});

const hardSourceWebpackPlugin = require('hard-source-webpack-plugin'),
  dllBundlesPlugin = require('webpack-dll-bundles-plugin').DllBundlesPlugin,
  commonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin'),
  addAssetHtmlPlugin = require('add-asset-html-webpack-plugin'),
  loaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');

const ENV = process.env.ENV = process.env.NODE_ENV = 'development';

const defaultConfig = function(settings) {
  return {
    /**
     * Developer tool to enhance debugging
     *
     * See: http://webpack.github.io/docs/configuration.html#devtool
     * See: https://github.com/webpack/docs/wiki/build-performance#sourcemaps
     */
    devtool: settings.webpack.devtool.DEV,

    /**
     * Add additional plugins to the compiler.
     *
     * See: http://webpack.github.io/docs/configuration.html#plugins
     */
    plugins: [
      /**
       * Plugin LoaderOptionsPlugin (experimental)
       *
       * See: https://gist.github.com/sokra/27b24881210b56bbaff7
       */
      new loaderOptionsPlugin({
        debug: true
      })
    ]
  };
};

const browserConfig = function(root, settings) {
  const pkg = require(root('package.json'));
  const ignore = list => key => !list.includes(key);

  const exclusions = [
    ...new Set(settings.webpack.bundles.polyfills.map(cur => cur.name || cur)),
    ...new Set(settings.webpack.bundles.server)
  ];

  return {
    /**
     * Options affecting the output of the compilation.
     *
     * See: http://webpack.github.io/docs/configuration.html#output
     */
    output: {
      /**
       * Specifies the name of each output file on disk.
       * IMPORTANT: You must not specify an absolute path here!
       *
       * See: http://webpack.github.io/docs/configuration.html#output-filename
       */
      filename: '[name].bundle.js',

      /**
       * The filename of the SourceMaps for the JavaScript files.
       * They are inside the output.path directory.
       *
       * See: http://webpack.github.io/docs/configuration.html#output-sourcemapfilename
       */
      sourceMapFilename: '[name].map',

      /** The filename of non-entry chunks as relative path
       * inside the output.path directory.
       *
       * See: http://webpack.github.io/docs/configuration.html#output-chunkfilename
       */
      chunkFilename: '[id].chunk.js',

      libraryTarget: 'var',
      library: '_awc'
    },

    /**
     * Add additional plugins to the compiler.
     *
     * See: http://webpack.github.io/docs/configuration.html#plugins
     */
    plugins: [
      /**
       * Plugin: DLLBundlesPlugin
       * Description: Bundles group of packages as DLLs
       *
       * See: https://github.com/shlomiassaf/webpack-dll-bundles-plugin
       */
      new dllBundlesPlugin({
        bundles: {
          polyfills: settings.webpack.bundles.polyfills,
          vendor: Object.keys(pkg.dependencies).filter(ignore(exclusions))
        },
        dllDir: root(`node_modules/.cache/dll`),
        webpackConfig: webpackMergeDll(commonConfig({env: ENV}, root, settings),
          {
            devtool: settings.webpack.devtool.DEV,
            plugins: []
          })
      }),

      /**
       * Plugin: HardSourceWebpackPlugin
       * Description: Provides intermediate caching step for modules
       *
       * See: https://github.com/mzgoddard/hard-source-webpack-plugin
       */
      new hardSourceWebpackPlugin(),

      /**
       * Plugin: CommonsChunkPlugin
       * Description: Shares common code between the pages.
       * It identifies common modules and put them into a commons chunk.
       *
       * See: https://webpack.github.io/docs/list-of-plugins.html#commonschunkplugin
       * See: https://github.com/webpack/docs/wiki/optimization#multi-page-app
       */
      new commonsChunkPlugin({
        name: 'polyfills',
        chunks: ['polyfills']
      }),
      // This enables tree shaking of the vendor modules
      new commonsChunkPlugin({
        name: 'vendor',
        chunks: ['app'],
        minChunks: module => /node_modules/.test(module.resource)
      }),
      // Specify the correct order the scripts will be injected in
      new commonsChunkPlugin({
        name: ['polyfills', 'vendor'].reverse()
      }),

      /**
       * Plugin: AddAssetHtmlPlugin
       * Description: Adds the given JS or CSS file to the files
       * Webpack knows about, and put it into the list of assets
       * html-webpack-plugin injects into the generated html.
       *
       * See: https://github.com/SimenB/add-asset-html-webpack-plugin
       */
      new addAssetHtmlPlugin([
        {filepath: root(`node_modules/.cache/dll/${dllBundlesPlugin.resolveFile('polyfills')}`)},
        {filepath: root(`node_modules/.cache/dll/${dllBundlesPlugin.resolveFile('vendor')}`)}
      ]),

      /**
       * Plugin LoaderOptionsPlugin (experimental)
       *
       * See: https://gist.github.com/sokra/27b24881210b56bbaff7
       */
      new loaderOptionsPlugin({
        options: {
          context: root()
        }
      })
    ]
  };
};

/**
 * Webpack configuration
 *
 * See: http://webpack.github.io/docs/configuration.html#cli
 */
module.exports = function(options, root, settings) {
  return webpackMerge(commonConfig({
    env: ENV,
    platform: options.platform
  }, root, settings), defaultConfig(settings), options.platform === 'server' ? {} : browserConfig(root, settings));
};
