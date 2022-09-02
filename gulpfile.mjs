import gulp from 'gulp';
import babel from 'gulp-babel';
import rename from 'gulp-rename';
import del from 'del';
import sourcemaps from 'gulp-sourcemaps';
import ts from 'gulp-typescript';

var tsProject = ts.createProject('tsconfig.json');

gulp.task('clean-esm', () => del(['esm']));

gulp.task('clean-build', () => del(['build']));

gulp.task('transpile-esm', () =>
  gulp
    .src(['src/*.ts', 'src/**/*.ts'])
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(babel({ configFile: './babel.config.esm.json' }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('build'))
);

gulp.task('create-mjs-esm', () =>
  gulp
    .src(['build/**/*.js'], { base: './build/' })
    .pipe(
      rename(function (path) {
        // Updates the object in-place
        path.dirname += '';
        path.basename += '';
        path.extname = '.mjs';
      })
    )
    .pipe(gulp.dest('esm'))
);

gulp.task('resources-esm', () =>
  gulp.src(['src/**/*.json'], { base: './src/' }).pipe(gulp.dest('esm'))
);

gulp.task('clean-cjs', () => del(['cjs']));

gulp.task('transpile-cjs', () =>
  gulp
    .src(['src/*.ts', 'src/**/*.ts'])
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(babel({ configFile: './babel.config.cjs.json' }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('cjs'))
);

gulp.task('resources-cjs', () =>
  gulp.src(['src/**/*.json'], { base: './src/' }).pipe(gulp.dest('cjs'))
);

gulp.task('clean-types', () => del(['types']));

gulp.task('generate-types', function () {
  var tsResult = tsProject.src().pipe(sourcemaps.init()).pipe(tsProject());
  return tsResult.pipe(sourcemaps.write('.')).pipe(gulp.dest('types'));
});

gulp.task(
  'default',
  gulp.parallel(
    gulp.series(
      'clean-build',
      'clean-esm',
      'transpile-esm',
      'resources-esm',
      'create-mjs-esm',
      'clean-build'
    ),
    gulp.series('clean-cjs', 'transpile-cjs', 'resources-cjs'),
    gulp.series('clean-types', 'generate-types')
  )
);
