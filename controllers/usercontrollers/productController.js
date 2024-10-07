let product=require('../../models/productdetails')
let categories=require('../../models/categorydetails')
let usermodel=require('../../models/userdetails')

module.exports={

   getHome:async (req,res)=>{
      let {search=''}=req.query
      let users;
      try{
         if(req.session.userId){
            let {userId}=req.session
            users=await usermodel.findById(userId)
          }else if(req.user){
            users=await usermodel.findById(req.user._id)
            req.session.userId=users._id
          }
          let products=await product.find().populate('productcategory').sort({ popularityScore: -1 }).limit(3)
          let category=await categories.find().limit(4)
          res.render('users/userHome',{products,category,users,search})
      }catch(error){
         res.send('Internal Server Error')
      }
   },

   getProducts: async (req, res) => {
      try {
        let { page = 1, limit = 8, search = '' } = req.query;
        let currentPage = parseInt(page, 10);
        let limitNumber = parseInt(limit, 10);
        let skip = (currentPage - 1) * limitNumber;
        search = search ? search.trim() : '';
    
        let { userId } = req.session;
        let users = await usermodel.findById(userId);
    
        let query = {};
        if (search) {
          query.productname = { $regex: search, $options: 'i' };
        }

        let products = await product.find(query)
          .populate('productcategory')
          .skip(skip)
          .limit(limitNumber)
          .exec();
        let totalProducts = await product.countDocuments(query);
        let totalPages = Math.ceil(totalProducts / limitNumber);
        let category = await categories.find();
        
   
        res.render('users/productsPage', { products, category, users, limit: limitNumber, currentPage, totalPages, search });
      } catch (error) {
        console.log(error);
      }
    },


   getSingleProduct:async (req,res)=>{
      let {search=''}=req.query
      let {userId}=req.session
      var users=await usermodel.findById(userId)
      let id=req.params.id
      let products=await product.findById(id).populate('productcategory')
      let similarProducts=await product.find({productcategory:products.productcategory}).populate('productcategory')
      res.render('users/singleProduct',{products,similarProducts,users,search})
   },


}