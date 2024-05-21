var express = require('express');

var router = express.Router();

const conn = require('./dbConfig')
const {createTokens,createRefreshTokens} = require('./token')
const validateToken = require('./middleware')

//router.use(express.json());

router.post("/login",(req,res)=>{
    const sql = "SELECT id, Name as `name`,EmailID as `email` FROM retaildb.user WHERE Name = ? AND Password = ?"
    conn.query(sql, [req.body.name, req.body.password],(err,result)=>{
        if (err) return res.json(err);
        if (result.length > 0){

            const refreshToken = createRefreshTokens(result[0])
            const accessToken = createTokens(result[0]) 

            return res.json({Status: 'Success', Token: refreshToken, accessToken: accessToken,profile: result[0]})
        } else {
            return res.json({Message: "No Record"})
        }
    })
})

router.get("/logout",(req,res)=>{
    res.clearCookie('access-token',{
        maxAge: 60 * 60 * 24 * 30 * 1000,
        sameSite: 'None',
        secure: true,
        path: '/',
        httpOnly: false
    });
    return res.json({Status: "Success"})
})

router.post("/signup",(req,res)=>{
    const sql = `INSERT IGNORE INTO retaildb.user(Address, Name, EmailID, Password, PhoneNumber) values ('${req.body.address}','${req.body.first_name} ' '${req.body.last_name}', '${req.body.email}', ${req.body.password}, ${req.body.phone_number})`

    conn.query(sql,(err,result)=>{
        if (err) { 
            return res.json(err);
        } else {
            console.log(result)
//            return res.json({Message:'Sign up success'});
            return res.json(result)
        }

    })
})

router.post("/google", (req, res)=>{
    const sql = "SELECT * FROM retaildb.user WHERE EmailID = ?"
    conn.query(sql, [req.body.email],(err,result)=>{
        if (err) return res.json(err);
        if (result.length === 0){
            const sql2 = `INSERT IGNORE INTO retaildb.user(Address, Name, EmailID, Password, PhoneNumber) values (' ','${req.body.given_name} ' '${req.body.family_name}', '${req.body.email}', 0, 0)`

            conn.query(sql2,(err,result)=>{
                if (err) { 
                    return res.json(err);
                } else {
                    console.log(result)
        //            return res.json({Message:'Sign up success'});
                    const refreshToken = createRefreshTokens({'id':result.insertId,'name':`${req.body.given_name} ' '${req.body.family_name}`})
                    const accessToken = createTokens({'id':result.insertId,'name':`${req.body.given_name} ' '${req.body.family_name}`})
                    return res.json({Status: 'Success', Token: refreshToken, accessToken: accessToken})
                }
        
            })
        } else {
            const refreshToken = createRefreshTokens(result[0])
            const accessToken = createTokens(result[0]) 
            return res.json({Status: 'Success', Token: refreshToken, accessToken: accessToken})

        }

    })
})

router.post("/", validateToken, (req, res)=>{
    res.json({Status: "Success", name: req.user.name, id: req.user.id});
})

router.post("/order", validateToken, (req, res)=>{
    const sql = "SELECT * FROM retaildb.order_table WHERE Unique_id = ?"
    conn.query(sql, [req.user.id],(err,result)=>{
        if (err) return res.json(err);
        if (result.length >= 0){
            res.send(result);
        }

    })
})

router.post("/order/:order_id", validateToken, (req, res)=>{
    const {order_id} = req.params;
    const sql = "SELECT retaildb.items_purchased.Product_id as id, product_name as name, product_cost as price,brand_name as brand,Quantity as quantity FROM retaildb.items_purchased left join retaildb.product on  retaildb.items_purchased.Product_id = retaildb.product.product_id Where Order_id = ?;"
    conn.query(sql, [order_id],(err,result)=>{
        if (err) return res.json(err);
        if (result.length > 0){
            res.send(result);
        }

    })
})

router.put("/profile/update", validateToken, (req, res)=>{
    const sql = "UPDATE retaildb.user SET ? WHERE id = ?;"
    conn.query(sql, [req.body.profile,req.body.profile.id],(err,result)=>{
        if (err){ return res.json(err)
        }else{
            res.json(result);
        }

    })
})

router.post("/profile", validateToken, (req, res)=>{
    const sql = "SELECT * FROM retaildb.user WHERE id = ?"
    conn.query(sql, [req.user.id],(err,result)=>{
        if (err) return res.json(err);
        if (result.length > 0){
            res.send(result);
        }

    })
})

module.exports = router;
