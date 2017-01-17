const server = require('http').createServer()
const WebSocketServer = require('ws').Server
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const wss = new WebSocketServer({ server: server })


app.use(express.static('static'))
app.enable('trust proxy')

app.get('/answer', (req, res) => {

  const input_url =
    (req.secure ? 'https' : 'http') + '://' +
    req.headers.host + '/input'

  res.send([
    {
      action: 'talk',
      text: 'Enter that code on your screen now'
    },
    {
      action: 'input',
      eventUrl: [input_url],
      timeOut: 10,
      maxDigits: 4
    }
  ])

})

app.post('/event', bodyParser.json(), (req, res) => {
  console.log('event>', req.body)
  res.sendStatus(200)
})


app.post('/input', bodyParser.json(), (req, res) => {

  console.log(`connecting ${req.body.uuid} to ${req.body.dtmf}`)

  const ws_url =
    (req.secure ? 'wss' : 'ws') + '://' +
    req.headers.host + '/server/' + req.body.dtmf


  if(digitMap.has(req.body.dtmf)) {
    res.send([
      {
        action: 'talk',
        text: 'connecting you'
      },
      {
        'action': 'connect',
        'endpoint': [
          {
            'type': 'websocket',
            'uri': ws_url,
            'content-type': 'audio/l16;rate=16000',
            'headers': {}
          }
        ]
      }
    ])
  } else {

    res.send([
      {
        action: 'talk',
        text: 'Couldn\'t find a matching call, sorry'
      }
    ])

  }

})

// keep track of who is talking to who
const connections = new Map
const digitMap = new Map


const generateDigits = () => {
  for (var i = 0; i < 3; i++) {
    const attempt = Math.random().toString().substr(2,4)

    if(!digitMap.has(attempt)) return attempt
  }
  return 'nope'
}


wss.on('connection', ws => {

  const url = ws.upgradeReq.url

  const serverRE = /^\/server\/(\d{4})$/

  if(url == '/browser') {

    var digits = generateDigits()

    ws.send(JSON.stringify({
      digits,
      number: '+44 7520 618 833'
    }))

    // ws.digits = digits.join('')
    digitMap.set(digits, ws)

    ws.on('close', () => {
      digitMap.delete(digits)
    })

  } else

  if(url.match(serverRE)) {

    const digits = url.match(serverRE)[1]

    const client = digitMap.get(digits)
    if(client) {
      console.log('found client!!')
      connections.set(ws, client)
      connections.set(client, ws)
    }


  }



  ws.on('message', data => {
    const other = connections.get(ws)

    if(other && other.readyState == ws.OPEN) {
      other.send(data)

      console.log('proxy: ', ws.upgradeReq.url, '  ---->  ', other.upgradeReq.url)
    }

  })

  ws.on('close', () => {
    console.log('closing')
    connections.delete(ws)
  })


})


server.on('request', app)

server.listen(process.env.PORT || 3000, () => {
  console.log('Listening on ' + server.address().port)
})
