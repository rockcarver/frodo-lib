/* eslint-disable import/no-extraneous-dependencies */
import gulp from 'gulp';
import babel from 'gulp-babel';
import del from 'del';
import sourcemaps from 'gulp-sourcemaps';

gulp.task('clean', () => del(['cjs']));

gulp.task('transpile', () =>
  gulp
    .src(['src/*.mjs', 'src/**/*.mjs'])
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(
      babel({
        plugins: [
          ['@babel/plugin-proposal-export-namespace-from'],
          [
            '@babel/plugin-transform-modules-commonjs',
            {
              importInterop: 'babel',
            },
          ],
          ['babel-plugin-transform-import-meta'],
        ],
      })
    )
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('cjs'))
);

gulp.task('resources', () =>
  gulp.src(['src/**/*.json'], { base: './src/' }).pipe(gulp.dest('cjs'))
);

gulp.task('default', gulp.series('clean', 'transpile', 'resources'));
