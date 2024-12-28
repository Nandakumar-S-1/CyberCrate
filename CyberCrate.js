const express = require('express');
const session = require('express-session');
const mongoStore = require('connect-mongo')
const path = require('path');
const dotenv = require('dotenv');
const db = require('./Config/db');
const adminRoutes = require('./Routes/adminRoutes');
const userRoutes = require('./Routes/userRoutes');
const passport=require('./Config/passport')

dotenv.config();
const app = express();

const port = process.env.PORT || 5005 ;
db()


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'Views'));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'cyberSecret',
    resave: false,  
    saveUninitialized: true,  
    cookie: {
        maxAge: 72*60*60*1000,
        secure: false,  
        httpOnly: true
    },
    store: mongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 72*60*60,  
        autoRemove: 'native'  
    })
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req,res,next)=>{
    res.set('cache-control','no-store');
    next()
})    



app.use(passport.initialize());
app.use(passport.session());



app.use('/admin', adminRoutes);
app.use('/', userRoutes);

app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        console.log(`Admin Server is running at http://localhost:${port}/admin/dashboard`);
});

console.log('Main');


module.exports = app;




