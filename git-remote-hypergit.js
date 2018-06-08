#!/usr/bin/env node

var path = require('path')
var fs = require('fs')
var toPull = require('stream-to-pull-stream')
var pull = require('pull-stream')
var hyperdb = require('hyperdb')
var Repo = require('hyperdb-git-repo')
var gitRemoteHelper = require('pull-git-remote-helper')
var discovery = require('discovery-swarm')
var swarmDefaults = require('dat-swarm-defaults')
var debug = require('debug')('git-remote-hypergit')
var envpaths = require('env-paths')('hypergit')
var mkdirp = require('mkdirp')

function swarmReplicate (db, cb) {
  var key = db.key.toString('hex')
  debug('id', db.local.key.toString('hex'))
  console.error('Seeking peers..')
  var swarm = discovery(swarmDefaults({
    id: db.local.key
  }))
  swarm.listen(2341)  // TODO: pick free port
  swarm.join(key)
  var seen = {}
  seen[db.local.key.toString('hex')] = true
  var active = 0
  var done = new Buffer(1)
  swarm.on('connection', function (conn, info) {
    if (seen[info.id.toString('hex')]) return
    seen[info.id.toString('hex')] = true

    debug('found peer', info.id.toString('hex'))
    console.error('Replicating with peer..')

    var r = db.replicate({live:false})
    r.pipe(conn).pipe(r)
    active++

    r.once('end', function () {
      debug('done replicating', info.id.toString('hex'))
      console.error('..done!')
      if (!--active) {
        swarm.leave(key)
        swarm.destroy(cb)
      }
    })
    r.once('error', function () {})
  })
}

var key = process.argv[3].replace('hypergit://', '')

var dbpath = path.join(envpaths.config, key)

// Only consult the swarm on an initial 'git clone'
var doSwarm = true
if (fs.existsSync(dbpath)) doSwarm = false

mkdirp.sync(dbpath)

var db = hyperdb(dbpath, key)
db.ready(function () {
  if (doSwarm) swarmReplicate(db, done)
  else done()

  function done () {
    pull(
      toPull(process.stdin),
      gitRemoteHelper(Repo(db)),
      toPull(process.stdout)
    )
  }
})
