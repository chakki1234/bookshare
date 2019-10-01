const express = require(`express`),
      app = express(),
      body = require(`body-parser`),
      request = require(`request`),
      session = require(`express-session`),
      flash = require(`connect-flash`),
      passport = require(`passport`),
      localStrategy = require(`passport-local`),
      passportlocalmongoose = require(`passport-local-mongoose`),
      mongoose = require(`mongoose`),
      multer = require(`multer`),
      path = require(`path`);
      
mongoose.connect(`mongodb://localhost:27017/bookshare`, { useNewUrlParser: true });

const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb)=>{
    cb(null,`${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits:{fileSize: 1000000},
  fileFilter: function(req, file, cb){
    checkFileType(file, cb);
  }
}).single('pic');

function checkFileType(file, cb){
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if(mimetype && extname){
    cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
}

function loggedin(req, res, next){
  if(req.isAuthenticated()){
    next();
   } else {
     req.flash(`error`, `Please login first`);
     res.redirect(`/login`); 
    }
  }

let lendSchema = new mongoose.Schema({
      lendernm: String,
      btitle: String,
      bdes: String,
      brdate: String,
      picpath: String,
      status: String,
      returnstatus: String,
      takenby: String
});
let Lend = mongoose.model(`Lend`, lendSchema);

let borrowSchema = mongoose.Schema({
lendername: String,
borrowername: String,
booktitle: String,
borrowstatus: String,
collectedstatus: String,
returnstatus: String,
picpath: String,
lenderbookid: String
});
let Borrow = mongoose.model(`Borrow`, borrowSchema);

let borrowreqrecSchema = mongoose.Schema({
  lendername: String,
  borrowername: String,
  booktitle: String,
  borrowstatus: String,
  collectedstatus: String,
  returnstatus: String,
  picpath: String,
  lenderbookid: String,
  hide: String
  });
let Borrowreqrec = mongoose.model(`Borrowreqrec`, borrowreqrecSchema);

let UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    hostel: String,
    year: Number,
    mnum: Number,
    location: {
        lng: Number,
        lat: Number
    },
    lend:[{
      type: mongoose.Schema.Types.ObjectId,
      ref: `Lend`
    }],
    borrow: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Borrow'
    }],
    borrowreqrec: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: `Borrowreqrec`
    }]
});
UserSchema.plugin(passportlocalmongoose);
let User = mongoose.model(`User`, UserSchema);

app.use(express.json());
app.use(express.text());
app.use(express.static('public'));
app.use(body.urlencoded({ extended: true }));
app.use(flash());
app.use(session({ 
    secret: "nothing",
    resave: false,
    saveUninitialized: false
 }));
 app.use(passport.initialize());
 app.use(passport.session());
 passport.use(new localStrategy( User.authenticate()));
 passport.serializeUser(User.serializeUser());
 passport.deserializeUser(User.deserializeUser());

 app.get('/', (req, res)=>{
 let title = 'SignUp';     
 res.render(`signup.ejs`, { title: title ,msg: req.flash(`logout`), msg2: req.flash(`userexsist`)});
 });

 app.post(`/signup`, (req, res)=>{ 
console.log(req.body);
 User.register( new User({ username: req.body.username,  hostel: req.body.hostel, year: req.body.year, mnum: req.body.mnumber, location: { lng: 0, lat: 0 }}),req.body.password, (err, added)=>{
 if(err){
    console.log(err);
    req.flash('userexsist', `${err.message}`);
    res.redirect(`/`); 
}
else
    passport.authenticate(`local`)(req, res, function(){
    req.flash(`logged`, `We are glad to have you ${req.user.username}`);
    res.redirect('/dashboard');
 });
 });
 });

app.get(`/login`, (req, res)=>{
let title = 'Login';
res.render(`login.ejs`, { title: title , msg: req.flash(`error`) });
});

app.post('/login', function(req, res) {
    passport.authenticate('local', function(err, user, info) {
      if (err)
       { console.log(err) }
      if (!user) 
      {  req.flash(`error`, `Invalid credentials`);
       return res.redirect('/login'); }
      req.logIn(user, function(err) {
        if (err) 
        { console.log(err); }
        req.flash(`logged`, `Welcome back ${req.user.username}`);
        return res.redirect('/dashboard');
      });
    })(req, res);
  });


app.get('/dashboard', loggedin, (req, res)=>{
let title = 'Dashboard';
res.render(`dashboard.ejs`, { title: title, msg : req.flash('logged'), user: req.user.username });
});

app.get(`/logout`, (req, res)=>{
req.logOut();
req.flash(`logout`, `You are logged out`);
res.redirect(`/`);
});

app.get(`/lend`, loggedin, (req, res)=>{
let title = 'Lend';   
res.render(`lend.ejs`, { title: title , msg: req.flash(`error`), msg2: req.flash(`posted`),  user: req.user.username });
});

app.post('/lenddetails', (req, res) => {
   upload(req, res, (err) => {
    if(err){
      console.log(err);
    } else {
    
    if(req.file){
    Lend.create({ lendernm: req.user.username, btitle: req.body.title, bdes: req.body.description, brdate: req.body.datee, picpath: `/uploads/${req.file.filename}`,status: `pending`,  takenby: `unknown`,  returnstatus: 'notreturned' }, (err, added)=>{ 
    User.findOne({ username: req.user.username }).populate(`lend`).exec((err, found)=>{
    found.lend.push(added);
    found.save();     
     });
    });
  } else  {
    Lend.create({ lendernm: req.user.username, btitle: req.body.title, bdes: req.body.description, brdate: req.body.datee, status: `pending`, takenby: `unknown`, returnstatus: 'notreturned' }, (err, added)=>{ 
      User.findOne({ username: req.user.username }).populate(`lend`).exec((err, found)=>{
      found.lend.push(added);
      found.save();     
       });
      });
 } 
    req.flash(`posted`, `Thank You, the information has been posted`);
    res.redirect('/lend');
}
  });
});

app.get(`/borrow`, loggedin, (req, res)=>{
let title ='Borrow';
res.render(`borrow.ejs`, { title: title , user: req.user.username});
});

app.post(`/ldetails`, (req, res)=>{
Lend.find({}, (err, found)=>{
console.log(found);
res.send(JSON.stringify(found));
});
});

app.get(`/borrowreq/:id`, loggedin, (req, res)=>{
let title = 'Borrowreq';
Lend.findOne({ _id: req.params.id }, (err, found)=>{
res.render(`borrowreq.ejs`, { title: title, book: found, user: req.user.username });
});
});

app.post(`/reqborrow/details`, (req, res)=>{
Lend.findById(req.body.id, (err, found)=>{
  if(err)
  console.log(err);
else
  console.log(found);
User.findOne({ username: found.lendernm }).populate(`borrowreqrec`).exec((err, give)=>{
res.send(JSON.stringify(give));
});
});
});

app.post(`/requser`, (req, res)=>{
User.findOne({ username: req.body.username }, (err, found)=>{
if(found)
res.send(`notok`);
else
res.send(`ok`)
});
});

app.post(`/addborrow`, (req, res)=>{
console.log(`running addborrow`);

User.findOne({ username: req.body.lendername}).populate(`borrowreqrec`).exec((err, found)=>{
Borrowreqrec.create({ lendername: req.body.lendername, borrowername: req.body.borrowname, booktitle: req.body.booktitle, borrowstatus: `pending`, returnstatus: `notreturn`, picpath: req.body.picpath, lenderbookid: req.body.lenderbookid, collectedstatus:'notcollected', hide: `false` }, (err, created)=>{
found.borrowreqrec.push(created);
found.save();
});
});

User.findOne({ username: req.body.borrowname}).populate(`borrow`).exec((err, found)=>{
  Borrow.create({ lendername: req.body.lendername, borrowername: req.body.borrowname, booktitle: req.body.booktitle, borrowstatus: `pending`, returnstatus: `notreturn`, picpath: req.body.picpath,  lenderbookid: req.body.lenderbookid, collectedstatus:'notcollected' }, (err, created)=>{
  found.borrow.push(created);
  found.save();
  });
  });
  res.send('done');
});

app.post(`/usernotifyborrow`, (req, res)=>{
User.findOne({ username: req.body.user }).populate(`borrow`).exec((err, found)=>{
res.send(JSON.stringify(found));
console.log(found);
});
});

app.post(`/usernotifyborrowreqrec`, (req, res)=>{
  User.findOne({ username: req.body.user }).populate(`borrowreqrec`).exec((err, found)=>{
    res.send(JSON.stringify(found));
    });
});

app.get(`/del/:id/:lendername/:borrower`, (req, res)=>{
User.findOne({ username: req.params.lendername }).populate('borrowreqrec').exec((err, found)=>{
  for(let i=0;i<found.borrowreqrec.length;++i){
     if(found.borrowreqrec[i].lenderbookid==`${req.params.id}`&&found.borrowreqrec[i].borrowername==`${req.params.borrower}`){
       Borrowreqrec.findByIdAndUpdate(found.borrowreqrec[i]._id, {$set:{ borrowstatus: `approved` }}, (err, updated)=>{
       });
     }
   }
});

User.findOne({ username: req.params.borrower }).populate(`borrow`).exec((err, found)=>{
for(let i=0; i< found.borrow.length;++i){
  if(found.borrow[i].lenderbookid==`${req.params.id}`){
    Borrow.findByIdAndUpdate(found.borrow[i]._id, {$set:{ borrowstatus: 'approved' }}, (err, updated)=>{
    });
  }
}
});

Lend.findByIdAndUpdate(req.params.id, {$set:{ status: `taken` , takenby: req.params.borrower}}, (err, updated)=>{
});
res.redirect(`/dashboard`);
});

app.post(`/findinfolend`, (req, res)=>{
Lend.findOne({ _id: req.body.id }, (err, found)=>{
res.send(JSON.stringify(found));
});
});

app.post(`/updatecollstatus`, (req, res)=>{
Borrow.update({ lenderbookid: req.body.bookid, lendername: req.body.lendername, borrowername: req.user.username }, { $set:{ collectedstatus: 'collected' } }, (err)=>{
});
Borrowreqrec.update({ lenderbookid: req.body.bookid, lendername: req.body.lendername, borrowername: req.user.username }, { $set:{ collectedstatus: 'collected' } }, (err)=>{
});
res.send(`microsoft`);
});

app.post(`/updatereturnstatus`, (req, res)=>{
  Lend.findOne({ _id: req.body.bookid }, (err, found)=>{
    console.log(found);
    Borrow.update({ lenderbookid: req.body.bookid, lendername: found.lendernm, borrowername: found.takenby }, { $set:{ returnstatus: 'returned' }}, (err)=>{
      if(err)
      console.log(err);
    });
    Borrowreqrec.update({ lenderbookid: req.body.bookid, lendername: found.lendernm, borrowername: found.takenby }, { $set:{ returnstatus: 'returned' }}, (err)=>{
      if(err)
      console.log(err);
    });
    Lend.update({ _id: req.body.bookid }, { $set: { returnstatus: 'returned' } }, (err)=>{
      if(err)
      console.log(err);
    });
  });
  res.send(`google`);
});

app.get(`/dellend/:id`, (req, res)=>{
Lend.remove({ _id: req.params.id }, (err, removed)=>{
console.log(removed);
res.redirect('/borrow');
});
});

app.post(`/getlendbytitle`, (req, res)=>{
console.log(`====`);
console.log(`oracle`);
console.log(req.body.title);
Lend.find({ btitle: req.body.title }, (err, found)=>{
console.log(found);
console.log(`====`);  
if(found.length==0)
res.send(`null`);
else
res.send(JSON.stringify(found));
});
});

app.post(`/userdetbyname`, (req, res)=>{
  console.log(`michigan`);
User.findOne({ username: req.body.username }, (err, found)=>{
console.log(found);
res.send(JSON.stringify(found));
});
});

app.post(`/getmbno`, (req, res)=>{
console.log(`googleplex`);
User.find({ mnum: Number(req.body.mnum)}, (err, found)=>{
if(found.length>0)
res.send('notok');
else
res.send(`ok`);
});
});

app.get(`/giveaccessloc`, loggedin,  (req, res)=>{
res.render(`location.ejs`, { title: 'location', user: req.user.username });
});

app.post(`/updatelocation`, (req, res)=>{
console.log(`facebook`);
User.update({ username: req.user.username }, {$set:{ location: { lng: Number(req.body.lng), lat: Number(req.body.lat) }}}, (err)=>{
  if(err)
  console.log(err);
});
});

app.get(`/updatehide/:id`, (req,res)=>{
Borrowreqrec.update({ _id: req.params.id }, {$set:{ hide: 'true' }}, (err)=>{
console.log(`done`);
res.send(`done`);
});
});

 app.listen(5000, ()=>{
 console.log(`server started`);
 });

