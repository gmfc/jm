// var http = require('https')
var fs = require('fs')
var data = require('./data2.json')
var gexf = require('gexf')

var myGexf = gexf.create({
  model: {
    node: [
      {
        id: 'name',
        type: 'string',
        title: 'Name'
      }, {
        id: 'distanceToSol',
        type: 'float',
        title: 'distanceToSol'
      }
    ],
    edge: [
      {
        id: 'name',
        type: 'string',
        title: 'Name'
      }, {
        id: 'range',
        type: 'float',
        title: 'range'
      }
    ]
  }
})

/*
var options = {
  'method': 'GET',
  'hostname': 'www.edsm.net',
  'port': null,
  'path': '/api-v1/sphere-systems?systemName=Sol&showCoordinates=1&radius=200',
  'headers': {
    'cache-control': 'no-cache'
  }
};
*/
/*
var req = http.request(options, function(res) {
  var chunks = [];

  res.on('data', function(chunk) {
    chunks.push(chunk);
  });

  res.on('end', function() {
    var data = eval(Buffer.concat(chunks).toString());
    loger(data.length);
    simulate(data)
  });
});

req.end();
*/

simulate(data)

function simulate (data) {
  // loger(data);
  var year = 0
  var portals = []
  var probes = [{
    id: 0,
    status: 'lookup',
    origin: {
      name: 'Sol',
      distance: 0,
      coords: {
        x: 0,
        y: 0,
        z: 0
      }
    }
  }]
  // Sol reset
  for (var i = 0; i < data.length; i++) {
    if (data[i].name === 'Sol') {
      data[i].linked = true
    }
  }
  var MAXAGE = 3700
  while (year <= MAXAGE) {
    year += 1
    loger(':::::::' + year + ':::::::', true)
    for (let i = 0; i < probes.length; i++) {
      if (probes[i].status === 'travel') { // sonda viajando
        if (probes[i].tta <= 0) { // sonda chegou
          loger('<<<<< [ARIVAL] ' + probes[i].id + ' |' + probes[i].origin.name + '->' + probes[i].dest.name)
          // seta portal novo
          portals.push(novoPortal(probes[i]))
          // seta status da sonda para construção
          probes[i].status = 'building'
          // anos para completar a construcao
          probes[i].buildTime = 200
        } else { // sonda ainda viajando
          probes[i].tta -= 1
        }
      } else if (probes[i].status === 'building') { // sonda Construindo
        if (probes[i].buildTime <= 0) { // se terminou de construir
          // loger('||||| [PBUILD] |' + probes[i].origin.name + '->' + probes[i].dest.name);
          // constroi 2 novas sondas
          probes.push(sondaNova(probes[i], 0))
          probes.push(sondaNova(probes[i], 1))
          // finaliza a sonda
          probes[i].status = 'FINAL'
        } else {
          probes[i].buildTime -= 1
        }
      } else if (probes[i].status === 'lookup') { // sonda nova, procurando target
        var target = getProbeTarget(probes[i], data)
        if (target) {
          probes[i].tta = tta(target.dist) // correcao
          probes[i].dest = target.dest
          probes[i].dist = target.dist
          if ((probes[i].tta + 2 + year) <= MAXAGE) {
            probes[i].status = 'travel'
            loger('>>>>> [LAUNCH] ' + probes[i].id +
              ' DIST: ' + Math.floor(probes[i].dist) +
              ' TTA: ' + Math.floor(probes[i].tta + 2) +
              ' ETA: ' + Math.floor(probes[i].tta + year + 2) +
              ' |' + probes[i].origin.name + '->' + probes[i].dest.name)
          } else {
            loger('xxxxx [FINAL] ' + probes[i].id +
              ' |' + probes[i].origin.name + '->' + probes[i].dest.name)
            probes[i].status = 'FINAL'
          }
        } else {
          loger('xxxxx [NO TARGET] ' + probes[i].id + ' No Target')
          probes[i].status = 'FINAL'
        }
      }
    } // FOR
  } // MAIN LOOP

  loger('portais:' + portals.length, true)
  save(portals)
  createGraph(portals, data)
  // loger('sondas',probes);
} // simulate
var logAll = false
function loger (string, overite) {
  if (logAll) {
    console.log(string)
  } else if (overite) {
    console.log(string)
  }
}

function createGraph (links, nodes) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].linked === true) {
      myGexf.addNode({
        id: nodes[i].name,
        label: nodes[i].name,
        attributes: {
          name: nodes[i].name,
          distanceToSol: nodes[i].distance
        },
        viz: {
          color: 'rgb(255, 150, ' + Math.floor((nodes[i].distance / 200) * 255) + ')'
        }
      })
    }
  }

  for (let i = 0; i < links.length; i++) {
    myGexf.addEdge({
      id: links[i].id,
      source: links[i].from,
      target: links[i].to,
      attributes: {
        name: links[i].name,
        range: links[i].range
      },
      viz: {
        thickness: links[i].range
      }
    })
  }
  var doc = myGexf.serialize()
  fs.writeFile('graph.gexf', doc, 'utf8')
  loger('dados salvos', true)
}

function novoPortal (parentProbe) {
  var portal = {}
  portal.from = parentProbe.origin.name
  portal.to = parentProbe.dest.name
  portal.toSol = parentProbe.dest.distance
  portal.range = parentProbe.dist
  portal.id = parentProbe.id
  portal.name = parentProbe.origin.name + '<>' + parentProbe.dest.name
  return portal
}

function getProbeTarget (probe, data) {
  var minDist = 100000
  var dest
  for (var i = 0; i < data.length; i++) { // percorre todos os sistemas
    if (!data[i].linked) {
      var tempDist = dist(probe, data[i])
      var awayWeGo = probe.origin.distance < data[i].distance
      if (tempDist < minDist && awayWeGo) {
        minDist = tempDist
        dest = data[i]
      }
    }
  }
  if (!dest) {
    // loger('TODOS OS SISTEMAS LINCADOS!');
    return null
  } else {
    dest.linked = true
  }
  return {
    dest: dest,
    dist: minDist
  }
}

function sondaNova (parentProbe, n) {
  var probe = {}
  probe.id = parentProbe.id + '' + n
  probe.origin = parentProbe.dest
  probe.status = 'lookup'
  return probe
}

function tta (dist) {
  // var number = 8.6
  var acel = 0.001
  var D = dist
  var A = 1.032 * acel
  var D1 = D / 2.0
  var T = Math.sqrt(D1 * D1 + (2 * D1 / A))
  return 2 * T
}

function dist (probe, sys) {
  var dz = probe.origin.coords.z - sys.coords.z
  var dx = probe.origin.coords.x - sys.coords.x
  var dy = probe.origin.coords.y - sys.coords.y
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
}

function save (data) {
  var json = JSON.stringify(data, null, 4)
  fs.writeFile('portals.json', json, 'utf8')
}
