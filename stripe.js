
module.exports = {
    sql_order: function(session, conn, stripe){
        let errorList = [];

        let order_details1 = {   Delivery_Address: Object.values(session.shipping_details.address).join(' '),
                                Shipper_id: 10,
                                Date_Time: new Date(session.created*1000).toISOString().slice(0, 19).replace('T', ' '),
                                Customer_id: session.metadata.customer_id,
                                totalCost: session.amount_total/100,
                                
                            }


        let billing = { payment_method: session.payment_method_types[0],
                        billing_address: Object.values(session.customer_details.address).join(' '),
                        }
        

        function createDbQueries(order_details, coupon) {

            let dbQueries = [
                [`INSERT IGNORE INTO retaildb.billing_details(payment_mode, billing_address) VALUES ('${billing.payment_method}', '${billing.billing_address}')`,
                 ''],
                [`SELECT billing_id FROM retaildb.billing_details WHERE payment_mode = '${billing.payment_method}' AND billing_address = '${billing.billing_address}'`,
                 'billing_id'],
//                [`SELECT id FROM retaildb.user WHERE Name = '${session.shipping_details.name}'`,
//                 'id'] ,
                 
                [`INSERT INTO retaildb.coupon_data(Coupon_id, Discount, ExpiryDate, Unique_id, isUsed) values ('${coupon.coupon_id}', ${coupon.percent_off}, '${coupon.expire_date}', ${order_details.id},0)`,
                 ''],
                coupon.coupon_id ? [`INSERT INTO retaildb.order_table(Delivery_Address, Shipper_id, Date_Time, Unique_id, billing_id,couponID ) VALUES ('${order_details.Delivery_Address}',
                  ${order_details.Shipper_id}, '${order_details.Date_Time}', ${order_details.Customer_id}, ${order_details.billing_id},'${coupon.coupon_id}' )`,
                  'insertId'
                ] : [`INSERT INTO retaildb.order_table(Delivery_Address, Shipper_id, Date_Time, Unique_id, billing_id ) VALUES ('${order_details.Delivery_Address}',
                ${order_details.Shipper_id}, '${order_details.Date_Time}', ${order_details.Customer_id}, ${order_details.billing_id} )`,
                'insertId'
              ]
                

            ];

            return dbQueries
        }

        let i = 0;

        function runQueries(order_details,coupon) {

            let dbQueriesArr = createDbQueries(order_details,coupon).slice(i,createDbQueries(order_details,coupon).length)

            if(dbQueriesArr.length === 0){
                
                const lineItems =  stripe.checkout.sessions.listLineItems(session.id,{expand: ['data.price.product']},(err, lineItems)=>{
    
                    let item_data = lineItems.data;
                    item_data.map((item)=>{
                        product_id = item.price.product.metadata.prd_id;
                        quantity = item.quantity
                        cost = quantity * item.price.unit_amount
                        
                        item_sql = `INSERT INTO retaildb.items_purchased(Order_id, Product_ID, Quantity, Cost) values (${order_details.insertId}, ${product_id}, ${quantity}, ${cost})`
                        conn.query(item_sql,(err,result)=>{
                            if (err){ console.log(err)
                            }else{
                                console.log(result)
                            }
                        })
                    })
                });

                return 
            }

            var dbQuery = dbQueriesArr[0][0];
            var field = dbQueriesArr[0][1];
            conn.query(dbQuery, function(err, results, fields) {
                if (err) {
                    errorList.push({ err, results, fields, dbQuery });
                }
                if(field.length > 0){
                var field_table = field==='insertId' ? results[field] : results[0][field]
                order_details1 = {...order_details,[field]:field_table}
                }
                i++
                console.log(order_details1)
                runQueries(order_details1,coupon);
                
            });
        }

        const checkout_session = stripe.checkout.sessions.retrieve(session.id,{expand:['total_details.breakdown']})
        .then((result)=>{
            console.log('checkout_result: ' +result?.total_details?.breakdown?.discounts[0]?.discount?.coupon?.id)
            let coupon = {
                            coupon_id : result?.total_details?.breakdown?.discounts[0]?.discount?.coupon?.id ?? null,
                            percent_off : result?.total_details?.breakdown?.discounts[0]?.discount?.coupon?.percent_off ?? 0,
                            expire_date : new Date(session.created*1000).toISOString().slice(0, 10)
                         }

            runQueries(order_details1,coupon);

        })
        
        }

    }


        
        

