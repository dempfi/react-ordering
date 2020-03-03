import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import babel from 'rollup-plugin-babel';
import filesize from 'rollup-plugin-filesize';
import {terser} from 'rollup-plugin-terser';
import pkg from './package.json';

const external = (id) => !id.startsWith('.') && !id.startsWith('/');
const extensions = ['.js', '.jsx', '.ts', '.tsx'];

const umdConfig = ({minify} = {}) => ({
  input: pkg.source,
  external: ['react', 'react-dom', 'prop-types'],
  output: {
    name: 'SortableHOC',
    file: minify ? pkg['umd:main'].replace('.js', '.min.js') : pkg['umd:main'],
    format: 'umd',
    globals: {
      react: 'React',
      'react-dom': 'ReactDOM',
    },
  },
  plugins: [
    resolve({extensions}),
    babel({runtimeHelpers: true, extensions}),
    replace({
      'process.env.NODE_ENV': JSON.stringify(
        minify ? 'production' : 'development',
      ),
    }),
    commonjs(),
    minify ? terser() : {},
    filesize(),
  ],
});

const rollupConfig = [
  // Browser-friendly UMD builds
  umdConfig(),
  umdConfig({minify: true}),

  // CommonJS
  {
    input: pkg.source,
    external,
    output: [{file: pkg.main, format: 'cjs'}],
    plugins: [
      resolve({extensions}),
      babel({runtimeHelpers: true, extensions}),
      filesize(),
    ],
  },

  // ES module
  {
    input: pkg.source,
    external,
    output: [{file: pkg.module, format: 'esm'}],
    plugins: [
      resolve({extensions}),
      babel({runtimeHelpers: true, extensions}),
      filesize(),
    ],
  },
];

export default rollupConfig;
