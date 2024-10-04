const notFound = (req, res) => {
    res.status(404).render('users/errorPage', { message: 'Page Not Found' });
};

const errorHandler1 = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('users/errorPage', { message: 'Internal Server Error' });
};

  module.exports={notFound,errorHandler1}
 