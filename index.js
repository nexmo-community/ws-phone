const server = require('http').createServer()
const WebSocketServer = require('ws').Server
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const wss = new WebSocketServer({ server: server })


app.use(express.static('static'))
app.enable('trust proxy')


process.env.PUBLIC_URL = 'foo'

app.get('/answer/:key', (req, res) => {
  const host = req.headers.host
  const secure = req.secure

  // const ws_url = (secure ? 'https' : 'http') + '://' + host + '/server/'
  const input_url = (secure ? 'https' : 'http') + '://' + host + '/input'

  console.log(req.secure)

  console.log(req.headers.host)

  const ws_url = process.env.PUBLIC_URL.replace(/^http/, 'ws') + '/socket'
  const event_url = host + '/event'

  console.log('directing call to ' + ws_url)

  res.send([
    {
      action: 'talk',
      voiceName: 'Celine',
      text: 'Enter your extension'
    },
    {
      'action': 'input',
      'eventUrl': [input_url]
    }
    // {
    //   'action': 'connect',
    //   'eventUrl': [
    //     event_url
    //   ],
    //   'endpoint': [
    //     {
    //       'type': 'websocket',
    //       'uri': ws_url,
    //       'content-type': 'audio/l16;rate=16000',
    //       'headers': {
    //         'whatever': 'metadata_you_want'
    //       }
    //     }
    //   ]
    // }
  ])

})


app.post('/input', bodyParser.json(), (req, res) => {
  const host = req.headers.host
  const secure = req.secure

  const ws_url = (secure ? 'https' : 'http') + '://' + host + '/server/' + req.body.dtmf

  console.log(`connecting ${req.body.uuid} to ${req.body.dtmf}`)

  console.log(req.body)

  res.send([
    {
      'action': 'connect',
      // 'eventUrl': [
      //   event_url
      // ],
      'endpoint': [
        {
          'type': 'websocket',
          'uri': ws_url,
          'content-type': 'audio/l16;rate=16000',
          'headers': {
            'whatever': 'metadata_you_want'
          }
        }
      ]
    }
  ])
})


// const browsers = new WeakMap
// const servers = new WeakMap
const connections = new WeakMap

wss.on('connection', ws => {

  const url = ws.upgradeReq.url

  console.log('incoming! ' + url)

  const serverRE = /^\/server\/(\d{4})$/

  if(url == '/browser') {

    // blurgh
    var digits = Array.from({length: 4}, () => Math.floor(Math.random()*10))

    ws.send(JSON.stringify({
      digits,
      number: 'the phone number'
    }))

    ws.digits = digits.join('')

  } else

  if(url.match(serverRE)) {

    const digits = url.match(serverRE)[1]

    wss.clients.forEach(client => {
      if(client.digits == digits) {
        console.log("found client!!")
        connections.set(ws, client)
        connections.set(client, ws)


        ws.on('message', data => {
          client.send(data)
          console.log("-> nexmo ", data.length)
        })

        client.on('message', data => {
          console.log("-> browser ", data.length)
          ws.send(data)
        })


      }
    })



    console.log(digits)

    //

  }

})


server.on('request', app)

server.listen(process.env.PORT || 3000, () => {
  console.log('Listening on ' + server.address().port)
})
