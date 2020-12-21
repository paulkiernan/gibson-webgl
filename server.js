#!/usr/bin/env node
// vim: set shiftwidth=2 tabstop=2 softtabstop=2:

/** Redshift Connector Server
 *
 * Basic interface to Redshift for reporting metadata about tables and
 * stuff
 *
 */

// Node requirements and application configuration
const Q = require('q')
const conf = require('rc')('gibson', {})
const express = require('express')
const pg = require('pg')
const util = require('util')
const path = require('path')

const port = parseInt(process.env.PORT, 10) || 8080

const buildDir = process.argv[2] || path.join(__dirname, '/dist')
const connectionString = util.format(
  'postgres://%s:%s@%s/%s',
  conf.user,
  conf.pass,
  conf.host + ':' + conf.port,
  conf.dbname
)
const hostname = process.env.HOSTNAME || 'localhost'

const app = express()

/**
 * Return Promise to connection
 */
function connect () {
  const deferred = Q.defer()

  pg.connect(connectionString, function (error, cli, done) {
    if (error) {
      deferred.reject(new Error('Could not connect to db'))
    } else {
      deferred.resolve(cli)
    }
  })

  return deferred.promise
}

// Start registering all urls
app.use('/dist', express.static(buildDir))
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

/**
 * Serve visualizer
 */
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/dist/index.html'))
})

app.get('/healthz', function (req, res) {
  res.sendStatus(200)
})

/**
 * Wrapper for returning results from SQL
 */
function deferredQueryRunner (stringQuery) {
  const deferred = Q.defer()

  connect().then(function (cli) {
    cli.query(stringQuery, function (err, result) {
      if (err) {
        deferred.reject(err)
      } else {
        deferred.resolve(result)
      }
    })
  }).catch(function (e) {
    deferred.reject(e)
  })

  return deferred.promise
}

/**
 * Query to fetch metadata about all tables and their sizes in both
 * megabytes and total number of rows
 * NOTE: unfortunately this query hits some system-level tables in
 *       redshift and therefore requires superuser privs
 *
 */
const GET_CLUSTER_STATS = 'SELECT ' +
                          '    TRIM(a.name) as Table, ' +
                          '    b.mbytes, ' +
                          '    a.rows ' +
                          'FROM ( ' +
                          '    SELECT db_id, id, name, SUM(rows) AS rows ' +
                          '    FROM stv_tbl_perm a ' +
                          '    GROUP BY db_id, id, name ' +
                          ') AS a ' +
                          'JOIN pg_class AS pgc ON pgc.oid = a.id ' +
                          'JOIN pg_namespace AS pgn ON pgn.oid = pgc.relnamespace ' +
                          'JOIN pg_database AS pgdb ON pgdb.oid = a.db_id ' +
                          'JOIN ( ' +
                          '    SELECT tbl, COUNT(*) AS mbytes ' +
                          '    FROM stv_blocklist ' +
                          '    GROUP BY tbl ' +
                          ') b ON a.id = b.tbl ' +
                          'ORDER BY mbytes DESC, a.db_id, a.name;'

/**
 * Return a list of all tables and their sizes in our redshift cluster
 */
function tables () {
  return deferredQueryRunner(GET_CLUSTER_STATS)
}

/**
 * Serve list of tables
 */
app.get('/tables', function (req, res) {
  tables().then(function (results) {
    res.send({
      data: results.rows,
      status: 200
    })
  }).catch(function (e) {
    console.log('Encountered exception when trying to fetch tables!')
    console.log(e)
    res.json({
      data: {},
      status: 200,
      error: 'Error!!'
    })
  })
})

/**
 * Serve list of tables
 */
app.get('/static/tables', function (req, res) {
  res.sendFile(path.join(__dirname, '/data/sanitized_response-2016-02-19.json'))
})

console.log(
  'Server exposing %s listening at %s:%s',
  buildDir,
  hostname,
  port
)

const server = app.listen(port, hostname)
