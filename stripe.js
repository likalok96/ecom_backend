require('dotenv').config()
var express = require('express');

var router = express.Router();

//router.use(cookirParser());
//router.use(bodyParser.urlencoded({ extended: true}));
const stripe_sql = require('./stripe_sql')
const validateToken = require('./middleware')

const stripe = process.env.NODE_ENV ==='production' ? require("stripe")(process.env.STRIPE_KEY_PRD) 
: require("stripe")(process.env.STRIPE_KEY_DEV)

const baseUrl = process.env.NODE_ENV ==='production' ?'https://wnp-ecom.uc.r.appspot.com':'http://localhost:3000'
const conn = require('./dbConfig')
const endpointSecret = process.env.NODE_ENV ==='production' ? 'whsec_ti1aBw3M7n4KpZQxFoqiQVwMZzxXkzgX' : 'whsec_0a68900530084265af66867ecd4d24f9c13c9789b154adf191baa0b22d9fbf71'

router.post("/create-checkout-session",validateToken , async (req, res) => {
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

router.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
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
  
router.get("/checkout/session/:session_id",async (req,res)=>{
    const {session_id} = req.params;
    const session = await stripe.checkout.sessions.retrieve(session_id,{expand:['total_details.breakdown']});

    res.send(session);
})

router.get("/checkout/item/:session_id",async (req,res)=>{
    const {session_id} = req.params;
    const lineItems =  await stripe.checkout.sessions.listLineItems(session_id,{expand: ['data.price.product']},(err, lineItems)=>{
        res.send(lineItems);
    });

    
})

module.exports = router;
