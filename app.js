require('dotenv').config()
const express=require('express')
const session = require('express-session');
const app=express()
const userRoute=require('./routes/user')
const adminRoute=require('./routes/admin')
const path = require('path');
let mongoose=require('mongoose')
let bodyparser=require('body-parser')
let port=process.env.port || 4000
const cors = require('cors');

let errorHandler=require('./authMiddleware/errorHandlerMiddleware')

app.use(cors());

const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache'); 
  res.set('Expires', '0'); 
  next();
};
app.use(noCache);
//-----------------------------------------------------------------
//database connection
mongoose.connect(process.env.db_url).then(() => {
    console.log("Database connected successfully");
  }).catch((error) => {
    console.error("Database connection error:", error);
});
// --------------------------------------------------------------------

app.use(express.static('public'))


app.use(bodyparser.json())
app.use(bodyparser.urlencoded({extended:false}))
app.set('view engine', 'ejs');
app.set('views', 'views');

app.use('/',userRoute)
app.use('/admin',adminRoute)



app.use(errorHandler.notFound)
app.use(errorHandler.errorHandler1)







app.listen(port,()=>{
    console.log("server is running on port 3000")
})
