// imports

const json     = require('./package.json')
const sync     = require('browser-sync')
const del      = require('del')
const fs       = require('fs')
const gulp     = require('gulp')
const notifier = require('node-notifier')
const rollup   = require('rollup')
const babel    = require('rollup-plugin-babel')
const commonjs = require('rollup-plugin-commonjs')
const resolve  = require('rollup-plugin-node-resolve')
const uglify   = require('rollup-plugin-uglify')

// error handler

const onError = function(error) {
  notifier.notify({
    'title': 'Error',
    'message': 'Compilation failure.'
  })

  console.log(error)
}

// clean

gulp.task('clean', () => {
  return del(
    'dist/**.js',
    '!dist',
    '!dist/index.html'
  )
})

// attribution

const attribution =
`/*!
 * Layzr.js ${ json.version } - ${ json.description }
 * Copyright (c) ${ new Date().getFullYear() } ${ json.author.name } - https://github.com/${ json.repository }
 * License: ${ json.license }
 */
`

// js

const base = [
  resolve({
    jsnext: true,
    main: true,
    browser: true
  }),
  commonjs(),
  babel({
    exclude: 'node_modules/**',
    include: 'node_modules/knot'
  })
]

const minified = [
  uglify()
]

const read = flag => ({
  entry: 'src/layzr.js',
  sourceMap: true,
  plugins: flag
    ? base.concat(minified)
    : base
})

const write = {
  format: 'umd',
  exports: 'default',
  moduleName: 'Layzr',
  sourceMap: true
}

gulp.task('js', () => {
  return Promise
    .all([
      rollup.rollup(read(false)),
      rollup.rollup(read(true))
    ])
    .then(results => {
      const files = results.map(res => res.generate(write))

      // cache path to JS dist files
      const normal = 'dist/layzr.js'
      const minified = 'dist/layzr.min.js'

      // write attributions
      fs.writeFileSync(normal, attribution)
      fs.writeFileSync(minified, attribution)

      // write the sourcemap
      fs.writeFileSync('dist/maps/layzr.js.map', files[0].map.toString())

      // write JS files
      fs.appendFileSync(normal, files[0].code)
      fs.appendFileSync(minified, files[1].code)
    })
    .catch(onError)
})

// server

const server = sync.create()
const reload = sync.reload

const sendMaps = (req, res, next) => {
  const filename = req.url.split('/').pop()
  const extension = filename.split('.').pop()

  if(extension === 'css' || extension === 'js') {
    res.setHeader('X-SourceMap', '/maps/' + filename + '.map')
  }

  return next()
}

const options = {
  notify: false,
  server: {
    baseDir: 'dist',
    middleware: [
      sendMaps
    ]
  },
  watchOptions: {
    ignored: '*.map'
  }
}

gulp.task('server', () => sync(options))

// watch

gulp.task('watch', () => {
  gulp.watch('src/**/*.js', ['js', reload])
})

// build and default tasks

const exists = path => {
  try {
    return fs.statSync(path).isDirectory()
  } catch(error) {}

  return false
}

gulp.task('build', ['clean'], () => {
  // create dist directories
  if(!exists('dist')) fs.mkdirSync('dist')
  if(!exists('dist/maps')) fs.mkdirSync('dist/maps')

  // run the tasks
  gulp.start('js')
})

gulp.task('default', ['build', 'server', 'watch'])
