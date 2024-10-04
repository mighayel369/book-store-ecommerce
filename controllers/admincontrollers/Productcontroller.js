let productmodel=require('../../models/productdetails')
let categorymodel=require('../../models/categorydetails')
const {check,validationResult } = require('express-validator');
let fs=require('fs')
const path = require('path');

module.exports = {



  addProduct:
     async (req, res) => {
    try {
      let productfile = req.files;
      let { productname, productdescription, productcategory, productprice, stockqty } = req.body;
  
      let category = await categorymodel.findOne({ categoryname: productcategory });
  
      const new_images = [
        productfile['cover_image'][0].filename,
        productfile['image1'][0].filename,
        productfile['image2'][0].filename
      ];
  
      let newProduct = {
        productname,
        productdescription,
        stockqty,
        image: new_images,
        productcategory: category._id,
        productprice,
      };
  
      let product = await productmodel(newProduct);
      await product.save();
  
      req.session.adminmessage = {
        type: "success",
        message: "Product added successfully"
      };
  
      res.json({
        success: true,
        message: "Product added successfully"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "An error occurred while adding the product"
      });
    }
  },
  



    getProducts:async (req,res)=>{
        try{
        let products=await productmodel.find().populate('productcategory')
        res.render('admin/adminProducts',{products})
        }catch(error){
            res.send('internal server error')
        }
    },

    getAddProduct:async (req,res)=>{
        try{
            let availableCategory=await categorymodel.find({},{categoryname:1})
            res.render('admin/addProduct',{availableCategory})
        }catch(error){
            res.send('Internal server error')
        }
    },

    getEditProduct:async (req,res)=>{
        try{
        let id=req.params.id
        let productdata=await productmodel.findById(id)
        let availableCategory=await categorymodel.find({},{categoryname:1})
        res.render('admin/editProduct',{productdata,availableCategory})
        }catch(error){
            res.send('Internal Server Error')
        }
    },
    postEditProduct: async(req,res)=>{
            try{
                let id=req.params.id
            let {old_image,productcategory,productname,productprice,stockqty,productdescription}=req.body
            let filedata=req.files
            let category=await categorymodel.findOne({categoryname:productcategory})
            const new_images = [
                filedata['cover_image']?.[0]?.filename || old_image[0],
                filedata['image1']?.[0]?.filename || old_image[1],
                filedata['image2']?.[0]?.filename || old_image[2]
              ];
              let productdata={
                productname:productname,
                productdescription:productdescription,
                productcategory:category._id,
                productprice:productprice,
                stockqty:stockqty,
                image:new_images
              }
              let updatedProduct=await productmodel.findByIdAndUpdate(id,productdata,{new:true})
              old_image.forEach((image,index)=>{
                if(image!==new_images[index]){
                    fs.unlinkSync('public/product_images/'+image)
                }
              })
              req.session.adminmessage={
                type:"success",
                message:"Product Updated Successfully"
              }
              res.redirect('/admin/products')

            }catch(error){
                res.send('Internal Server Error')
            }     
        },


        deleteProduct : async (req, res) => {
            try {
              const id = req.params.id;
              const product = await productmodel.findById(id, { image: 1 });
          
              if (!product) {
                req.session.adminmessage = {
                  type: "error",
                  message: "Product not found"
                };
                return res.redirect('/admin/products');
              }
              await productmodel.findByIdAndDelete(id);
              product.image.forEach(image => {
                if (image) {
                  fs.unlinkSync('public/product_images/' + image);
                }
              });
              req.session.adminmessage = {
                type: "success",
                message: "Product Deleted Successfully"
              };
              res.redirect('/admin/products');
            } catch (error) {
                res.send('Internal server error')
          }
        }
}