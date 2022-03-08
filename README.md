Author: Dmitry Khramov
Date: 2022-03-08

A new idea of cryptoart with open source

Node.js usage
----------------
```
npm install ouroboros-mfh
```

```js
const ouroborosMFH = require('./ouroboros-mfh')

// run ouroboros
ouroborosMFH({ 
    server: server_name, // server_name = express()
    myDomain: '[www].domain', // your site name to be keeper
    defaultDomain: 'www.fastchooser.com' // some active domain from ouroboros when you have not ouroboros chain
})    

// set chain-collection in mongodb into global variable
global.ouroborosMFH = database.collection('ouroborosMFH')
```

```
file ouroboros-mfh.ejs is designed for client side
```

```
According to common sense we are against corruption, war and any kind of armed aggression.
```