const jwt = require("jsonwebtoken")

const validateToken = (req, res ,next) => {
    const accessToken = req.body.token
    console.log(req.body)

    if(!accessToken||accessToken==='') {return res.status(401).json({Auth: false, Res: req})}

    else{
        jwt.verify(accessToken,"jwtsecret",(err,result)=>{
            if (err) {
                return res.status(401).json({Message: "Auth failed"})
            } else {
                req.user = result.user;

                next();
            }
        })
}
}

module.exports = validateToken;

