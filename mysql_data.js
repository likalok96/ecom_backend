const bodyParser = require("body-parser");
const express = require("express");
const app = express();
const mysql = require('mysql2')
const cors = require("cors")

const stripe_sql = require('./stripe_sql')

const cookirParser = require("cookie-parser");
const jwt = require("jsonwebtoken")

const port = process.env.PORT || 3001;


app.set('trust_proxy',1)

app.use(cors({ origin: ['https://wnp-ecom.uc.r.appspot.com','https://server-dot-wnp-ecom.uc.r.appspot.com','https://wnp-ecom.com','https://www.wnp-ecom.com','https://stripe.com','http://localhost:3000'], credentials: true
}))

app.use(cookirParser());
app.use(bodyParser.urlencoded({ extended: true}));

const baseUrl = process.env.NODE_ENV ==='production' ?'https://wnp-ecom.uc.r.appspot.com':'http://localhost:3000'


const conn_prd = mysql.createPool({
    socketPath: process.env.SOCKET_PATH,

    user: "lipper",
    password: "k0082468",
    database: "retaildb"
})

const conn_dev = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "kP0082468",

    database: "retaildb"
})

const conn = process.env.NODE_ENV ==='production' ? conn_prd : conn_dev

const endpointSecret = process.env.NODE_ENV ==='production' ? 'whsec_ti1aBw3M7n4KpZQxFoqiQVwMZzxXkzgX' : 'whsec_0a68900530084265af66867ecd4d24f9c13c9789b154adf191baa0b22d9fbf71'


app.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    console.log('verifty')
  } catch (err) {
    console.log(err.message)
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
  let session;


  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object;
      // Then define and call a function to handle the event payment_intent.succeeded
      break;
    // ... handle other event types
    case 'checkout.session.completed':
        session = event.data.object;
        stripe_sql.sql_order(session, conn, stripe)

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  response.send();
});

app.get("/checkout/session/:session_id",async (req,res)=>{
    const {session_id} = req.params;
    const session = await stripe.checkout.sessions.retrieve(session_id,{expand:['total_details.breakdown']});

    res.send(session);
})

app.get("/checkout/item/:session_id",async (req,res)=>{
    const {session_id} = req.params;
    const lineItems =  await stripe.checkout.sessions.listLineItems(session_id,{expand: ['data.price.product']},(err, lineItems)=>{
        res.send(lineItems);
    });

    
})

app.use(express.json());

const createTokens = (user) =>{
    const accessToken = jwt.sign({user},
        "jwtsecret",
        { expiresIn: 10}
    );
    return accessToken;
}

const createRefreshTokens = (user) =>{
    const accessToken = jwt.sign({user},
        "refreshjwtsecret",
        { expiresIn: 60 * 60}
    );
    return accessToken;
}

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


  
app.post("/create-checkout-session",validateToken , async (req, res) => {
    let total = 0;
    req.body.items.map(item => {
        total += item.quantity*item.price
    });

    let shipping_rate_id_dev = total>=300 ? 'shr_1NiXssC7JN2n5AToqKBMnyCh' : 'shr_1NiXENC7JN2n5ATosjRZyFLU'
    let shipping_rate_id_prd = total>=300 ? 'shr_1ObgFQC7JN2n5ATosmsNXy2k' : 'shr_1ObgEtC7JN2n5ATo6eRCdXNy'
    let shipping_rate_id = process.env.NODE_ENV=='production'? shipping_rate_id_prd :shipping_rate_id_dev
    try{



        const session = await stripe.checkout.sessions.create({
            
            mode: 'payment',
            payment_method_types: ["card"],
            
            line_items: req.body.items.map(item => {
                return{
                    
                    price_data: {

                        product_data:{
                            metadata: {prd_id: item.id},
                            name: item.name,
                            images: [item.image]
                        },
                        unit_amount: Number(item.price.replace('.','')),
                        currency: "hkd",
                        
                    },
                     
                    quantity: item.quantity
                }
            }),

              mode: 'payment',
           
            success_url: `${baseUrl}/success/{CHECKOUT_SESSION_ID}`,
            billing_address_collection: 'required',
            shipping_address_collection: {allowed_countries:['HK']},
            shipping_options: [{shipping_rate: shipping_rate_id}],
            allow_promotion_codes: true,
            metadata:{customer_id: req.user.id}

        })
      
        res.json({url: session.url})

        } catch (e) {
            res.status(400).json({error: e.massage})
        }
 
    });

app.get("/api/get", (req,res)=> {
//    const sql = "SELECT product_id as id, product_name as `name`,product_cost as price,brand_name as brand FROM retaildb.product LIMIT 10"
    const sql = "SELECT retaildb.product.product_id as id, product_name as `name`,product_cost as price,brand_name as brand , GROUP_CONCAT(DISTINCT retaildb.category.category_name SEPARATOR ',') as category FROM retaildb.product left join retaildb.belongsto on retaildb.product.product_id = retaildb.belongsto.product_id left join retaildb.category on retaildb.belongsto.category_id = retaildb.category.category_id group by retaildb.product.product_id"
    conn.query(sql,(err,result)=>{
        res.send(result);
    })
});

app.post("/account", validateToken, (req, res)=>{
    res.json({Status: "Success", name: req.user.name, id: req.user.id});
})

app.post("/account/order", validateToken, (req, res)=>{
    const sql = "SELECT * FROM retaildb.order_table WHERE Unique_id = ?"
    conn.query(sql, [req.user.id],(err,result)=>{
        if (err) return res.json(err);
        if (result.length >= 0){
            res.send(result);
        }

    })
})

app.post("/account/order/:order_id", validateToken, (req, res)=>{
    const {order_id} = req.params;
    const sql = "SELECT retaildb.items_purchased.Product_id as id, product_name as name, product_cost as price,brand_name as brand,Quantity as quantity FROM retaildb.items_purchased left join retaildb.product on  retaildb.items_purchased.Product_id = retaildb.product.product_id Where Order_id = ?;"
    conn.query(sql, [order_id],(err,result)=>{
        if (err) return res.json(err);
        if (result.length > 0){
            res.send(result);
        }

    })
})

app.put("/account/profile/update", validateToken, (req, res)=>{
    const sql = "UPDATE retaildb.user SET ? WHERE id = ?;"
    conn.query(sql, [req.body.profile,req.body.profile.id],(err,result)=>{
        if (err){ return res.json(err)
        }else{
            res.json(result);
        }

    })
})

app.post("/account/profile", validateToken, (req, res)=>{
    const sql = "SELECT * FROM retaildb.user WHERE id = ?"
    conn.query(sql, [req.user.id],(err,result)=>{
        if (err) return res.json(err);
        if (result.length > 0){
            res.send(result);
        }

    })
})

app.post("/account/google", (req, res)=>{
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

app.post("/account/signup",(req,res)=>{
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

app.post("/review",(req,res)=>{
    const now = new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' ')
    const sql = `INSERT IGNORE INTO retaildb.review(name, email, score, title, content, date, product_id) values ('${req.body.name}','${req.body.email} ' ,${req.body.score}, '${req.body.title}', '${req.body.content}', '${now}', ${req.body.product_id})`

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

app.get("/review",(req,res)=>{
    const sql = 'Select *,Sum(score) over (order by id desc) as score_acum from retaildb.review'

    conn.query(sql,(err,result)=>{
        if (err) {
            return res.json(err)
        } else {
            return res.json(result)
        }
    })
})

app.post("/account/login",(req,res)=>{
    const sql = "SELECT id, Name as `name` FROM retaildb.user WHERE Name = ? AND Password = ?"
    conn.query(sql, [req.body.name, req.body.password],(err,result)=>{
        if (err) return res.json(err);
        if (result.length > 0){

            const refreshToken = createRefreshTokens(result[0])
            const accessToken = createTokens(result[0]) 

            return res.json({Status: 'Success', Token: refreshToken, accessToken: accessToken})
        } else {
            return res.json({Message: "No Record"})
        }
    })
})

app.get("/account/logout",(req,res)=>{
    res.clearCookie('access-token',{
        maxAge: 60 * 60 * 24 * 30 * 1000,
        sameSite: 'None',
        secure: true,
        path: '/',
        httpOnly: false
    });
    return res.json({Status: "Success"})
})

app.listen(port,()=> {
    console.log('listening to port ' + port)
})

