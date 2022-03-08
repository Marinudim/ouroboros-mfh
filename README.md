Cryptoart with a new type of blockchain - Ouroboros Manna From Heaven.  
Read file white-paper.txt in this package to learh how to become a keeper and get 1 manna for each vertebra(block) of ouroboros.  
Or read it here: [white-paper](https://www.fastchooser.com/Manna-from-Heaven-Cryptoart-with-Ouroboros-Blockchain-DLT)

Install
----------------
```
npm install ouroboros-mfh
```

Usage
----------------
```js
const ouroborosMFH = require('ouroborosMFH')

// run ouroboros
ouroborosMFH({ 
    server: server_name, // server_name = express()
    myDomain: '[www].domain', // your site name to be keeper
    defaultDomain: 'www.fastchooser.com' // some active domain from ouroboros when you have no ouroboros chain
})    

// set chain-collection in mongodb into global variable
global.ouroborosMFH = database.collection('ouroborosMFH')
```

Additional instruction
----------------
```
Also, file ouroboros-mfh.ejs is designed for the client side. You can use another view engine with your  
modifications. Your own site page gives you full control over security. It is the best way to protect  
your private key.  

Url https://www.letterevo.com/Ouroboros-MFH for transactions. Be free to watch javascript code on that  
page to be sure, we don't receive your private key.  
```

Related
----------------
[seedrandom](https://github.com/davidbau/seedrandom')


License
----------------
```
MIT
```