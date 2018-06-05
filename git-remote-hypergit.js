#!/usr/bin/env node

var toPull = require('stream-to-pull-stream')
var pull = require('pull-stream')
var hyperdb = require('hyperdb')
var Repo = require('hyperdb-git-repo')
var gitRemoteHelper = require('pull-git-remote-helper')

var name = process.argv[3].replace('hypergit://', '')

var db = hyperdb(name)

db.ready(function () {
  pull(
    toPull(process.stdin),
    gitRemoteHelper(Repo(db)),
    toPull(process.stdout)
  )
})
