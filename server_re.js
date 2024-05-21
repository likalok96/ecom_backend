const bodyParser = require("body-parser");
const express = require("express");
const app = express();
const cors = require("cors")
const cookirParser = require("cookie-parser");
const jwt = require("jsonwebtoken")

const port = process.env.PORT || 3001;

app.set('trust_proxy',1)

app.use(cors({ origin: ['https://wnp-ecom.uc.r.appspot.com','https://server-dot-wnp-ecom.uc.r.appspot.com','https://wnp-ecom.com','https://www.wnp-ecom.com','https://stripe.com','http://localhost:3000'], credentials: true
}))

app.use(cookirParser());
app.use(bodyParser.urlencoded({ extended: true}));

const conn = require('./dbConfig')

app.use(express.json());

const {createTokens} = require('./token')

app.post("/refresh",(req,res)=>{
    const refreshToken = req.body.token

    if(!refreshToken||refreshToken==='') {return res.json({Auth: false, Res: req})}

    else{
        jwt.verify(refreshToken,"refreshjwtsecret",(err,result)=>{
            if (err) {
                return res.json({Status: "Auth Expired"})
            } else {

                const accessToken = createTokens(result.user)
                return  res.json({Status: 'Success', Token: accessToken})
                
            }
        })
    }

})



app.get("/api/get", (req,res)=> {
    const sql = "SELECT retaildb.product.product_id as id, product_name as `name`,product_cost as price,brand_name as brand , GROUP_CONCAT(DISTINCT retaildb.category.category_name SEPARATOR ',') as category FROM retaildb.product left join retaildb.belongsto on retaildb.product.product_id = retaildb.belongsto.product_id left join retaildb.category on retaildb.belongsto.category_id = retaildb.category.category_id group by retaildb.product.product_id"
    conn.query(sql,(err,result)=>{
        res.send(result);
    })
});
app.use(require('./stripe'))

app.use('/account',require('./account'))

app.use('/review',require('./review'))

app.listen(port,()=> {
    console.log('listening to port ' + port)
})

