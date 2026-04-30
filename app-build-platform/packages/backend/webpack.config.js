const webpack = require('webpack');
const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function (options, webpack) {
  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
    module: {
      ...options.module,
      rules: [
        ...options.module.rules,
        {
          test: /\.node$/,
          use: 'node-loader',
        },
        {
          test: /\.html$/,
          type: 'asset/source',
        },
      ],
    },
    resolve: {
      ...options.resolve,
      extensions: ['.ts', '.js', '.node'],
    },
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        resourceRegExp: /^mock-aws-s3$/,
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /^aws-sdk$/,
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /^nock$/,
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /\/nw-pre-gyp\//,
      }),
    ],
  };
};
