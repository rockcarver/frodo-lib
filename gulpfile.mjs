import gulp from 'gulp';
import babel from 'gulp-babel';
import del from 'del';
import sourcemaps from 'gulp-sourcemaps';

gulp.task('clean', () => del(['cjs']));

gulp.task('transpile', () =>
  gulp
    .src(['src/*.ts', 'src/**/*.ts'])
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(
      babel({
        plugins: [['@babel/plugin-transform-typescript']],
      })
    )
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('cjs'))
);

gulp.task('resources', () =>
  gulp.src(['src/**/*.json'], { base: './src/' }).pipe(gulp.dest('cjs'))
);

gulp.task('default', gulp.series('clean', 'transpile', 'resources'));
