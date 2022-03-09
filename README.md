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
const ouroborosMFH = require('ouroboros-mfh')

// run ouroboros
ouroborosMFH({ 
    server: server_name, // server_name = express()
    myDomain: '[www].domain', // your site name to be keeper
    // some active domain when you have no ouroboros chain
    defaultDomain: 'www.fastchooser.com'
})    

// set chain-collection in mongodb into global variable
global.ouroborosMFH = database.collection('ouroborosMFH')

/* To join the system as a keeper, you need to have an HTTPS  
website with a maximum of 3 levels for your domain name with  
only “www” on the third level that will be used as a node  
in the system. It is also required to use NodeJS and MongoDB  
for now.  

Create a new exhibit on letterevo.com. Then contact  
by email letterevo-dog-gmail-dot-com notifying it that you want  
to be a keeper and send your site’s name and the number  
of your exhibit. After checking your site, ten thousand mannas  
will be transferred to your exhibit. Then transfer at least  
one cell (0.000001 Manna) anywhere from the first exhibit.  

While making the transaction, in the field “message” write  
your domain name in the following format:  
<add>sitename.com  

If post requests on your site are available with "www",  
don’t count on redirecting, write it with "www":  
<add>www.sitename.com
*/
```

Additional instruction
----------------
```
Also, file ouroboros-mfh.ejs is designed for the client side.  
You can use another view engine with your modifications.  
Your own site page gives you full control over security.  
It is the best way to protect your private key.  

Url https://www.letterevo.com/Ouroboros-MFH for transactions.  
Be free to watch javascript code on that page to be sure,  
we don't receive your private key.  
```

Related
----------------
[seedrandom](https://github.com/davidbau/seedrandom')

Version notes
----------------
```
1.0.1 - readme.md correction  
1.0.2 - readme.md correction  
1.0.3 - readme.md correction  
```

License
----------------
```
MIT
```