const mysql = require('mysql2')


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

module.exports = conn;
