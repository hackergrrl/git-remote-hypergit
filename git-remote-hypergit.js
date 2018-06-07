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

function swarmReplicate (db, cb) {
  var key = db.key.toString('hex')
  debug('id', db.local.key.toString('hex'))
  debug('seeking peers for', key)
  var swarm = discovery(swarmDefaults({
    id: db.local.key
  }))
  swarm.listen(2341)  // TODO: pick free port
  swarm.join(key)
  var seen = {}
  seen[db.local.key.toString('hex')] = true
  swarm.on('connection', function (conn, info) {
    if (seen[info.id.toString('hex')]) return
    seen[info.id.toString('hex')] = true

    debug('found peer', info.id.toString('hex'))

    var r = db.replicate()
    r.pipe(conn).pipe(r)

    r.once('end', function () {
      debug('done replicating', info.id.toString('hex'))
      swarm.leave(key)
      swarm.destroy(cb)
    })
  })
}

var key = process.argv[3].replace('hypergit://', '')

// Only consult the swarm on an initial 'git clone'
var doSwarm = true
if (fs.existsSync('.hypergit')) doSwarm = false

var db = hyperdb('.hypergit', key)
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
