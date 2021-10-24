const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const cors = require('cors');

const app = express();

const tourRoute = require(path.join(__dirname, './routes/tourRoutes.js'));
const userRoute = require(path.join(__dirname, './routes/userRoutes.js'));

const globalErrorHandler = require(path.join(__dirname,'./controllers/errorController.js'));
const appError = require(path.join(__dirname, './utils/appError.js'));

//My custom middleware

//Implementing CORS
//1) If we have to allow every domain to access our api
app.use(cors()); //will allow requests from all domains.

//2) If we have to allow only on the main domain eg:
//backend: api.kaiwalya.com, frontend: kaiwalya.com so we want cors for kaiwalya.com and all its subdomains
// app.use(cors({
//   origin: 'https://www.kaiwalya.com'
// }))

//now we will handle the non-normal requests
app.options('*', cors()); //will allow for all routes
//or if for specific route then
// app.options('/api/v1/tours/:id', cors());

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

app.use(helmet());

if(process.env.NODE_ENV === 'development'){
  app.use(morgan('dev'));
}

//Rate limiter
const limiter = rateLimit({
  max: 100,
  windowMs: 60*60*1000,
  message: 'Too many request from this IP please try again later after an hour'
});
app.use('/api', limiter);

//External Middleware
app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize()); //this will eliminate all the query injections
app.use(xss()); //this will eliminate the code injections (html, js etc)
app.use(hpp({
  whitelist: [
    'duration',
    'ratingQuantity',
    'ratingAverage',
    'maxGroupSize',
    'difficulty',
    'price'
  ]
})); //this prevents the parameter pollution

app.use(compression());

app.use(express.static(path.join(__dirname+'/public')));

//Routes Mounting.
app.use('/api/v1/tours', tourRoute);
app.use('/api/v1/users', userRoute);


// ================== ERROR HANDLING ===============

//error handling if no route is catched (This block of code should be always at last of route handling else it will throw this error for each and every request we make)
app.all('*', (req, res, next) => {

  //Earlier error handler (Iteration 1)
  // res.status(404).json({
  //   status: 'fail',
  //   message: `${req.originalUrl} was not found on the server. Please check the Url :)`
  // });

  //Passing the error to new global error handler (Iteration 2)
  // const err = new Error(`${req.originalUrl} was not found on the server. Please check the Url :)`);
  // err.statusCode = 404;
  // err.status = 'fail';

  //whenever something is passed in next in any middleware then it is always considered as error and then sent to global error handling middleware.
  // next(err);

  //Iteration 3 (final iteration)
  //Using the newly created appError class to reduce redundant creation of error handling code
  next(new appError(`${req.originalUrl} was not found on the server. Please check the Url :D`));
});

//Global Error handling middleware
app.use(globalErrorHandler);//using via controller

//previour interationof global error handling middleware
// app.use((err, req, res, next) => {

//   // console.log(err.stack);

//   err.statusCode = err.statusCode || 500;
//   err.status = err.status || 'err';

//   res.status(err.statusCode).json({
//     status: err.status,
//     message: err.message
//   });
//   next();
// });

//================= Starting the server==============
module.exports = app;