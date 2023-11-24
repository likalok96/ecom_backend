const bodyParser = require("body-parser");
const express = require("express");
const app = express();
const mysql = require('mysql2')
const cors = require("cors")

const stripe_sql = require('./stripe')

const cookirParser = require("cookie-parser");
const jwt = require("jsonwebtoken")

const port = process.env.PORT || 3001;

const stripe = require("stripe")('sk_test_51NTkxfC7JN2n5ATo8tyT4WFDqmlOpOWx9L73DNoh2sr7JGybnuvWTNB9szzkurxZqwq4XzHUf1Lf9r6WOdQEWMz700MiZ2s1sc');

app.set('trust_proxy',1)

app.use(cors({ origin: ['https://wnp-ecom.uc.r.appspot.com','https://server-dot-wnp-ecom.uc.r.appspot.com','https://stripe.com','http://localhost:3000'], credentials: true
//, allowedHeaders: 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
}))

//app.use(cors({    origin: "http://localhost:3000"   }));
app.use(cookirParser());
app.use(bodyParser.urlencoded({ extended: true}));

//const baseUrl = 'https://wnp-ecom.uc.r.appspot.com'
const baseUrl = 'http://localhost:3000'


const conn = mysql.createPool({
    host: "localhost",
//    host: '104.197.197.232',
    user: "root",
    password: "0082468",

//    socketPath: process.env.SOCKET_PATH,
//    user: "lipper",
//    password: "k0082468",
//    database: "retaildb"
})


//stripe webhook

// This is your Stripe CLI webhook secret for testing your endpoint locally.
//const endpointSecret = "whsec_MoemJP92RBCPVxWHYVT9bhObl3opL8Ax";
//whsec_pqM4DrNSRlfgKt7o9ih3TyWiYRowkARO
//whsec_vnEOoAaI7mkeHzdORAKWeq1yQ07ycwxP
// local : whsec_0a68900530084265af66867ecd4d24f9c13c9789b154adf191baa0b22d9fbf71
const endpointSecret = "whsec_0a68900530084265af66867ecd4d24f9c13c9789b154adf191baa0b22d9fbf71";

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
        
/* start
        const lineItems =  stripe.checkout.sessions.listLineItems(session.id,{expand: ['data.price.product']},(err, lineItems)=>{
            console.log('line_item: inside' + lineItems.data[0].price.product.metadata.prd_id)
            console.log('line_item: inside price ' + lineItems.data[0].price.unit_amount)
            console.log('line_item: inside quant' + lineItems.data[0].quantity)
        });
//        console.log('line_item: ' + lineItems.data)
        
        //console.log(session)
        let billing_details = session.customer_details.address;
        
        let billing = { payment_method: session.payment_method_types[0],
                        billing_address: Object.values(billing_details).join(' '),
                      }

        const bill_sql = `INSERT IGNORE INTO retaildb.billing_details(payment_mode, billing_address) VALUES ('${billing.payment_method}', '${billing.billing_address}')`
        conn.query(bill_sql,(err,result)=>{
            if (err){ console.log(err)
                }else{
                    console.log(result);
                }

        })

        let billing_id;
        
        const bill_id_sql = `SELECT billing_id FROM retaildb.billing_details WHERE payment_mode = '${billing.payment_method}' AND billing_address = '${billing.billing_address}'`
//promise start
        conn.promise().query(bill_id_sql).then(([rows,fields])=>{
            console.log('billing_id: ' + rows[0].billing_id);
            billing_id = rows[0].billing_id

            let shipiing_details = session.customer_details.address;
            let order_details;
    
            let customer_id;



    
            const customer_id_sql = `SELECT id FROM retaildb.user WHERE Name = '${session.shipping_details.name}'`
//promise loop    
            conn.promise().query(customer_id_sql).then(([rows,fields])=>{
                console.log('customer_id: ' + rows[0].id);
                customer_id = rows[0].id
                console.log('customer_id_real: ' + customer_id);



                order_details = {   Delivery_Address: Object.values(shipiing_details).join(' '),
                                    Shipper_id: 10,
                                    Date_Time: new Date(session.created*1000).toISOString().slice(0, 19).replace('T', ' '),
                                    Unique_id: customer_id,
                                    billing_id: billing_id,
                                    totalCost: session.amount_total/100,
                                    
                                }
//checkout_session for coupon
//                console.log('coupon_id test: '+ coupon_id)

                let coupon_id;
                let percent_off;
                let expire_date;

                const checkout_session = stripe.checkout.sessions.retrieve(session.id,{expand:['total_details.breakdown']})
                .then((result)=>{
                    console.log('checkout_result: ' +result?.total_details?.breakdown?.discounts[0]?.discount?.coupon?.id)
                    coupon_id = result?.total_details?.breakdown?.discounts[0]?.discount?.coupon?.id ?? null
                    percent_off = result?.total_details?.breakdown?.discounts[0]?.discount?.coupon?.percent_off ?? 0
                    expire_date = new Date(session.created*1000).toISOString().slice(0, 10);

                    let coupon_sql = `INSERT INTO retaildb.coupon_data(Coupon_id, Discount, ExpiryDate, Unique_id, isUsed) values ('${coupon_id}', ${percent_off}, '${expire_date}', ${order_details.Unique_id},0)`
                    conn.query(coupon_sql,(err,result)=>{
                        if (err){ console.log(err)
                        }else{
                            console.log('coupon_sql:' +result)
                        }
                    })


                    //promise loop 3rd sql order table                
                    const order_sql = `INSERT INTO retaildb.order_table(Delivery_Address, Shipper_id, Date_Time, Unique_id, billing_id,couponID ) VALUES ('${order_details.Delivery_Address}', ${order_details.Shipper_id}, '${order_details.Date_Time}', ${order_details.Unique_id}, ${order_details.billing_id},'${coupon_id}' )`
    //, ${order_details.totalCost} totalCost
                    conn.promise().query(order_sql).then(([rows,fields])=>{



                        let order_id = rows.insertId


                        

                        let item_sql;
                        let product_id;
                        let cost;
                        let quantity;

                        const lineItems =  stripe.checkout.sessions.listLineItems(session.id,{expand: ['data.price.product']},(err, lineItems)=>{
                            
                            console.log('line_item: inside' + lineItems.data[0].price.product.metadata.prd_id)
                            console.log('line_item: inside price ' + lineItems.data[0].price.unit_amount)
                            console.log('line_item: inside quant' + lineItems.data[0].quantity)
                            
                            let item_data = lineItems.data;
                            item_data.map((item)=>{
                                product_id = item.price.product.metadata.prd_id;
                                quantity = item.quantity
                                cost = quantity * item.price.unit_amount
                                
                                item_sql = `INSERT INTO retaildb.items_purchased(Order_id, Product_ID, Quantity, Cost) values (${order_id}, ${product_id}, ${quantity}, ${cost})`
                                conn.query(item_sql,(err,result)=>{
                                    if (err){ console.log(err)
                                    }else{
                                        console.log(result)
                                    }
                                })
                            })
                            


                        });

                        


                    }).catch(err=>{
                        console.log(err)
                    })
                })

                


//                console.log('order_details: '+ order_details.couponID )
                console.log('order_details: '+ order_details.Unique_id )

   
                })
                .catch(err=>{
                    console.log(err)
                })
        })
        .catch(err=>{
            console.log(err)
        })
end */ 
 /*       
        conn.query(bill_id_sql,(err,result)=>{
            if (err){ console.log(err)
            }else{
                console.log('billing_id: ' + result[0].billing_id);
                billing_id = result[0].billing_id
            }
        })


*/



/*        
        conn.query(customer_id_sql,(err,result)=>{
            if (err){ console.log(err)
            }else{
                console.log('customer_id: ' + result[0].id);
                customer_id = result[0].id
            }
        })



        order_details = { Delivery_Address: Object.values(shipiing_details).join(' '),
                              Shipper_id: 10,
                              Date_Time: session.created,
                              Unique_id: customer_id,
                              billing_id: billing_id,
                              totalCost: session.amount_total/100,
                              couponID: 'a'
                            }
        console.log('order_details: '+ order_details.Unique_id )
        console.log('order_details_not_obj: '+ customer_id )

        const order_sql = `INSERT INTO retaildb.order_table(Delivery_Address, Shipper_id, Date_Time, Unique_id, billing_id, totalCost, couponID)

        VALUES ('${order_details.Delivery_Address}', ${order_details.Shipper_id}, ${order_details.Date_Time}, ${order_details.Unique_id}, 
        ${order_details.billing_id}, ${order_details.totalCost}, ${order_details.couponID} )`

        conn.promise().query(order_sql).then(([rows,fields])=>{
            console.log(rows);
        })
        .catch(err=>{
            console.log(err)
        })
*/
/*        
        conn.query(order_sql,(err,result)=>{
            if (err){ console.log(err)
                }else{
                    console.log(result);
                }

        })
*/
        
        

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  response.send();
});

app.get("/checkout/session/:session_id",async (req,res)=>{
    const {session_id} = req.params;
    const session = await stripe.checkout.sessions.retrieve(session_id,{expand:['total_details.breakdown']});

//    console.log(session.total_details.breakdown.discounts[0].discount.coupon.id)
    res.send(session);
})

app.get("/checkout/item/:session_id",async (req,res)=>{
    const {session_id} = req.params;
    const lineItems =  await stripe.checkout.sessions.listLineItems(session_id,{expand: ['data.price.product']},(err, lineItems)=>{
        console.log('line_item: inside' + lineItems.data[0].price.product.metadata.prd_id)
        console.log('line_item: inside price ' + lineItems.data[0].price.unit_amount)
        console.log('line_item: inside quant' + lineItems.data[0].quantity)
        res.send(lineItems);
    });

    
})

app.use(express.json());

const createTokens = (user) =>{
    const accessToken = jwt.sign({user},
        "jwtsecret"
    );
    return accessToken;
}

const validateToken = (req, res ,next) => {
    const accessToken = req.body.token
    console.log(req.body)

    //if(!accessToken) {return res.status(400).json({error: "no user"+ accessToken})}
    if(!accessToken||accessToken==='') {return res.json({Auth: false, Res: req})}


    else{
        //const vaildToken = 
        jwt.verify(accessToken,"jwtsecret",(err,result)=>{
            if (err) {
                return res.json({Message: "Auth failed"})
            } else {
                req.user = result.user;

                next();
            }
        })
        /*
        if (vaildToken) {
            req.authenticated = true
            return next()
        }
    } catch(err) {
        return res.status(400).json({error: err});
    }
*/
}
}


  
app.post("/create-checkout-session",validateToken , async (req, res) => {
//    res.json({url: 'Hi'})
    let total = 0;
    req.body.items.map(item => {
        total += item.quantity*item.price
    });

    let shipping_rate_id = total>=300 ? 'shr_1NiXssC7JN2n5AToqKBMnyCh' : 'shr_1NiXENC7JN2n5ATosjRZyFLU'

    try{



        const session = await stripe.checkout.sessions.create({
//            amount: calculateOrderAmount(items),
            
            mode: 'payment',
            payment_method_types: ["card"],
            
            line_items: req.body.items.map(item => {
//                const storeItem = storeItems.get(item.id)
                return{
                    
                    price_data: {
//                        product : item.id,
//                        nickname: item.id, 
                        product_data:{
//                            description: item.id,
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
           
//            cancel_url: `${baseUrl}/cart`,
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





////////



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
        if (result.length > 0){
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



app.put("/account/profile/update", (req, res)=>{
    const sql = "UPDATE retaildb.user SET ? WHERE id = ?;"
    conn.query(sql, [req.body,req.body.id],(err,result)=>{
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
                    const accessToken = createTokens({'id':result.insertId,'name':`${req.body.given_name} ' '${req.body.family_name}`})
                    return res.json({Status: 'Success', Token: accessToken})
                }
        
            })
        } else {
            const accessToken = createTokens(result[0])
            return res.json({Status: 'Success', Token: accessToken})

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

            const accessToken = createTokens(result[0])
            //const accessToken = jwt.sign(result[0].name,"jwtsecret")
            //,"envjwtscrete",{expiresIn: '1d'}
            /*
            res.cookie("access-token",accessToken,{
                maxAge: 60 * 60 * 24 * 30 * 1000,
//                domain: ['wnp-ecom.uc.r.appspot.com','server-dot-wnp-ecom.uc.r.appspot.com','localhost'],
                sameSite: 'None',
                secure: true,
                path: '/',
                httpOnly: false
            })
            */
            return res.json({Status: 'Success', Token: accessToken})
        } else {
            return res.json({Message: "No Record"})
        }
    })
})

app.get("/account/logout",(req,res)=>{
//    res.cookie('access-token',req.cookies['access-token'],{maxAge: 0})
    res.clearCookie('access-token',{
        maxAge: 60 * 60 * 24 * 30 * 1000,
//        domain: ['wnp-ecom.uc.r.appspot.com','server-dot-wnp-ecom.uc.r.appspot.com','localhost'],
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

