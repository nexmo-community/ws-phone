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


app.post('/input', bodyParser.json(), (req, res) => {

  console.log(`connecting ${req.body.uuid} to ${req.body.dtmf}`)

  const ws_url =
    (req.secure ? 'wss' : 'ws') + '://' +
    req.headers.host + '/server/' + req.body.dtmf

  res.send([
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
})

// keep track of who is talking to who
const connections = new Map

// barf
const generateDigits = () =>
  Array.from({length: 4}, () => Math.floor(Math.random()*10))

wss.on('connection', ws => {

  const url = ws.upgradeReq.url

  const serverRE = /^\/server\/(\d{4})$/

  if(url == '/browser') {

    var digits = generateDigits()

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
      }
    })

  }



  ws.on('message', data => {
    const other = connections.get(ws)

    if(other && other.readyState == ws.OPEN) {
      other.send(data)

      console.log('proxying> ', ws.upgradeReq.url, other.upgradeReq.url)
    }

  })

  ws.on('close', () => {
    console.log("closing")
    connections.delete(ws)
  })


})


server.on('request', app)

server.listen(process.env.PORT || 3000, () => {
  console.log('Listening on ' + server.address().port)
})
