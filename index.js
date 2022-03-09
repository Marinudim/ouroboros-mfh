const https = require('https'),
    crypto = require('crypto'),
    seedrandom = require('seedrandom')

module.exports = async function ouroborosMFH({ server, myDomain, defaultDomain }) {

    let deals = [], // array for all deals
        headDeals = { deals: [], d: '' }, // deals, timestamp for head of ouroboros
        myLastVertebra = { h: -1, c: '', d: Date.now() }

    // the creator's reward is not guaranteed if these constants and variables are changed
    const exhibitsQuantity = 255, maxBansForKeeper = 7,
        maxKeeperInterval = 44000, minKeeperBalance = 9999,
        delayForSpread = 20000, minReqInterval = 1000,
        timeForValidDeal = 1000 * 60 * 60 * 4,
        dealReward = .000002;

    let delayTillNextCreator = Date.now(), delayCreation = 0;
    let dbOuroborosMFH = '', // ouroboros's collection in the database
        secondConfirmation = 0,
        creatorDomain = { d: false, n: false } // domain, number

    let getOuroborosCollection = setInterval(() => {
        try {
            if (global.ouroborosMFH) {
                dbOuroborosMFH = global.ouroborosMFH;
                console.log('Database collection "ouroborosMFH" is successfully connected.')
                clearInterval(getOuroborosCollection)
                setTimeout(() => { keeperRequest() }, 100)
            }
        } catch { /* there is no ouroboros collection yet */ }
    }, 100)

    // requests from other keepers
    server.post('/ouroboros-mfh', async (req, res) => {

        let body = {}
        try { body = req.body }
        catch { body = { wh: 'error' } }
        if (!body) { body = { wh: 'error' } }
        if (!body.wh) { body = { wh: 'error' } }

        switch (body.wh) {
            case 'keeper': { // all requests from other keepers are of 'get' type, nobody can impose data
                try { // body - { wh:'keeper', vertebra:{h,c}, deals:[sha1, sha1, sha1...] }
                    const resp = { vertebra: { c: myLastVertebra.c, h: myLastVertebra.h }, status: 'tail', deals: [] }
                    if (body.vertebra.h === -1) {
                        resp.status = 'invalid';
                        resp.vertebra = await db({ wh: 'get-tail' })
                    }
                    else if (body.vertebra.h === myLastVertebra.h
                        && body.vertebra.c === myLastVertebra.c) {
                        resp.status = 'same'; resp.vertebra = { c: myLastVertebra.c, h: myLastVertebra.h };
                        resp.deals = deals.filter(d => !body.deals.includes(d.s)) // filter deals
                    }
                    else if (myLastVertebra.h >= (body.vertebra.h + 1)
                        && myLastVertebra.d !== headDeals.d) {
                        const result = await db({ wh: 'v-by-h', h: body.vertebra.h })
                        if (result) {
                            if (result.c === body.vertebra.c) {
                                resp.status = 'vertebra'; // send the following vertebra
                                resp.vertebra = await db({ wh: 'whole-v-by-h', h: result.h + 1 })
                            } else {
                                resp.status = 'invalid';
                                resp.vertebra = await db({ wh: 'get-tail' })
                            }
                        } else {
                            resp.status = 'invalid';
                            resp.vertebra = await db({ wh: 'get-tail' })
                        }
                    }
                    else if (myLastVertebra.h === (body.vertebra.h + 1)
                        && myLastVertebra.d === headDeals.d
                        && myLastVertebra.p === body.vertebra.c) {
                        if (myLastVertebra.d <= Date.now()) { // send head of ouroboros with head's deals
                            resp.status = 'head';
                            resp.headDeals = headDeals;
                        } else {
                            resp.status = 'same';
                            resp.vertebra = { c: body.vertebra.c, h: body.vertebra.h };
                            resp.deals = deals.filter(d => !body.deals.includes(d.s)) // filter deals
                        }
                    }
                    res.status(200).send(resp)
                } catch {
                    res.sendStatus(400) // bad request
                }
            }; break; // case keeper

            /* cases for keepers with services */
            case 'deal': {
                try { // { wh:'deal', deal: { a[mount], f[rom]-payer, p[ublicKey], t[o]-payee, m[essage], r-signature }}
                    let resp = { wh: 'deal', status: 'cancelled', err: '' }
                    const result = await checkDeal({ deal: body.deal, ts: Date.now(), secondBalance: false })
                    if (result.status === 'ok') {
                        deals.push(body.deal) // add deal to array
                        resp.status = 'accepted';
                    } else {
                        resp.err = result.err;
                    }
                    res.send(resp)
                } catch { res.sendStatus(400) }
            }; break; // case deal
            case 'balance': { // get balance by exhibit
                try {
                    const balance = await db({ wh: 'exhibit-amount', exhibit: body.exhibit })
                    res.send({ wh: 'balance', balance: balance })
                } catch { res.sendStatus(400) }
            }; break; // case balance
            case 'head': { // get last vertebra, head
                try {
                    body.head = myLastVertebra;
                    res.send(body)
                } catch { res.sendStatus(400) }
            }; break;

            case 'error': {
                res.sendStatus(400) // bad request, water off a duck
            }; break;
            default: {
                res.sendStatus(400) // bad request, water off a duck
            }; break;
        } // switch body.wh

    }) // post /ouroboros-mfh

    // keeper's requests
    async function keeperRequest() {
        if (Date.now() < (delayCreation + delayForSpread)) { // delay after creation of head
            setTimeout(() => { keeperRequest() }, (delayForSpread - (Date.now() - delayCreation)))
            return;
        }
        const myRandom = seedrandom() // reasonably unpredictable
        const startTs = Date.now()
        let clearHeadDeals = false; // clear deals after adding head
        myLastVertebra = await db({ wh: 'get-head' }) // this is my ouroboros's head(last vertebra). h === -1 - I have no ouroboros

        // force possibility to get head from creator, creatorDomain
        let randomKeeper, randomDomain;
        if (myDomain !== creatorDomain.d
            && startTs > creatorDomain.ts
            && startTs < (creatorDomain.ts + 3000)) {
            for (let i = 0; i < 4; i++) {
                const rk = Math.floor(myRandom() * myLastVertebra.n) + 1;
                if (rk === creatorDomain.n) {
                    randomDomain = creatorDomain.d;
                    break;
                }
            } // for
        } // if
        if (!randomDomain) {
            randomKeeper = await db({ wh: 'keeper', number: Math.floor(myRandom() * myLastVertebra.n) + 1 })
            randomDomain = randomKeeper.d.replace(/_/g, '.');
            if (randomDomain === myDomain) {
                setTimeout(() => { keeperRequest() }, 100)
                return;
            }
        }
        creatorDomain.d = false;
        creatorDomain.n = false;

        const stamps = deals.map(item => { return item.s }) // stamps of my deals for deal exchange
        const data = { wh: 'keeper', vertebra: { h: myLastVertebra.h, c: myLastVertebra.c }, deals: stamps }
        // request to random keeper
        let resp = await postRequest(`https://${randomDomain}/ouroboros-mfh`, data)
        try { if (!resp.status) { resp = { status: 'error', err: 'bad response' } } }
        catch { resp = { status: 'error', err: 'bad response' } }

        switch (resp.status) { // resp {wh:'keeper ',vertebra,deals,headDeals:{deals,d}}
            case 'same': {
                try {
                    if (resp.vertebra.c !== myLastVertebra.c) { break; }
                    if (delayTillNextCreator > Date.now()) { break; } // wait until the next interval when I may become a creator
                    const newVertebra = await createCheckHead(false) // false - create new vertebra                    
                    if (!newVertebra) { break; }
                    newVertebra.c = createHashSha1(newVertebra)
                    // [remove tail] and add new head
                    if ((newVertebra.t - 1) === myLastVertebra.t) { await db({ wh: 'del-tail' }) }
                    await db({ wh: 'add-v', vertebra: newVertebra })
                    myLastVertebra = newVertebra;
                    delayCreation = Date.now();
                    clearHeadDeals = true;
                } catch { /* water off a duck */ }
                secondConfirmation = 0;
            }; break;
            case 'head': { // response { vertebra, headDeals { deals:[], d:'timestamp' }
                try {
                    if (resp.vertebra.h !== myLastVertebra.h + 1) { break; }
                    if (resp.headDeals.d < (myLastVertebra.d + delayForSpread)) { break; } // too early timestamp

                    const newVertebra = await createCheckHead(resp.headDeals) // { vertebra: { 0, h, c, d }, deals, d }                    
                    if (!newVertebra) { break; }

                    newVertebra.c = createHashSha1(newVertebra)
                    if (newVertebra.c !== resp.vertebra.c) { break; }
                    // [remove tail] and add new head
                    if ((newVertebra.t - 1) === myLastVertebra.t) { await db({ wh: 'del-tail' }) }
                    await db({ wh: 'add-v', vertebra: newVertebra })
                    clearHeadDeals = true;
                } catch { /* water off a duck */ }
                secondConfirmation = 0;
            }; break;
            case 'vertebra': {
                try {
                    if (myLastVertebra.c !== resp.vertebra.p) { break; }
                    if (resp.vertebra['0'] !== 'Manna From Heaven') { break; }
                    if ((myLastVertebra.d + delayForSpread) > resp.vertebra.d) { break; }
                    if (myLastVertebra.h + 1 !== resp.vertebra.h) { break; }
                    const hash = resp.vertebra.c;
                    delete resp.vertebra.c;
                    resp.vertebra.c = createHashSha1(resp.vertebra)
                    if (hash !== resp.vertebra.c) { break; }
                    await db({ wh: 'add-v', vertebra: resp.vertebra })
                    if (myLastVertebra.t + 1 === resp.vertebra.t) {
                        await db({ wh: 'del-tail' })
                    }
                } catch { /* water off a duck */ }
                secondConfirmation = 0;
            }; break;
            case 'invalid': { // response - invalid vertebra, delete last in db
                try {
                    if (secondConfirmation > 1) {
                        secondConfirmation = 0;
                        if (myLastVertebra.h === -1 // I have no ouroboros
                            && resp.vertebra.h !== -1) { // other keeper has the ouroboros
                            await db({ wh: 'add-v', vertebra: resp.vertebra })
                        } else {
                            await db({ wh: 'del-head' })
                        }
                    }
                    secondConfirmation++;
                } catch { /* water off a duck */ }
            }; break;
            case 'tail': { /* water off a duck */ }; break;
            case 'error': { /* water off a duck */ }; break;
            case 'timeout': { /* water off a duck */ }; break;
            default: { /* water off a duck */ }; break;
        } // switch resp wh

        try { // add deals that I don't have
            resp.deals = resp.deals.filter(deal =>
                !deals.find(({ s, f }) => deal.s === s && deal.f === f))
            let newDeals = []
            for await (let deal of resp.deals) { // check new deals from other keeper                
                const dealResult = await checkDeal({ deal: deal, ts: Date.now(), secondBalance: false })
                if (dealResult.status === 'ok') { newDeals.push(deal) }
            }
            deals.concat(newDeals)
        } catch { /* water off a duck */ }
        // clear deals that were added to the head
        if (clearHeadDeals) {
            deals = deals.filter(deal =>
                !headDeals.deals.find(({ s, f }) => deal.s === s && deal.f === f))
        }
        // clear obsolete deals
        deals = deals.filter(deal => { return (deal.d + timeForValidDeal) > Date.now() })

        if (resp.status === 'head' || resp.status === 'same') {
            setTimeout(() => { keeperRequest() }, (minReqInterval - (Date.now() - startTs))) // at least 1 sec between requests
        } else { keeperRequest() }

    } // async function request interval

    async function createCheckHead(headWithDeals) { // false = create, { deals, d } = check
        return new Promise(async (resolve, reject) => {

            let ts = Date.now()
            if (headWithDeals) { ts = headWithDeals.d; }
            // choose next keeper for the role of creator every 44 seconds. 20 sec to spread accross
            const orderNumber = Math.floor((ts - myLastVertebra.d) / maxKeeperInterval) + 1;
            const randomWithSeed = seedrandom(myLastVertebra.c)
            let nextCreator = 0;
            // get random number beetwen 1 and the whole number of keepers (myLastVertebra.n)
            let bannedKeepers = []
            for (let i = 0; i < orderNumber; i++) {
                nextCreator = Math.floor(randomWithSeed() * myLastVertebra.n) + 1;
                if (!bannedKeepers.includes(nextCreator)
                    && i !== (orderNumber - 1)) { bannedKeepers.push(nextCreator) }
            }
            const creator = await db({ wh: 'keeper', number: nextCreator }) // {d[omain],e[xhibit],b[alance]}
            creatorDomain.d = creator.d.replace(/_/g, '.')
            creatorDomain.n = nextCreator;
            creatorDomain.ts = (orderNumber * maxKeeperInterval) + (delayForSpread / 2) + myLastVertebra.d;

            if (!headWithDeals && creator.d !== myDomain.replace(/\./g, '_')) {
                delayTillNextCreator = myLastVertebra.d + (maxKeeperInterval * orderNumber);
                resolve(false);
                return;
            }

            const newVertebra = { 0: 'Manna From Heaven', h: myLastVertebra.h + 1, p: myLastVertebra.c }

            let operations;
            if (headWithDeals) { operations = headWithDeals.deals }
            else { operations = deals }

            // even - bite tail, odd - only new deals
            let exhibitsFromTail = [], domains = [], index = 0;

            if (!((myLastVertebra.h + 1) % 2) || operations.length === 0) { // head is even or there are no deals - bite tail
                const tail = await db({ wh: 'get-tail' })
                let exhibits = []
                // collect all exhibits and domains from tail
                for (let key in tail) {
                    if (key.length === 43) { exhibits.push(key) }
                    else if (typeof key == 'number' && key > 0) { domains.push(key) }
                    else if (key.length > 1) { domains.push(key) }
                }
                exhibitsFromTail = await db({ wh: 'repeated-exhibits', exhibits: exhibits, h: tail.h })
                index = exhibitsFromTail.length;
                if (index > 0) { // add deals from tail to newVertebra
                    exhibitsFromTail.forEach(exhibit => { newVertebra[exhibit] = tail[exhibit] })
                }
                for await (let dn of domains) {
                    let server;
                    if (typeof dn == 'number') { server = await db({ wh: 'keeper', number: dn }) }
                    else { server = await db({ wh: 'domain', domain: dn }) }
                    if (server.b > (maxBansForKeeper - 1)) { continue; }
                    if (server.h == tail.h) {
                        if (typeof dn == 'number') {
                            newVertebra[dn] = { d: server.d, e: server.e, b: server.b }
                            newVertebra[server.d] = { n: dn, e: server.e, b: server.b }
                        } else {
                            newVertebra[dn] = { n: server.n, e: server.e, b: server.b }
                            newVertebra[server.n] = { d: dn, e: server.e, b: server.b }
                        }
                    } // server.h > tail.h
                }
                newVertebra.t = myLastVertebra.t + 1; // even, or no deals - head bites tail, move forward
            } else { newVertebra.t = myLastVertebra.t; } // tail remains the same

            // reduce creator's ban if he has more than 0
            if (creator.b > 0) {
                newVertebra[nextCreator] = { d: creator.d, e: creator.e, b: creator.b - 1 }
                newVertebra[creator.d] = { n: nextCreator, e: creator.e, b: creator.b - 1 }
            }

            if (!headWithDeals) { headDeals.deals = [] }

            let newDeals = 0, quantityOfKeepers = myLastVertebra.n;
            for await (let deal of operations) {
                if (index >= exhibitsQuantity) { break; }
                if (newVertebra[deal.f]) { continue; } // same payer exhibit
                if (newVertebra[deal.t]) { continue; } // same payee exhibit
                if (newVertebra[creator.e]) { continue; } // creator has to receive creator's reward                
                let dealResult = await checkDeal({ deal: deal, ts: myLastVertebra.d, secondBalance: true })
                // dealResult: { status: "ok"|"err", err:'...', payerB, payeeB }
                if (dealResult.status !== 'ok') { continue; }
                // commands in message
                if (deal.m[0] === '<' && deal.m[4] === '>') {
                    const command = deal.m.substr(1, 3) // <...>
                    switch (command) {
                        case 'add': { // add new keeper
                            try {
                                const domain = deal.m.substr(5).replace(/\./g, '_')
                                const domains = domain.split('_')

                                if (domain.length === 43) { break; } // must not match with exhibit's length
                                if (domains.length < 2 || domains.length > 3) { break; }
                                if (domains.length === 3 && domains[0] !== 'www') { break; }
                                if (domains[1].search("^[A-Za-z0-9_-áéíóú]+$") === -1) { break; }
                                if (domains[0] === 'www' && domains[2].search("^[A-Za-z0-9_-áéíóú]+$") === -1) { break; }
                                if (domains[1].length > 63) { break; }
                                if (domains[0] === 'www' && domains[2].length > 63) { break; }

                                const result = await db({ wh: 'domain', domain }) // domain{n,e,b}
                                if (result.h === -1) {
                                    const balance = await db({ wh: 'exhibit-amount', exhibit: deal.f })
                                    if (balance.b > minKeeperBalance) {
                                        quantityOfKeepers++;
                                        newVertebra[domain] = { n: quantityOfKeepers, e: deal.f, b: 0 }
                                        newVertebra[quantityOfKeepers] = { d: domain, e: deal.f, b: 0 }
                                    }
                                }
                            } catch { /* water off a duck */ }
                        }; break;
                        default: { /* water off a duck */ }; break;
                    } // switch command
                } // command in message
                newVertebra[deal.f] = { t: deal.t, a: deal.a, b: dealResult.payerB, s: deal.s } // add payer's exhibit
                newVertebra[deal.t] = { f: deal.f, a: deal.a, b: dealResult.payeeB, m: deal.m } // add payee's exhibit
                if (!headWithDeals) { headDeals.deals.push(deal) }
                index++; index++; newDeals++;
            } // for await let deal of operations

            for await (let bannedKeeper of bannedKeepers) { // ban previous keeper
                const banned = await db({ wh: 'keeper', number: bannedKeeper }) // {d[omain],e[xhibit],b[alance]}                        
                if (banned.b + 1 > maxBansForKeeper) {
                    // if there is more than 8 bans - move last to this position, reduce the whole number of keepers
                    if (bannedKeeper === quantityOfKeepers) { quantityOfKeepers--; }
                    else {
                        // get the latest domain
                        const lastDomain = await db({ wh: 'keeper', number: quantityOfKeepers })
                        // put the latest domain instead of the deleted one
                        newVertebra[lastDomain.d] = { n: bannedKeeper, e: lastDomain.e, b: lastDomain.b }
                        newVertebra[bannedKeeper] = { d: lastDomain, e: lastDomain.e, b: lastDomain.b }
                        quantityOfKeepers--;
                    }
                } else {
                    newVertebra[bannedKeeper] = { d: banned.d, e: banned.e, b: banned.b + 1 }
                    newVertebra[banned.d] = { n: bannedKeeper, e: banned.e, b: banned.b + 1 }
                }
            } // for bannedKeeper
            newVertebra.n = quantityOfKeepers; // reduce vertebra.n
            // set keeper's reward 1 manna + (.000001(cell) * quantity of deals)
            let creatorBalance = await db({ wh: 'exhibit-amount', exhibit: creator.e });
            const reward = Number((newDeals * dealReward).toFixed(6));
            newVertebra[creator.e] = {
                f: 'Ouroboros-MFH', a: reward + 1,
                b: Number((creatorBalance.b + reward + 1).toFixed(6)),
                m: "creator's reward",
                h: newVertebra.h,
                n: nextCreator,
                d: creator.d
            }
            // reduce end of ouroboros
            newVertebra.e = Number((myLastVertebra.e - (newDeals * dealReward)).toFixed(6))

            if (headWithDeals) { newVertebra.d = headWithDeals.d; }
            else {
                if (Date.now() < (myLastVertebra.d + delayForSpread)) {
                    newVertebra.d = myLastVertebra.d + delayForSpread;
                } else { newVertebra.d = Date.now() }
            }

            headDeals.d = newVertebra.d;

            let cr = 'verify';
            if (!headWithDeals) { cr = 'creation' }            

            resolve(newVertebra);
        }) // new Promise
    } // async function create check head

    async function checkDeal({ deal, ts, secondBalance }) { // return { status: 'ok'|'err', err: '' }
        // deal: { f[rom], t[o], a[mount], d:ts, m[essage], p[ublicKey], r:signature, s[tamp] }
        return new Promise(async (resolve, reject) => {
            const resp = { status: 'err', err: '' }
            try { // validate deal
                if (deal.f.search("^[A-Za-z0-9_-]+$") === -1
                    || deal.f.length !== 43) { resp.err = "incorrect payer's exhibit"; resolve(resp); return; }// check payer's exhibit
                if (deal.t.search("^[A-Za-z0-9_-]+$") === -1
                    || deal.t.length !== 43) { resp.err = "incorrect payee's exhibit"; resolve(resp); return; }// check payee's exhibit
                if (deal.f === deal.t) { resp.err = "incorrect payee's exhibit"; resolve(resp); return; }
                if (deal.d > (Date.now() + 60000)) { resp.err = 'wrong timestamp'; resolve(resp); return; }
                if (deal.m.length > 300) { resp.err = 'too long message'; resolve(resp); return; }
                if (!deal.m) { deal.m = '' }
                const exhibit = publicKeyToExhibit(deal.p) // check exhibit from public key
                if (deal.f !== exhibit) { resp.err = 'wrong exhibit'; resolve(resp); return; }
                if ((deal.d + timeForValidDeal) < ts) { resp.err = 'deal time is over'; resolve(resp); return; } // too late
                if (!verifySignatureByPublicKey(
                    deal.p, // public key
                    deal.r, // signature
                    deal.f + deal.t + deal.a + deal.d + deal.m // test
                )) { resp.err = 'wrong signature'; resolve(resp); return; }
                const payerB = (await db({ wh: 'exhibit-amount', exhibit: deal.f })).b;
                if ((payerB - deal.a) >= 0 && deal.a >= .000001) { // check balance of exhibit                
                    deal.s = crypto.createHash("sha1")
                        .update(deal.r)
                        .digest('base64') // add stamp - signature's reduction
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=/g, '')
                } else { resp.err = 'amount error'; resolve(resp); return; }
                const dealTime = await db({ wh: 'deal-time-stamp', f: deal.f, d: deal.d, s: deal.s })
                if (dealTime) {
                    resp.err = 'the deal has been already made'; resolve(resp); return;
                }
                let payeeB = -1;
                if (secondBalance) {
                    payeeB = (await db({ wh: 'exhibit-amount', exhibit: deal.t })).b;
                    resp.payeeB = Number((payeeB + deal.a).toFixed(6));
                }
                resp.status = 'ok';
                resp.payerB = Number((payerB - deal.a).toFixed(6));
                resolve(resp); // { status: 'ok', err: '' }
            } catch (e) { resp.err = e; resolve(resp) }
        }) // new Promise
    } // async function check deal

    // data base operations
    async function db(body) {
        try {
            switch (body.wh) {
                case 'keeper': {
                    let keeperObj = await dbOuroborosMFH.find({ [body.number]: { $exists: true } },
                        { projection: { _id: 0, [body.number]: 1, h: 1 } }).limit(1).sort({ _id: -1 }).toArray()
                    if (keeperObj.length) {
                        keeperObj[0][body.number].h = keeperObj[0].h;
                        return keeperObj[0][body.number] // n: {d:domain,e:exhibit,b:ban}
                    } else {
                        return { d: defaultDomain.replace(/\./g, '_'), e: '', b: 0, h: -1 }; // default site
                    }
                }; break;
                case 'domain': {
                    let keeperObj = await dbOuroborosMFH.find({ [body.domain]: { $exists: true } },
                        { projection: { _id: 0, [body.domain]: 1, h: 1 } }).limit(1).sort({ _id: -1 }).toArray()
                    if (keeperObj.length) {
                        keeperObj[0][body.domain].h = keeperObj[0].h;
                        return keeperObj[0][body.domain] // domain: {n:number,e:exhibit,b:ban}
                    } else {
                        return { h: -1 }; // default site
                    }
                }; break;
                case 'get-tail': { // get first vertebra - tail
                    let result = await dbOuroborosMFH.find({}, { projection: { _id: 0 } })
                        .sort({ _id: 1 }).limit(1).toArray()
                    if (result.length) { return result[0] }
                    else { return { c: 'there is no ouroboros', h: -1 } }
                }; break;
                case 'get-head': { // get last vertebra - head
                    let result = await dbOuroborosMFH.find({}, { projection: { _id: 0 } })
                        .sort({ _id: -1 }).limit(1).toArray()
                    if (result.length) { return result[0] }
                    else { return { c: 'there is no ouroboros', h: -1 } }
                }; break;
                case 'add-v': { // add vertebra
                    const sortedV = sortObjectABC(body.vertebra)
                    let result = await dbOuroborosMFH.insertOne(sortedV)
                    if (!result) { result = false }
                    return true;
                }; break;
                case 'del-tail': { // delete first vertebra
                    const tail = await dbOuroborosMFH.find({}, { _id: 1 })
                        .limit(1).sort({ _id: 1, h: 1 }).toArray()
                    let result;
                    if (tail[0].h === myLastVertebra.t) {
                        result = await dbOuroborosMFH.deleteOne({ _id: tail[0]._id })
                    } else if (tail[0].h < myLastVertebra.t) {
                        result = await dbOuroborosMFH.deleteOne({ _id: tail[0]._id })
                        await db({ wh: 'del-tail' })
                    } else if (tail[0].h > myLastVertebra.t) {
                        /*  */
                    }
                }; break;
                case 'del-head': { // delete last vertebra
                    const firstID = await dbOuroborosMFH.find({}, { _id: 1 })
                        .limit(1).sort({ _id: -1 }).toArray()
                    const result = await dbOuroborosMFH.deleteOne({ _id: firstID[0]._id })
                    if (result.deletedCount > 0) { return true } // deleted
                    else { return false } // some error in db
                }; break;
                case 'v-by-h': { // get vertebra by h, h - last[head] vertebra
                    const result = await dbOuroborosMFH.findOne({ h: body.h },
                        { projection: { _id: 0, t: 1, h: 1, c: 1 } }) // tail, head, current hash
                    return result;
                }; break;
                case 'whole-v-by-h': { // get vertebra by h, h - last[head] vertebra
                    const result = await dbOuroborosMFH.findOne({ h: body.h },
                        { projection: { _id: 0 } }) // tail, head, current hash
                    return result;
                }; break;
                case 'exhibit-amount': { // get last data of certain exhibit
                    const result = await dbOuroborosMFH.find({ [body.exhibit]: { $exists: true } },
                        { projection: { _id: 0, [body.exhibit]: 1 } }).sort({ _id: -1 }).limit(1).toArray()
                    // result = empty array if there is no exhibit
                    let amount = { b: 0 };
                    if (result.length) { amount = result[0][body.exhibit] } // {t[o],a[amount],b[alance],s[tamp]} {f[rom],a,b,m[essage]}
                    return amount;
                }; break;
                case 'repeated-exhibits': {
                    return new Promise(async (resolve, reject) => {
                        let remainedExhibits = []
                        for await (let exhibit of body.exhibits) {
                            // The findOne() function returns documents in the natural order, which is the order on disk.
                            // You cannot count on this returning the least recently inserted document.
                            let result = await dbOuroborosMFH.find({ [exhibit]: { $exists: true } },
                                { projection: { _id: 0, h: 1 } }).sort({ _id: -1 }).limit(1).toArray()
                            if (result.length && result[0].h > body.h) {
                                /* deal is mentioned later */
                            } else {
                                remainedExhibits.push(exhibit)
                            }
                        } // for await (let exhibit of body.exhibits)
                        resolve(remainedExhibits)
                    }) // new Promise
                }; break;
                case 'deal-time-stamp': {
                    let result = await dbOuroborosMFH.find({
                        $and: [
                            { d: { $gte: body.d, $lt: body.ts } }, // time interval
                            { [body.f]: { $exists: true } }, // f[rom] payer exhibit
                            { [body.f + '.s']: body.s } // s[tamp]
                        ]
                    },
                        { projection: { _id: 0 } }).sort({ _id: -1 }).limit(1).toArray()
                    if (result.length) { return true } // deal is already made
                    else return false;
                }; break;
                default: { return { err: 'unknown response' } }; break;
            } // switch action
        } catch (e) { return { err: e } }
    } // async function db



    async function postRequest(url, data) { // requests to other keepers
        const dataString = JSON.stringify(data)
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': dataString.length, },
            timeout: 2000, // in ms
        }
        return new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                if (res.statusCode < 200 || res.statusCode > 299) {
                    resolve({ status: 'error', err: `HTTP status code ${res.statusCode}` });
                    return;
                }
                const body = []
                res.on('data', (chunk) => body.push(chunk))
                res.on('end', () => {
                    try {
                        const resString = Buffer.concat(body).toString()
                        resolve(JSON.parse(resString))
                    } catch { resolve({ status: 'error', err: 'Incorrect response' }) }
                })
            })
            req.on('error', (err) => { resolve({ err: err, status: 'error' }) })
            req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout' }) })
            req.write(dataString)
            req.end()
        })
    } // async function post request

    const verifySignatureByPublicKey = async (publicKey, signature, test) => {
        return new Promise(async (resolve, reject) => {
            try {
                publicKey = '-----BEGIN PUBLIC KEY-----\r\n' + publicKey + '\r\n-----END PUBLIC KEY-----';
                const pk = crypto.createPublicKey({ key: publicKey, format: 'pem', type: 'spki' })
                const result = crypto.verify(
                    'rsa-sha256',
                    new TextEncoder().encode(test), // test exhibit+to-exhibit+amount+message
                    { key: pk, padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
                    Buffer.from(signature, 'base64')
                )
                resolve(result); // true or false
            } catch (e) { resolve(false) }
        })

    } // verify sign

    const createHashSha1 = (vertebra) => { // sort and hash vertebra
        try {
            return crypto.createHash("sha1")
                .update(JSON.stringify(sortObjectABC(vertebra)))
                .digest("base64")
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '')
        } catch { return false }
    } // create hash

    function sortObjectABC(object) {
        try {
            return Object.keys(object).sort().reduce((obj, key) => { obj[key] = object[key]; return obj; }, {});
        } catch { return false }
    }

    function publicKeyToExhibit(pKey) { // exhibit from public key
        try {
            let ui8arr = Buffer.from(pKey, 'base64') // window.atob() analog
            let hash = crypto.createHash("sha256")
                .update(ui8arr)
                .digest('base64') // () buffer by default is Uint8Array
            hash = hash.replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '')
            return hash; // exhibit from deal's public key
        } catch { return false }
    } // ()=> public key to exhibit

    const genesisVertebra = {
        0: 'Manna From Heaven',
        1: { d: 'www_fastchooser_com', e: 'Yd5tx7TLa4hOFCqFqLvSnKLKY51oh9uxBcJiBQ3P9vw', b: 0 },
        'www_fastchooser_com': { n: 1, e: 'Yd5tx7TLa4hOFCqFqLvSnKLKY51oh9uxBcJiBQ3P9vw', b: 0 },
        2: { d: 'www_letterevo_com', e: 'CLf7C1PsI5JyMAEnNx7JDiKS3naaShujafe7zF5V6s0', b: 0 },
        'www_letterevo_com': { n: 2, e: 'CLf7C1PsI5JyMAEnNx7JDiKS3naaShujafe7zF5V6s0', b: 0 },
        // 4294967295
        t: 42949672, // start from 1% (creator's tip for develop MFH) of all ouroboros's cost
        h: 42949672, // tail and head same - one vertebra
        d: Date.now(), // timestamp
        p: 'singularity', // there is no previous vertebra
        n: 2, // two sites are keepers
        e: Number((4294967295 - .000005).toFixed(6)),

        // {t[o],a[mount],b[balance],s[tamp]} {f[rom],a,b,m}
        '1IIkc0EgbkJkBG3ZXFGT8jaLbrNXjFkC7Ywx66zmIXk': { f: 'Ouroboros-MFH', a: 12949672, b: 12949672, m: 'tips' },
        'su5mw0EQM5CgOLmrA5HadMNxS0oqnbcb7mefZXaOrGQ': { f: 'Ouroboros-MFH', a: 15000000, b: 15000000, m: 'tips' },
        'xJu4OAaIgBiSGE2u1upJdGBLskZSylbfspp1IpWXPm8': { f: 'Ouroboros-MFH', a: 15000000, b: 15000000, m: 'tips' },

        'CLf7C1PsI5JyMAEnNx7JDiKS3naaShujafe7zF5V6s0': { f: '1IIkc0EgbkJkBG3ZXFGT8jaLbrNXjFkC7Ywx66zmIXk', a: 10000, b: 10000, m: "keeper's grant" },
        'Yd5tx7TLa4hOFCqFqLvSnKLKY51oh9uxBcJiBQ3P9vw': { f: '1IIkc0EgbkJkBG3ZXFGT8jaLbrNXjFkC7Ywx66zmIXk', a: 10000, b: 10000, m: "keeper's grant" }
    }
    genesisVertebra.c = createHashSha1(genesisVertebra)

    //setTimeout(() => { dbOuroborosMFH.insertOne(sortObjectABC(genesisVertebra)) }, 1000)

} // async function ouroborosMFH