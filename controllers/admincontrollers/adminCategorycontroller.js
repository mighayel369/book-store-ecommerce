let categorymodel=require('../../models/categorydetails')
const {ObjectId} = require('mongodb')
const {check,validationResult } = require('express-validator');
const fs=require('fs')
module.exports={
    addCategory:[check('categoryname').notEmpty().withMessage('Please fill out all fields'),
      check('categorydescription').notEmpty().withMessage('Please fill out all fields'), async(req,res)=>{
           try{ 
            const errors= validationResult(req)
            if (!errors.isEmpty()) {
              const errorMessage = errors.array()[0].msg;
              req.session.adminmessage={message:errorMessage}
              return res.redirect('/admin/addcategory');
            }
            let {categoryname,categorydescription}=req.body
            let filename=req.file.filename
            let category={
                categoryname,
                categorydescription,
                image:filename
            }
            let newcategory=await categorymodel(category)
            await newcategory.save()
            req.session.adminmessage={
              type:"success",
              message:"Category added successfully"
            }
            res.redirect('/admin/category')
          }catch(error){
            res.send('Internal server error')
          }
        }],
        getAllcategory :async (req,res)=>{
          try{
          let category=await categorymodel.find()
          res.render('admin/adminCategory',{category})
          }catch(error){
            res.send('internal server error')
          }
        },

        getEditCategory:async (req,res)=>{
          try{
          let id=req.params.id
          let categorydata=await categorymodel.findById(id)
          res.render('admin/editCategory',{categorydata})
          }catch(error){
            res.send('internal server error')
          }
        },

        postEditCategory:async(req,res)=>{
            try{
              let id=req.params.id
              let {categoryname,categorydescription,old_image}=req.body
              let file=req.file
              let new_image=''
              if(file){
                new_image=file.filename
                fs.unlinkSync('public/category_images/'+old_image)
              }else{
                new_image=old_image
              }
              let newdata={
                categoryname,
                categorydescription,
                image:new_image
              }
            const categorydata = await categorymodel.findByIdAndUpdate(id, newdata, { new: true });

              req.session.adminmessage={
                type:"success",
                message:"Category edited successfully"
              }
              res.redirect('/admin/category')
            }catch(error){
              res.send('internal error')
            }
          },



          deleteCategory:async (req,res)=>{
            try{
              let id=req.params.id
            let category=await categorymodel.findByIdAndDelete(id)
            if(category.image!=''){
              fs.unlinkSync('public/category_images/'+category.image)
            }
            req.session.adminmessage={
              type:"danger",
              message:"Category deleted Successfully"
            }
            res.redirect('/admin/category')
          }catch(error){
            res.send('internal server error')
          }
        },


        getCategoryname:()=>{
          return new Promise(async(resolve,reject)=>{
            try{
              let categoryname=await categorymodel.find({},{categoryname:1})
            resolve(categoryname)
            }catch(error){
              console.log('no category found')
            }
          })
        }
}