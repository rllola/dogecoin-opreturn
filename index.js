const Docker = require('dockerode')
const axios = require('axios')
const docker = new Docker()
const bitcoinjs = require('bitcoinjs-lib')

// Dogecoin JSON RPC token
const token = Buffer.from('hello:world', 'utf8').toString('base64')

const message = 'lola'

// Initialize Dogecoin testnet info
bitcoinjs.networks.dogecoin_regtest = {
    messagePrefix: '\x18Dogecoin Signed Message:\n',
    bech32: 'tdge',
    bip32: {
        public: 0x0432a9a8,
        private: 0x0432a243
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
}

function jsonRPC(command, params) {
    return axios.post('http://127.0.0.1:18332', {
        jsonrpc: '1.0',
        id: 'wow',
        method: command,
        params: params
    }, {
        headers: {
            'Authorization': `Basic ${token}`,
            'Content-Type': 'application/json'
        },
    })
}

async function main() {
    let result

    const container = await docker.createContainer({
        Image: 'xanimo/dogecoin-core:ubuntu',
        name: 'dogecoind_regtest',
        PortBindings: { ['18444/tcp']: [{ HostIp: '0.0.0.0', HostPort: '18444' }], ['18332/tcp']: [{ HostIp: '0.0.0.0', HostPort: '18332' }] },
        NetworkMode: 'host',
    })

    console.log('container created')

    await container.start({})

    console.log('container started')

    // Wait 5 seconds
    // Needed otherwise we try to connect when node is not ready
    await new Promise(resolve => setTimeout(resolve, 5000))

    /*
        OP_RETURN transaction
    */

    console.log('Generate 150 blocks')

    result = await jsonRPC('generate', [150])

    result = await jsonRPC('getnewaddress', [])
    const address = result.data.result

    result = await jsonRPC('listunspent', [])
    console.log(result.data.result[0])
    const txInput = result.data.result[0]

    // A bit overkill to use this but meh
    const embed = bitcoinjs.payments.embed({ data: [Buffer.from(message, 'utf8')], network: bitcoinjs.networks.dogecoin_regtest })

    const outputs = {}
    outputs[address] = txInput.amount
    // dummy address and we will change it after
    outputs['data'] = embed.output.toString('hex')

    console.log(outputs)

    result = await jsonRPC('createrawtransaction', [[{txid: txInput.txid, vout: txInput.vout}], outputs])
    console.log(result.data)


    result = await jsonRPC('signrawtransaction', [result.data.result])
    console.log(result.data)

    try {
        result = await jsonRPC('sendrawtransaction', [result.data.result.hex])
        console.log(result.data)
    } catch (err) {
        console.log(err.response.data)
    }

    /*
        DONE !
    */

    await container.stop()
    await container.remove()

    console.log('container stop')
}

main()