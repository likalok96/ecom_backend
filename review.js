var express = require('express');
var router = express.Router();
const conn = require('./dbConfig')

router.post("/",(req,res)=>{
    const now = new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' ')
    const sql = `INSERT IGNORE INTO retaildb.review(name, email, score, title, content, date, product_id) values ('${req.body.name}','${req.body.email} ' ,${req.body.score}, '${req.body.title}', '${req.body.content}', '${now}', ${req.body.product_id})`

    conn.query(sql,(err,result)=>{
        if (err) { 
            return res.json(err);
        } else {
            console.log(result)
            return res.json(result)
        }

    })
})

router.get("/",(req,res)=>{
    const sql = 'Select *,Sum(score) over (order by id desc) as score_acum from retaildb.review'

    conn.query(sql,(err,result)=>{
        if (err) {
            return res.json(err)
        } else {
            return res.json(result)
        }
    })
})

module.exports = router;
