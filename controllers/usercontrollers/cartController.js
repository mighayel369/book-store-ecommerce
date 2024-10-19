let usermodel=require('../../models/userdetails')
let mongoose=require('mongoose')
let product=require('../../models/productdetails')

module.exports={
    getCart:async(req,res)=>{
if(!req.session.userId){
    return res.redirect('/login')
}
        try{
            let {search=''}=req.query
           let userId=req.session.userId
           let id= new mongoose.Types.ObjectId(`${userId}`)
           let cartData=await usermodel.aggregate([
            { $match: { _id:id } },
            { $unwind: '$cart' },
            {
                $lookup: {
                    from: 'productdetails',
                    localField: 'cart.productId',
                    foreignField: '_id',
                    as: 'productData'
                }
            },
            { $unwind: '$productData' },
            {
                $lookup: {
                    from: 'categorydetails',
                    localField: 'productData.productcategory',
                    foreignField: '_id',
                    as: 'categoryData'
                }
            },
            { $unwind: '$categoryData' },
            {
                $project: {
                    _id: 0,
                    image:'$productData.image',
                    productId:'$productData._id',
                    productname: '$productData.productname',
                    productprice: '$productData.productprice',
                    categoryname: '$categoryData.categoryname',
                    quantity: '$cart.quantity',
                    stock:'$productData.stockqty',
                    offer:'$productData.offer',
                    discountPrice:'$productData.discountPrice',
                    categoryOffer:'$categoryData.offer',
                    discountSource:'$productData.discountSource'
                }
            }
           ])
           let users=await usermodel.findById(userId)
           res.render('users/cart',{cartData,users,search})
            }
            catch(error){
            console.log(error)
        }
    },
    addToCart: async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({message:"user not authenticated"})
            }
            let userId = req.session.userId;
            let productId = req.body.productId;
    
            const users = await usermodel.findById(userId).populate('cart.productId');
            let Product = await product.findById(productId);
            let productCart = users.cart.find(item => item.productId._id.toString() === productId);
    
            if (Product.stockqty > 0) {
                if (productCart) {
                    if (productCart.quantity <= 3 &&Product.stockqty<=productCart.quantity) {
                        productCart.quantity += 1;
                        productCart.userStock+=1
                        await Product.save();
                        await users.save();
                        res.status(200).json({ message: 'Product added successfully' });
                    } else {
                        res.status(409).json({ message: 'product already in the cart' });
                    }
                } else {
                    users.cart.push({
                        productId: productId,
                        quantity: 1,
                        userStock:1
                    });
       
                    await Product.save();
                    await users.save();
                    res.status(200).json({ message: 'Product added successfully' });
                }
            } else {
                res.status(409).json({ message: 'Out of stock' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },
    
    changeQuantity: async (req, res) => {
        try {
            const productId = req.body.productId;  
            const newQuantity = req.body.newQuantity;
    
            const user = await usermodel.findById(req.session.userId).populate('cart.productId');
            if (!user) {
                return res.status(404).json({ errorMessage: "User not found" });
            }
    
            const cartProduct = user.cart.find(item => item.productId._id.toString() === productId);
            if (!cartProduct) {
                return res.status(404).json({ errorMessage: "Product not found in cart" });
            }

            const Product = await product.findById(productId).populate('productcategory')  
            if (!Product) {
                return res.status(404).json({ errorMessage: "Product not found" });
            }
     
            console.log(Product.stockqty)
            console.log(newQuantity)
           if (Product.stockqty<newQuantity) {
                console.log("Out of stock");
                return res.status(409).json({ errorMessage: "Out Of Stock" });
            }
    
            if (cartProduct && newQuantity <= 4) {
                cartProduct.quantity = newQuantity;
                cartProduct.userStock = newQuantity;
                await user.save();
                
                let subtotal;
                if (Product.offer.isOfferActive||Product.productcategory.offer.isOfferActive) {
                    subtotal = Product.discountPrice * newQuantity;
                } else {
                    subtotal = Product.productprice * newQuantity;
                }
                await Product.save();
    
                res.status(200).json({subtotal: subtotal });
            } else {
                console.log("User Limit Reached");
                res.status(409).json({ errorMessage: "User Limit Reached" });
            }
    
        } catch (error) {
            console.error('Error changing quantity:', error);
            res.status(500).json({ errorMessage: 'Internal Server Error' });
        }
    }
    ,
     deleteProduct:async(req,res)=>{
        try {
            let productId = req.params.id;
            let userId = req.session.userId;
            const user = await usermodel.findById(userId).populate('cart')
            const cartItem = user.cart.find(item => item.productId.toString() === productId)
            if(cartItem){
            await usermodel.findByIdAndUpdate(
                userId,
                { $pull: { cart: { productId: productId } } }
            );
            user.save()
            res.redirect('/cart')
           }else{
            console.log('product not found')
           }
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    },
    getCartTotal:async (req,res)=>{
        try{
            let user = await usermodel.findById(req.session.userId).populate({ path: 'cart.productId', populate: {  path: 'productcategory',model: 'categorydetails'}});
            let cartTotal=0;
            user.cart.forEach(item=>{
                cartTotal+=item.productId.offer.isOfferActive||item.productId.productcategory.offer.isOfferActive?item.productId.discountPrice*item.quantity:item.productId.productprice*item.quantity
            })
            res.json({totalprice:cartTotal})
        }catch(error){
            console.log(error)
        }
    }
}