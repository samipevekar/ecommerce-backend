const port = process.env.PORT || 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const session = require("express-session")
const passport = require("passport")
const OAuth2Strategy = require("passport-google-oauth2")
const userdb = require("./GoogleModel/googleSchema")

const clientid = "118920239396-in6o5g07rpdk1o34v863b3ktmd0im3s9.apps.googleusercontent.com"
const clientsecret = "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"

app.use(express.json());    // response data will automatically parsed
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true 
}));      

// Database connection with mongodb
mongoose.connect("mongodb+srv://samipevekar:1234sami@cluster0.47tb6yj.mongodb.net/e-commerce")
.then(() => {
    console.log("MongoDB connected");
})
.catch((error) => {
    console.error("MongoDB connection error:", error);
});



//API Creation

app.get('/',(req,res)=>{
    res.send("hello world")
})

//setup session
app.use(session({
    secret:"12343lksafkkakflla",
    resave:false,
    saveUninitialized:true
}))

//setup passport 
app.use(passport.initialize())
app.use(passport.session())

passport.use(
    new OAuth2Strategy({
        clientID:clientid,
        clientSecret:clientsecret,
        callbackURL:"/auth/google/callback",
        scope:["profile","email"]
    },
    async(accessToken,refreshToken,profile,done)=>{
        console.log(profile)
        try {
            let user = await userdb.findOne({googleId:profile.id})
            if(!user){
                let cart = {}
                for (let i = 0; i < 300; i++) {
                cart[i] = 0;        
    }
                user = new userdb({
                    googleId:profile.id,
                    displayName:profile.displayName,
                    email:profile.email,
                    image:profile.photos[0].value,
                    cartData:cart,
                    refreshToken: refreshToken
                })

                await user.save()
            }

            return done(null,user)

        } catch (error) {
            return done(error,null)
        }
    }
    )
)

passport.serializeUser((user,done)=>{
    done(null,user)
})

passport.deserializeUser((user,done)=>{
    done(null,user)
})

// initial google oauth login
app.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))

app.get("/auth/google/callback",passport.authenticate("google",{
    successRedirect:"http://localhost:3000",
    failureRedirect:"http://localhost:3000"
}))

//get google login data
app.get("/login/success",async(req,res)=>{
    console.log("rewqqqq",req.user)
    if(req.user){
        res.status(200).json({message:"user login",user:req.user})
    }
    else{
        res.status(400).json({message:"not Authorized"})
    }
})

app.get("/logout",(req,res,next)=>{
    req.logOut(function(err){
        if(err){return next(err)}
        res.redirect("localhost:3000")
    })
})

// Image storage engine

const storage = multer.diskStorage({
    destination:"./upload/images",
    filename:(req,file,cb)=>{
        return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage:storage})

// Creating Upload Endpoint for images
app.use("/images",express.static("upload/images"))

app.post("/upload",upload.single('product'),(req,res)=>{
    res.json({
        success:1,
        image_url:`https://ecommerce-backend-ccoa.onrender.com/images/${req.file.filename}`
    })
})

// Schema for creating products

const Product = mongoose.model("Product",{
    id:{
        type:Number,
        required:true
    },
    name:{
        type:String,
        required:true
    },
    image:{
        type:String,
        required:true
    },
    category:{
        type:String,
        required:true
    },
    new_price:{
        type:Number,
        required:true
    },
    old_price:{
        type:Number,
        required:true
    },
    date:{
        type:Date,
        default:Date.now()
    },
    available:{
        type:Boolean,
        default:true
    }
})

app.post('/addproduct',async(req,res)=>{
    let products = await Product.find({});
    let id;
    if(products.length>0){
        let last_product_array = products.slice(-1)
        let last_product = last_product_array[0]
        id = last_product.id+1
        
    }
    else{
        id = 1
    }
    const product = new Product({
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price        
    })
    console.log(product);
    await product.save()
    console.log("saved")
    res.json({
        success:true,
        name:req.body.name
    })
})

// Creating API for deleting Products

app.post('/removeproduct',async(req,res)=>{
    await Product.findOneAndDelete({id:req.body.id})
    console.log("removed")
    res.json({
        success:true,
        name:req.body.name    })
})

// Creating API for getting all products
app.get('/allproducts',async(req,res)=>{
    let products =await Product.find({})
    console.log("all products fetched")
    res.send(products)

    
})

//Schema creation for user model

const Users = mongoose.model("Users",{
    name:{
        type:String,
    },
    email:{
        type:String,
        unique:true,
    },
    password:{
        type:String,
    },
    cartData:{
        type:Object
    },
    date:{
        type:Date,
        default:Date.now
    }
})

//creating endpoint for registering the user

app.post("/signup",async(req,res)=>{
    let check = await Users.findOne({email:req.body.email})
    if(check){
        return res.status(400).json({success:false,errors:"existing user found with same email address"})
    }
    let cart = {}
    for (let i = 0; i < 300; i++) {
        cart[i] = 0;        
    }

    const user = new Users({
        name:req.body.name,
        email:req.body.email,
        password:req.body.password,
        cartData:cart,
    })

    await user.save()

    const data = {
        user:{
            id:user.id,
        }
    }

    const token = jwt.sign(data,'secret_ecom')
    res.json({success:true,token})

})

// creating endpoint for user login 
app.post('/login',async(req,res)=>{
    let user = await Users.findOne({email:req.body.email})
    if(user){
        const passCompare = req.body.password === user.password
        if(passCompare){
            const data = {
                user:{
                    id:user.id
                }
            }
            const token = jwt.sign(data,"secret_ecom")
            res.json({success:true,token})
        }
        else{
            res.json({success:false,errors:"Wrong Password"})
        }

    }
    else{
        res.json({success:false,errors:"Wrong Email Id"})
    }
})






//creating endpoint for newcollection data
app.get("/newcollections", async (req, res) => {
    try {
        let products = await Product.find({});
        let newcollection = products.slice(1).slice(-8);
        console.log("NewCollection fetched");
        res.send(newcollection);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

//creating endpoint for popular in women section
app.get("/popularinwomen",async(req,res)=>{
    let products = await Product.find({category:"women"})
    let popular_in_women = products.slice(1).slice(0,4)
    console.log("popular in women fetched")
    res.send(popular_in_women)
})

// creating middleware to fetch user
const fetchUser = async(req,res,next)=>{
    const token = req.header("auth-token")
    if(!token){
        res.status(401).send({errors:"Pleasen authenticate using valid token"})
    }
    else{
        try {
            const data = jwt.verify(token,'secret_ecom')
            req.user = data.user
            next()
        } catch (error) {
            res.status(401).send({errors:"please authenticate using a valid token"})
        }
    }
}

// fetching signup data for frontend
app.get('/userdata',fetchUser, async (req, res) => {
    try {
        const userId = req.user.id; 
        const userData = await Users.findById(userId,{name:1,email:1}); 
        res.json(userData); 
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});


//creating endpoint for adding products in cartdata
app.post("/addtocart",fetchUser,async(req,res)=>{
    console.log("added",req.body.itemId)
    let userData = await Users.findOne({_id:req.user.id})
    userData.cartData[req.body.itemId] += 1
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData})
    res.send("Added")
})

//creating endpoint to remove product form cartdata
app.post("/removefromcart",fetchUser,async(req,res)=>{
    console.log("removed",req.body.itemId)
    let userData = await Users.findOne({_id:req.user.id})
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId] -= 1
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData})
    res.send("Added")
})

//creating endpoint to get cartdata
app.post("/getcart",fetchUser,async(req,res)=>{
    console.log("getCart")
    let userData = await Users.findOne({_id:req.user.id})
    res.json(userData.cartData)
})

app.listen(port,()=>{
    console.log("server is listening on port " + port)
})

