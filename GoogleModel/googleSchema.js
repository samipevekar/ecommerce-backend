const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    googleId:String,
    displayName:String,
    email:String,
    image:String,
    cartData:Object,
},{timestamps:true})

const userdb = new mongoose.model("GoogleUsers",userSchema)

module.exports = userdb