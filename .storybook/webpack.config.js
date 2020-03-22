module.exports = {
  resolve: { extensions: ['.ts', '.tsx', '.js', '.scss', '.css'] },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-typescript', '@babel/preset-react', '@babel/preset-env'],
              plugins: [
                '@babel/plugin-proposal-class-properties',
                ['@babel/transform-runtime', { useESModules: true, regenerator: false }],
                ['babel-plugin-transform-async-to-promises', { inlineHelpers: true }]
              ]
            }
          }
        ]
      },
      {
        test: /(\.scss)$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: true,
              localIdentName: '[name]__[local]'
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              plugins: [require('autoprefixer')]
            }
          },
          'sass-loader'
        ]
      },
      {
        test: /(\.css)$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  }
}
