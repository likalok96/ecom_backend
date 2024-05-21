const jwt = require("jsonwebtoken")

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
        //60 * 60
    );
    return accessToken;
}

module.exports = {createRefreshTokens,createTokens};
